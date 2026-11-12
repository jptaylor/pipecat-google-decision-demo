from pipecat.classifiers.base_classifier import ClassifierAudio, ClassifierError
from pipecat.expressive.perception import PerceptionSignal
from pipecat.frames.frames import PerceptionFrame, VADUserStartedSpeakingFrame, VADUserStoppedSpeakingFrame
from pipecat.processors.frameworks.rtvi import RTVIServerMessageFrame

from clips import ClipFinishedFrame, ClipStartedFrame
from conftest import FakeDecisionsClient, make_clip, running
from perception import QUESTIONS, ObservedGoogleDecisionsClassifier
from reporter import PerceptionReporter

ASKED = {name: asked.question for name, asked in QUESTIONS.items()}
READING = [
    PerceptionSignal("tone", labels=[("frustrated", 0.71234), ("neutral", 0.2)]),
    PerceptionSignal("sarcasm", value=0.63),
]


def audio(secs: float) -> list[ClassifierAudio]:
    return [ClassifierAudio(audio=bytes(int(16000 * secs) * 2), sample_rate=16000)]


async def told(pipeline, count: int) -> list[dict]:
    frames = await pipeline.out.wait_for(RTVIServerMessageFrame, count=count)
    return [frame.data for frame in frames]


async def test_a_clips_speech_and_reading_are_told_with_the_clip_they_came_from():
    classifier = ObservedGoogleDecisionsClassifier(client=FakeDecisionsClient())
    clip = make_clip("sarcastic.a")
    async with running(PerceptionReporter(classifier)) as pipeline:
        await pipeline.send(ClipStartedFrame(clip=clip))
        await pipeline.send(VADUserStartedSpeakingFrame())
        await pipeline.send(VADUserStoppedSpeakingFrame())
        await told(pipeline, 3)
        await classifier.ask({}, ASKED, inputs=audio(6.9))
        await pipeline.send(PerceptionFrame(perception=READING))
        await pipeline.send(ClipFinishedFrame(clip=clip, completed=True))
        messages = await told(pipeline, 5)

    reading = messages[3]
    assert [message["type"] for message in messages] == [
        "clip-started",
        "speech-started",
        "speech-stopped",
        "reading",
        "clip-finished",
    ]
    assert all(message["clipId"] == "sarcastic.a" for message in messages)
    assert reading["signals"] == [
        {
            "name": "tone",
            "labels": [
                {"label": "frustrated", "confidence": 0.7123},
                {"label": "neutral", "confidence": 0.2},
            ],
        },
        {"name": "sarcasm", "value": 0.63},
    ]
    assert reading["audioSecs"] == 6.9
    assert reading["readMs"] >= 0
    assert messages[4]["completed"] is True


async def test_the_microphones_speech_has_no_clip():
    classifier = ObservedGoogleDecisionsClassifier(client=FakeDecisionsClient())
    async with running(PerceptionReporter(classifier)) as pipeline:
        await pipeline.send(VADUserStartedSpeakingFrame())
        await classifier.ask({}, ASKED, inputs=audio(1.0))
        await pipeline.send(PerceptionFrame(perception=READING))
        messages = await told(pipeline, 2)

    assert [(message["type"], message["clipId"]) for message in messages] == [
        ("speech-started", None),
        ("reading", None),
    ]


async def test_a_failed_read_is_told_and_the_next_reading_is_not_taken_for_it():
    client = FakeDecisionsClient(error=ClassifierError("Google is busy"))
    classifier = ObservedGoogleDecisionsClassifier(client=client)
    clip = make_clip("sad.a")
    async with running(PerceptionReporter(classifier)) as pipeline:
        await pipeline.send(ClipStartedFrame(clip=clip))
        await told(pipeline, 1)
        try:
            await classifier.ask({}, ASKED, inputs=audio(3.0))
        except ClassifierError:
            pass
        await pipeline.send(ClipFinishedFrame(clip=clip, completed=True))
        await told(pipeline, 3)

        client.error = None
        await classifier.ask({}, ASKED, inputs=audio(2.0))
        await pipeline.send(PerceptionFrame(perception=READING))
        messages = await told(pipeline, 4)

    assert messages[1] == {"type": "reading-failed", "clipId": "sad.a", "reason": "Google is busy"}
    assert (messages[3]["type"], messages[3]["clipId"], messages[3]["audioSecs"]) == ("reading", None, 2.0)
