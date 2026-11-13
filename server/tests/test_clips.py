import asyncio
import json

from pipecat.frames.frames import InputAudioRawFrame, OutputAudioRawFrame
from pipecat.processors.frameworks.rtvi import RTVIServerMessageFrame

from clips import SAMPLE_RATE, Clip, ClipPlayer, load_clips
from conftest import Collector, make_clip, running, write_wav

SILENCE_SECS = 0.06


def heard(frames: list[InputAudioRawFrame]) -> bytes:
    return b"".join(frame.audio for frame in frames)


def microphone() -> InputAudioRawFrame:
    return InputAudioRawFrame(audio=b"\x07\x00" * 320, sample_rate=SAMPLE_RATE, num_channels=1)


def player_of(*clips: Clip) -> ClipPlayer:
    return ClipPlayer({clip.id: clip for clip in clips}, silence_secs=SILENCE_SECS)


def told(out: Collector) -> list[dict]:
    """The messages the player sent the page."""
    return [frame.data for frame in out.of(RTVIServerMessageFrame)]


async def finished(out: Collector, count: int = 1) -> list[dict]:
    """The clip-finished messages, once there are ``count`` of them."""

    def over() -> list[dict]:
        return [message for message in told(out) if message["type"] == "clip-finished"]

    while len(over()) < count:
        await out.wait_for(RTVIServerMessageFrame, count=len(told(out)) + 1)
    return over()


def test_load_clips_keeps_the_manifest_order_and_leaves_out_bad_files(tmp_path):
    good = make_clip("sad.a")
    write_wav(tmp_path / "sad.a.wav", good.audio)
    write_wav(tmp_path / "happy.a.wav", good.audio, sample_rate=8000)
    entry = {"mood": "sad", "sincerity": "sincere", "voice": "Sarah", "text": "Oh.", "duration": 0.1}
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
        **{k: entry[k] for k in ("mood", "sincerity", "voice", "text")},
    }


def test_load_clips_from_a_folder_never_filled_is_empty(tmp_path):
    assert load_clips(tmp_path) == {}


async def test_a_clip_is_heard_as_the_users_audio_then_silence_and_sent_out():
    clip = make_clip(secs=0.1)
    player = player_of(clip)
    async with running(player) as pipeline:
        assert await player.play(clip.id)
        await finished(pipeline.out)

    assert heard(pipeline.out.of(InputAudioRawFrame)) == clip.audio + bytes(
        int(SAMPLE_RATE * SILENCE_SECS) * 2
    )
    assert heard(pipeline.out.of(OutputAudioRawFrame)) == clip.audio
    assert pipeline.out.frames[0].data == {"type": "clip-started", "clipId": clip.id}
    assert pipeline.out.frames[-1].data == {"type": "clip-finished", "clipId": clip.id, "completed": True}


async def test_with_no_clip_named_each_play_is_the_next_one_round_and_round():
    first, second = make_clip("a", secs=0.04), make_clip("b", secs=0.04, sample=2000)
    player = player_of(first, second)
    async with running(player) as pipeline:
        for played in range(1, 4):
            assert await player.play()
            await finished(pipeline.out, count=played)

    started = [message["clipId"] for message in told(pipeline.out) if message["type"] == "clip-started"]
    assert started == ["a", "b", "a"]
    assert [clip.id for clip in player.clips] == ["a", "b"]


async def test_a_clip_that_is_not_there_is_not_played():
    player = player_of(make_clip("a"))
    async with running(player) as pipeline:
        assert not await player.play("missing")
        await asyncio.sleep(0.05)

    assert not player.playing
    assert told(pipeline.out) == []


async def test_the_microphone_is_not_heard_over_a_clip():
    clip = make_clip(secs=0.2)
    player = player_of(clip)
    async with running(player) as pipeline:
        await player.play(clip.id)
        await pipeline.out.wait_for(RTVIServerMessageFrame)
        await pipeline.send(microphone())
        await finished(pipeline.out)
        assert microphone().audio not in heard(pipeline.out.of(InputAudioRawFrame))

        await pipeline.send(microphone())
        await asyncio.sleep(0.05)
        assert pipeline.out.of(InputAudioRawFrame)[-1].audio == microphone().audio


async def test_a_stopped_clip_ends_early_and_its_silence_is_still_played():
    clip = make_clip(secs=2.0)
    player = player_of(clip)
    async with running(player) as pipeline:
        await player.play(clip.id)
        await pipeline.out.wait_for(OutputAudioRawFrame, count=2)
        player.stop()
        (over,) = await finished(pipeline.out)

    audio = heard(pipeline.out.of(InputAudioRawFrame))
    assert not over["completed"]
    assert len(audio) < len(clip.audio)
    assert audio.endswith(bytes(int(SAMPLE_RATE * SILENCE_SECS) * 2))


async def test_playing_another_clip_stops_the_first_and_skips_one_that_never_started():
    first, skipped, last = make_clip("a", secs=2.0), make_clip("b", sample=2000), make_clip("c", sample=3000)
    player = player_of(first, skipped, last)
    async with running(player) as pipeline:
        await player.play("a")
        await pipeline.out.wait_for(OutputAudioRawFrame)
        await player.play("b")
        await player.play("c")
        over = await finished(pipeline.out, count=2)

    assert [(message["clipId"], message["completed"]) for message in over] == [("a", False), ("c", True)]
    started = [message["clipId"] for message in told(pipeline.out) if message["type"] == "clip-started"]
    assert started == ["a", "c"]
    assert skipped.audio[:2] not in {frame.audio[:2] for frame in pipeline.out.of(OutputAudioRawFrame)}
