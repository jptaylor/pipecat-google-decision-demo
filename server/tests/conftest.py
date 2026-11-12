"""A pipeline the tests can run processors in, and see what comes out the far end."""

from __future__ import annotations

import asyncio
import wave
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from loguru import logger
from pipecat.classifiers.google.decisions.client import GoogleDecisionsUsage
from pipecat.frames.frames import CancelFrame, EndFrame, Frame, StartFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.workers.runner import WorkerRunner

from clips import SAMPLE_RATE, Clip

logger.disable("pipecat")


class Collector(FrameProcessor):
    """Keeps every frame that reaches the end of the pipeline, but the ones that start and end it."""

    def __init__(self):
        super().__init__()
        self.frames: list[Frame] = []
        self.started = asyncio.Event()
        self._arrived = asyncio.Condition()

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, StartFrame):
            self.started.set()
        elif direction == FrameDirection.DOWNSTREAM and not isinstance(frame, (EndFrame, CancelFrame)):
            async with self._arrived:
                self.frames.append(frame)
                self._arrived.notify_all()
        await self.push_frame(frame, direction)

    def of(self, kind: type[Frame]) -> list[Any]:
        """The frames of a kind, in the order they arrived."""
        return [frame for frame in self.frames if isinstance(frame, kind)]

    async def wait_for(self, kind: type[Frame], count: int = 1, timeout: float = 5.0) -> list[Any]:
        """The frames of a kind, once there are ``count`` of them."""
        async with self._arrived:
            await asyncio.wait_for(self._arrived.wait_for(lambda: len(self.of(kind)) >= count), timeout)
        return self.of(kind)


class Running:
    """A running pipeline: what to send into it, and what came out."""

    def __init__(self, worker: PipelineWorker, out: Collector):
        self._worker = worker
        self.out = out

    async def send(self, frame: Frame):
        await self._worker.queue_frame(frame)


@asynccontextmanager
async def running(*processors: FrameProcessor) -> AsyncIterator[Running]:
    """Run the processors as a pipeline until the block is left."""
    out = Collector()
    worker = PipelineWorker(
        Pipeline([*processors, out]),
        params=PipelineParams(audio_in_sample_rate=SAMPLE_RATE, audio_out_sample_rate=SAMPLE_RATE),
        enable_rtvi=False,
        idle_timeout_secs=None,
    )
    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)
    run = asyncio.create_task(runner.run())
    await asyncio.wait_for(out.started.wait(), 5.0)
    try:
        yield Running(worker, out)
    finally:
        await runner.cancel()
        await run


def make_clip(clip_id: str = "happy.a", secs: float = 0.1, sample: int = 1000) -> Clip:
    """A clip of one repeated sample, so its audio is told apart from silence and other clips."""
    audio = sample.to_bytes(2, "little", signed=True) * int(SAMPLE_RATE * secs)
    return Clip(id=clip_id, mood="happy", voice="Sarah", text="Oh, lovely.", duration=secs, audio=audio)


def write_wav(path: Path, audio: bytes, sample_rate: int = SAMPLE_RATE):
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(audio)


class FakeDecisionsClient:
    """Stands in for Google: answers every question the same way, or fails."""

    model = "fake-decision-1"

    def __init__(self, error: Exception | None = None):
        self.error = error

    async def connect(self):
        pass

    async def close(self):
        pass

    async def ask(self, state, questions):
        if self.error:
            raise self.error
        answers = {
            name: SimpleNamespace(
                noul=0.8,
                score=0.4,
                confidence=0.9,
                choice=next(iter(question.get("criteria") or {"": ""})),
                probabilities={},
            )
            for name, question in questions.items()
        }
        return answers, GoogleDecisionsUsage(input_tokens=10, output_tokens=2)
