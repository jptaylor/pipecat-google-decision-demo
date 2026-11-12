import asyncio
import json

from pipecat.frames.frames import InputAudioRawFrame, OutputAudioRawFrame

from clips import SAMPLE_RATE, ClipFinishedFrame, ClipPlayer, ClipStartedFrame, load_clips
from conftest import make_clip, running, write_wav

SILENCE_SECS = 0.06


def heard(frames: list[InputAudioRawFrame]) -> bytes:
    return b"".join(frame.audio for frame in frames)


def microphone() -> InputAudioRawFrame:
    return InputAudioRawFrame(audio=b"\x07\x00" * 320, sample_rate=SAMPLE_RATE, num_channels=1)


def test_load_clips_keeps_the_manifest_order_and_leaves_out_bad_files(tmp_path):
    good = make_clip("sad.a")
    write_wav(tmp_path / "sad.a.wav", good.audio)
    write_wav(tmp_path / "happy.a.wav", good.audio, sample_rate=8000)
    entry = {"mood": "sad", "voice": "Sarah", "text": "Oh.", "duration": 0.1}
    manifest = [
        {"id": "happy.a", "file": "happy.a.wav", **entry},
        {"id": "gone.a", "file": "gone.a.wav", **entry},
        {"id": "sad.a", "file": "sad.a.wav", **entry},
    ]
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))

    clips = load_clips(tmp_path)

    assert list(clips) == ["sad.a"]
    assert clips["sad.a"].audio == good.audio
    assert clips["sad.a"].describe() == {
        "id": "sad.a",
        "duration": 0.1,
        **{k: entry[k] for k in ("mood", "voice", "text")},
    }


def test_load_clips_from_a_folder_never_filled_is_empty(tmp_path):
    assert load_clips(tmp_path) == {}


async def test_a_clip_is_heard_as_the_users_audio_then_silence_and_sent_out():
    clip = make_clip(secs=0.1)
    player = ClipPlayer(silence_secs=SILENCE_SECS)
    async with running(player) as pipeline:
        await player.play(clip)
        (finished,) = await pipeline.out.wait_for(ClipFinishedFrame)

    assert finished.completed
    assert heard(pipeline.out.of(InputAudioRawFrame)) == clip.audio + bytes(
        int(SAMPLE_RATE * SILENCE_SECS) * 2
    )
    assert heard(pipeline.out.of(OutputAudioRawFrame)) == clip.audio
    kinds = [type(frame) for frame in pipeline.out.frames]
    assert kinds[0] is ClipStartedFrame and kinds[-1] is ClipFinishedFrame


async def test_the_microphone_is_not_heard_over_a_clip():
    clip = make_clip(secs=0.2)
    player = ClipPlayer(silence_secs=SILENCE_SECS)
    async with running(player) as pipeline:
        await player.play(clip)
        await pipeline.out.wait_for(ClipStartedFrame)
        await pipeline.send(microphone())
        await pipeline.out.wait_for(ClipFinishedFrame)
        assert microphone().audio not in heard(pipeline.out.of(InputAudioRawFrame))

        await pipeline.send(microphone())
        await asyncio.sleep(0.05)
        assert pipeline.out.of(InputAudioRawFrame)[-1].audio == microphone().audio


async def test_a_stopped_clip_ends_early_and_its_silence_is_still_played():
    clip = make_clip(secs=2.0)
    player = ClipPlayer(silence_secs=SILENCE_SECS)
    async with running(player) as pipeline:
        await player.play(clip)
        await pipeline.out.wait_for(OutputAudioRawFrame, count=2)
        player.stop()
        (finished,) = await pipeline.out.wait_for(ClipFinishedFrame)

    audio = heard(pipeline.out.of(InputAudioRawFrame))
    assert not finished.completed
    assert len(audio) < len(clip.audio)
    assert audio.endswith(bytes(int(SAMPLE_RATE * SILENCE_SECS) * 2))


async def test_playing_another_clip_stops_the_first_and_skips_one_that_never_started():
    first, skipped, last = make_clip("a", secs=2.0), make_clip("b", sample=2000), make_clip("c", sample=3000)
    player = ClipPlayer(silence_secs=SILENCE_SECS)
    async with running(player) as pipeline:
        await player.play(first)
        await pipeline.out.wait_for(OutputAudioRawFrame)
        await player.play(skipped)
        await player.play(last)
        finished = await pipeline.out.wait_for(ClipFinishedFrame, count=2)

    assert [(frame.clip.id, frame.completed) for frame in finished] == [("a", False), ("c", True)]
    assert [frame.clip.id for frame in pipeline.out.of(ClipStartedFrame)] == ["a", "c"]
    assert skipped.audio[:2] not in {frame.audio[:2] for frame in pipeline.out.of(OutputAudioRawFrame)}
