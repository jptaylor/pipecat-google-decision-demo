"""Tells the page what the pipeline hears, as RTVI server messages.

Every message is a JSON object with a ``type``:

- ``clip-started`` and ``clip-finished``: a premade clip began or ended (``clipId``, and ``completed`` for the end).
- ``speech-started`` and ``speech-stopped``: the VAD found the start or end of a stretch of speech.
- ``reading``: what Google made of a stretch (``signals``), how long the read took (``readMs``) and how much
  audio it was given (``audioSecs``).
- ``reading-failed``: a read that came to nothing, and why (``reason``).

``clipId`` names the clip the speech came from, or is null for the microphone. The ``session`` message, sent
once when the page is ready, is ``bot.py``'s.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass
from typing import Any

from loguru import logger
from pipecat.expressive.perception import PerceptionSignal
from pipecat.frames.frames import (
    Frame,
    PerceptionFrame,
    VADUserStartedSpeakingFrame,
    VADUserStoppedSpeakingFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.processors.frameworks.rtvi import RTVIServerMessageFrame

from clips import Clip, ClipFinishedFrame, ClipStartedFrame
from perception import ObservedGoogleDecisionsClassifier


@dataclass(frozen=True)
class _Read:
    """A read Google has been asked for: what it hears, and when it was asked."""

    clip_id: str | None
    audio_secs: float
    started: float


class PerceptionReporter(FrameProcessor):
    """Turns the clips, the VAD's frames and the reader's readings into messages for the page.

    Goes after the ``PerceptionReader``. The reader asks its classifier about one clip of audio at a time
    and broadcasts each answer as a ``PerceptionFrame``, so the answers come in the order the reads were
    started: each one is matched to the oldest read still waiting for its answer, and a failure to the
    newest, the only one that can be in flight.
    """

    def __init__(self, classifier: ObservedGoogleDecisionsClassifier, **kwargs):
        """Initialize the reporter.

        Args:
            classifier: The reader's classifier, whose events time each read.
            **kwargs: Additional arguments passed to the parent.
        """
        super().__init__(**kwargs)
        self._clip: Clip | None = None
        self._reads: deque[_Read] = deque()
        classifier.add_event_handler("on_ask_started", self._on_ask_started)
        classifier.add_event_handler("on_ask_failed", self._on_ask_failed)

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, ClipStartedFrame):
            self._clip = frame.clip
            await self._tell("clip-started", clipId=frame.clip.id)
        elif isinstance(frame, ClipFinishedFrame):
            self._clip = None
            await self._tell("clip-finished", clipId=frame.clip.id, completed=frame.completed)
        elif isinstance(frame, VADUserStartedSpeakingFrame):
            await self._tell("speech-started", clipId=self._clip_id)
        elif isinstance(frame, VADUserStoppedSpeakingFrame):
            await self._tell("speech-stopped", clipId=self._clip_id)
        elif isinstance(frame, PerceptionFrame):
            await self._handle_reading(frame)
        await self.push_frame(frame, direction)

    @property
    def _clip_id(self) -> str | None:
        return self._clip.id if self._clip else None

    async def _on_ask_started(self, _classifier: ObservedGoogleDecisionsClassifier, audio_secs: float):
        # A read starts as the speech stops, while its clip, if any, is still playing its silence.
        self._reads.append(_Read(self._clip_id, audio_secs, time.perf_counter()))

    async def _on_ask_failed(self, _classifier: ObservedGoogleDecisionsClassifier, reason: str):
        read = self._reads.pop()
        logger.warning(f"Reading failed: {reason}")
        await self._tell("reading-failed", clipId=read.clip_id, reason=reason)

    async def _handle_reading(self, frame: PerceptionFrame):
        if not self._reads:
            return
        read = self._reads.popleft()
        await self._tell(
            "reading",
            clipId=read.clip_id,
            signals=[_signal_json(signal) for signal in frame.perception],
            readMs=round((time.perf_counter() - read.started) * 1000),
            audioSecs=round(read.audio_secs, 2),
        )

    async def _tell(self, kind: str, **fields: Any):
        await self.push_frame(RTVIServerMessageFrame(data={"type": kind, **fields}))


def _signal_json(signal: PerceptionSignal) -> dict[str, Any]:
    """A signal for the page: its labels with how sure the reading is of each, or its value."""
    if signal.labels:
        labels = [{"label": label, "confidence": round(confidence, 4)} for label, confidence in signal.labels]
        return {"name": signal.name, "labels": labels}
    return {"name": signal.name, "value": signal.value}
