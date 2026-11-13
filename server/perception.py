"""What the demo asks Google's Decisions API about each stretch of speech.

``bot.py`` gives these to a ``PerceptionReader``, which reports one signal per question, named after it.
The five signals are the ones Pipecat Voice Reader reports, put to Google as questions about the audio
alone. The page lays out these five by name (``client/src/lib/perception.ts``), so a change here is a
change there too.
"""

from __future__ import annotations

from pipecat.classifiers.base_classifier import ChoiceQuestion, ScoreQuestion, YesNoQuestion
from pipecat.expressive.processors.perception_reader import PerceptionQuestion

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
        max_labels=4,  # every tone's probability, for the page's panels
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
