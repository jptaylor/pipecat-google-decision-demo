from pipecat.classifiers.base_classifier import ClassifierError
from pipecat.classifiers.google.decisions.classifier import GoogleDecisionsClassifier
from pipecat.expressive.processors.perception_reader import PerceptionReader, PerceptionSource
from pipecat.frames.frames import (
    ErrorFrame,
    InputAudioRawFrame,
    PerceptionFrame,
    TranscriptionFrame,
    VADUserStartedSpeakingFrame,
    VADUserStoppedSpeakingFrame,
)

from clips import SAMPLE_RATE
from conftest import FakeDecisionsClient, Running, running
from perception import MAX_SPEECH_RATE, QUESTIONS


def reader_asking(client: FakeDecisionsClient) -> PerceptionReader:
    """The reader ``bot.py`` builds, asking a stand-in for Google."""
    google = GoogleDecisionsClassifier(client=client)
    return PerceptionReader(sources=[PerceptionSource(classifier=google, questions=QUESTIONS)])


async def say(pipeline: Running, text: str, secs: float = 1.0):
    """A stretch of speech as the VAD and the STT report it: its audio, then its words."""
    await pipeline.send(VADUserStartedSpeakingFrame())
    for _ in range(round(secs / 0.02)):
        await pipeline.send(
            InputAudioRawFrame(audio=b"\x07\x00" * 320, sample_rate=SAMPLE_RATE, num_channels=1)
        )
    await pipeline.send(VADUserStoppedSpeakingFrame())
    await pipeline.send(
        TranscriptionFrame(text=text, user_id="", timestamp="2026-01-01T00:00:00Z", finalized=True)
    )


def test_the_signals_are_the_five_the_page_lays_out():
    assert list(QUESTIONS) == ["tone", "arousal", "laughter", "speech_rate", "sarcasm"]
    assert list(QUESTIONS["tone"].question.options) == ["positive", "neutral", "sad", "frustrated"]
    assert QUESTIONS["tone"].max_labels == 4
    assert len(QUESTIONS["speech_rate"].question.levels) == MAX_SPEECH_RATE + 1


async def test_a_turns_transcription_carries_what_google_heard_in_its_audio():
    async with running(reader_asking(FakeDecisionsClient())) as pipeline:
        await say(pipeline, "Oh, lovely.")
        (transcription,) = await pipeline.out.wait_for(TranscriptionFrame)

    assert transcription.text == "Oh, lovely."
    assert [signal.name for signal in transcription.perception] == list(QUESTIONS)
    tone = transcription.perception[0]
    assert [label for label, _ in tone.labels][0] == "positive"
    # The reading is also broadcast on its own, as soon as it's made.
    (reading,) = pipeline.out.of(PerceptionFrame)
    assert reading.perception == transcription.perception


async def test_a_turn_google_could_not_read_goes_on_without_a_reading_and_reports_the_error():
    client = FakeDecisionsClient(error=ClassifierError("Google is busy"))
    async with running(reader_asking(client)) as pipeline:
        await say(pipeline, "Oh, lovely.")
        (transcription,) = await pipeline.out.wait_for(TranscriptionFrame)
        (error,) = await pipeline.errors.wait_for(ErrorFrame)

    assert transcription.perception is None
    assert "Google is busy" in error.error
    assert not error.fatal
