import pytest
from pipecat.classifiers.base_classifier import ClassifierAudio, ClassifierError

from conftest import FakeDecisionsClient
from perception import MAX_SPEECH_RATE, QUESTIONS, ObservedGoogleDecisionsClassifier, build_reader

ASKED = {name: asked.question for name, asked in QUESTIONS.items()}


def clip_of(secs: float) -> ClassifierAudio:
    return ClassifierAudio(audio=bytes(int(16000 * secs) * 2), sample_rate=16000)


def observed(client: FakeDecisionsClient) -> tuple[ObservedGoogleDecisionsClassifier, list[tuple]]:
    classifier = ObservedGoogleDecisionsClassifier(client=client)
    events: list[tuple] = []

    @classifier.event_handler("on_ask_started")
    async def on_ask_started(_classifier, audio_secs):
        events.append(("started", audio_secs))

    @classifier.event_handler("on_ask_failed")
    async def on_ask_failed(_classifier, reason):
        events.append(("failed", reason))

    return classifier, events


def test_the_signals_are_the_five_the_page_lays_out():
    assert list(QUESTIONS) == ["tone", "arousal", "laughter", "speech_rate", "sarcasm"]
    assert list(QUESTIONS["tone"].question.options) == ["positive", "neutral", "sad", "frustrated"]
    assert QUESTIONS["tone"].max_labels == 4
    assert len(QUESTIONS["speech_rate"].question.levels) == MAX_SPEECH_RATE + 1


def test_the_reader_asks_google_alone_about_every_signal():
    reader, classifier = build_reader("a-key")

    (source,) = reader.sources
    assert source.classifier is classifier
    assert source.names == list(QUESTIONS)


async def test_a_read_is_reported_as_it_starts_with_the_audio_it_was_given():
    classifier, events = observed(FakeDecisionsClient())

    results = await classifier.ask({}, ASKED, inputs=[clip_of(2.5)])

    assert events == [("started", 2.5)]
    assert set(results) == set(QUESTIONS)


async def test_a_read_that_fails_is_reported_with_its_reason_and_still_raises():
    classifier, events = observed(FakeDecisionsClient(error=ClassifierError("Google is busy")))

    with pytest.raises(ClassifierError, match="Google is busy"):
        await classifier.ask({}, ASKED, inputs=[clip_of(1.0)])

    assert events == [("started", 1.0), ("failed", "Google is busy")]
