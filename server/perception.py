"""What the demo asks Google's Decisions API about each stretch of speech, and the reader that asks it.

The five signals are the ones Pipecat Voice Reader reports, put to Google as questions about the audio alone.
The page lays out these five by name (``client/src/lib/perception.ts``), so a change to ``QUESTIONS`` is a
change there too.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from pipecat.classifiers.base_classifier import (
    ChoiceQuestion,
    ClassifierAudio,
    ClassifierError,
    ClassifierImage,
    ClassifierInput,
    ClassifierQuestion,
    ClassifierResult,
    ScoreQuestion,
    YesNoQuestion,
)
from pipecat.classifiers.google.decisions.classifier import GoogleDecisionsClassifier
from pipecat.expressive.processors.perception_reader import (
    PerceptionQuestion,
    PerceptionReader,
    PerceptionSource,
)

#: The top of the ``speech_rate`` scale, in syllables per second. Each level is one more syllable a second,
#: so the position the model gives on the scale is the rate itself.
MAX_SPEECH_RATE = 9

QUESTIONS: dict[str, PerceptionQuestion] = {
    "tone": PerceptionQuestion(
        question=ChoiceQuestion(
            instructions="How does the voice sound?",
            options={
                "positive": "warm, bright, pleased",
                "neutral": None,
                "sad": "low, deflated",
                "frustrated": "tense, irritated, clipped",
            },
        ),
        description="How the speaker's voice sounds.",
        max_labels=4,  # every tone's probability, for the page's bars
    ),
    "arousal": PerceptionQuestion(
        question=ScoreQuestion(
            instructions="How activated does the voice sound?",
            levels=["flat, low energy", "highly animated"],
        ),
        description="How activated the voice sounds, from 0 (flat, low energy) to 1 (highly animated).",
    ),
    "laughter": PerceptionQuestion(
        question=YesNoQuestion(instructions="Is there laughter in the turn?"),
        description="The chance the turn has laughter in it, from 0 to 1.",
    ),
    "speech_rate": PerceptionQuestion(
        question=ScoreQuestion(
            instructions="How fast is the speech, in syllables per second?",
            levels=[f"{rate} syllables per second" for rate in range(MAX_SPEECH_RATE + 1)],
        ),
        description="Speaking rate in syllables per second; relaxed conversation is about 4.",
    ),
    "sarcasm": PerceptionQuestion(
        question=YesNoQuestion(instructions="Would a listener hear the turn as sarcastic?"),
        description="The chance the turn sounds sarcastic, from 0 to 1.",
    ),
}


class ObservedGoogleDecisionsClassifier(GoogleDecisionsClassifier):
    """Google's Decisions API, with every question it's asked reported as it starts and if it fails.

    A ``PerceptionReader`` asks its classifier out of sight and broadcasts only the answers. These events
    say when a read starts, how much audio it was given and why it came to nothing, so each reading can be
    shown with how long it took.

    Event handlers:
        on_ask_started(classifier, audio_secs): Before the question goes to Google.
        on_ask_failed(classifier, reason): When Google gave no usable answer, before the error is raised.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Called in line, so a handler has seen a read start before its answer can be broadcast.
        self._register_event_handler("on_ask_started", sync=True)
        self._register_event_handler("on_ask_failed", sync=True)

    async def ask(
        self,
        state: str | dict[str, Any] | list[Any],
        questions: Mapping[str, ClassifierQuestion],
        *,
        inputs: Sequence[ClassifierInput] | None = None,
        images: Sequence[ClassifierImage] | None = None,
    ) -> dict[str, ClassifierResult]:
        audio_secs = sum(item.duration_secs for item in inputs or () if isinstance(item, ClassifierAudio))
        await self._call_event_handler("on_ask_started", audio_secs)
        try:
            return await super().ask(state, questions, inputs=inputs, images=images)
        except ClassifierError as e:
            await self._call_event_handler("on_ask_failed", str(e))
            raise


def build_reader(api_key: str) -> tuple[PerceptionReader, ObservedGoogleDecisionsClassifier]:
    """The reader that hears each stretch of speech with Google, and its classifier, for its events.

    Args:
        api_key: The Gemini API key the Decisions API is asked with.
    """
    classifier = ObservedGoogleDecisionsClassifier(api_key=api_key)
    source = PerceptionSource(classifier=classifier, questions=QUESTIONS)
    return PerceptionReader(sources=[source]), classifier
