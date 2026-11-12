"""Google Decisions perception demo: a listen-only Pipecat bot.

    transport input -> ClipPlayer -> Silero VAD -> PerceptionReader (Google) -> PerceptionReporter -> transport output

The page plays a premade clip or opens its microphone. Each time the VAD says the speech stopped, the reader
sends that stretch of audio to Google's Decisions API with the questions in ``perception.py``, and the reporter
tells the page what came back and how long it took. There is no speech-to-text, LLM or TTS: the only thing
the bot sends out is the clip being played, so the visitor hears what the model hears.

Messages from the page (RTVI client messages):

- ``play-clip``: play the next premade clip into the pipeline, or the one named by ``{"clipId": ...}``.
- ``stop-clip``: stop the clip playing.

Messages to the page are listed in ``reporter.py``, after one ``session`` message sent when the page is ready:
the model asked and the clips it can play.

Run it locally with ``uv run bot.py`` (SmallWebRTC, no account needed) or ``uv run bot.py -t daily``.
"""

from __future__ import annotations

import asyncio
import itertools
import os

from dotenv import load_dotenv
from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import VADUserStartedSpeakingFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.audio.vad_processor import VADProcessor
from pipecat.processors.frameworks.rtvi import RTVIProcessor
from pipecat.processors.frameworks.rtvi.models import ClientMessage
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.daily.transport import DailyParams
from pipecat.workers.runner import WorkerRunner

from clips import SAMPLE_RATE, ClipPlayer, load_clips
from perception import build_reader
from reporter import PerceptionReporter

load_dotenv(override=True)

#: Seconds of silence after which the VAD says the speech stopped, and a read starts. Long enough that a
#: breath mid-sentence doesn't split a turn in two.
VAD_STOP_SECS = 0.6
#: Seconds of silence played after a clip: the VAD's wait, and room for its read to start before the next.
CLIP_SILENCE_SECS = VAD_STOP_SECS + 0.5
#: The longest a session lasts, in seconds. The demo is public and every read is a paid request.
SESSION_MAX_SECS = float(os.getenv("SESSION_MAX_SECS", "600"))

# Lambdas defer building the parameters until the runner has picked the transport.
transport_params = {
    "daily": lambda: DailyParams(audio_in_enabled=True, audio_out_enabled=True),
    "webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True),
}


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments):
    clips = load_clips()
    up_next = itertools.cycle(clips.values())
    reader, classifier = build_reader(os.environ["GOOGLE_API_KEY"])
    player = ClipPlayer(silence_secs=CLIP_SILENCE_SECS)

    pipeline = Pipeline(
        [
            transport.input(),
            player,
            VADProcessor(vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=VAD_STOP_SECS))),
            reader,
            PerceptionReporter(classifier),
            transport.output(),
        ]
    )

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(audio_in_sample_rate=SAMPLE_RATE, audio_out_sample_rate=SAMPLE_RATE),
        # Nothing here transcribes or speaks, so speech is what shows a session is in use.
        idle_timeout_frames=(VADUserStartedSpeakingFrame,),
        idle_timeout_secs=runner_args.pipeline_idle_timeout_secs,
    )

    runner = WorkerRunner(handle_sigint=runner_args.handle_sigint)
    await runner.add_workers(worker)

    @worker.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi: RTVIProcessor):
        await rtvi.send_server_message(
            {
                "type": "session",
                "model": classifier.model,
                "clips": [clip.describe() for clip in clips.values()],
                "maxSecs": SESSION_MAX_SECS,
            }
        )

    @worker.rtvi.event_handler("on_client_message")
    async def on_client_message(rtvi: RTVIProcessor, message: ClientMessage):
        if message.type == "play-clip":
            clip_id = message.data.get("clipId") if isinstance(message.data, dict) else None
            # With no clip named, each press of Play is the next one, round and round.
            clip = clips.get(clip_id) if clip_id else next(up_next, None)
            if clip:
                await player.play(clip)
            else:
                await rtvi.send_error_response(message, "There is no such clip to play")
        elif message.type == "stop-clip":
            player.stop()
        else:
            await rtvi.send_error_response(message, f"Unknown message {message.type!r}")

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        await runner.cancel()

    session_limit = asyncio.create_task(_end_after(runner, SESSION_MAX_SECS))
    try:
        await runner.run()
    finally:
        session_limit.cancel()


async def _end_after(runner: WorkerRunner, secs: float):
    """End the session once it has lasted ``secs``, whatever the visitor is doing."""
    await asyncio.sleep(secs)
    logger.info(f"Session reached its {secs:g}s limit")
    await runner.end()


async def bot(runner_args: RunnerArguments):
    """Bot entry point, for Pipecat's development runner and Pipecat Cloud alike."""
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
