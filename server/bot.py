"""Voice perception demo: a Pipecat bot that hears how each turn was said.

    transport input -> clips -> VAD -> user turns -> Deepgram STT -> PerceptionReader (Google) -> transport output

The page plays a premade clip or opens its microphone. A clip enters the pipeline as the user's audio, so
both take the same road. Deepgram transcribes the speech, and each time the user stops, the
``PerceptionReader`` has Google's Decisions API hear that stretch of audio and answer the questions in
``perception.py``. The reader sets the answers as the transcription's ``perception``.

There is no LLM or TTS, and nothing here reports to the page but the clip player: Pipecat's RTVI layer
already tells a client everything else.

- ``user-started-speaking`` and ``user-stopped-speaking``: the user's turn.
- ``user-input``: what was said and, on the final transcription, its ``perception``.
- ``metrics``: how long each read took, as the classifier's processing time.

The demo's own messages are the clips'. From the page (RTVI client messages):

- ``play-clip``: play the next premade clip, or the one named by ``{"clipId": ...}``.
- ``stop-clip``: stop the clip playing.

To the page (RTVI server messages): ``session``, once the page is ready, with the model asked and the
clips it can play, and the player's ``clip-started`` and ``clip-finished`` (see ``clips.py``).

Run it locally with ``uv run bot.py`` (SmallWebRTC, no account needed) or ``uv run bot.py -t daily``.
"""

from __future__ import annotations

import asyncio
import os

from dotenv import load_dotenv
from loguru import logger
from pipecat.audio.filters.base_audio_filter import BaseAudioFilter
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.classifiers.google.decisions.classifier import GoogleDecisionsClassifier
from pipecat.expressive.processors.perception_reader import PerceptionReader, PerceptionSource
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker, ProcessorUnusablePolicy
from pipecat.processors.audio.vad_processor import VADProcessor
from pipecat.processors.frameworks.rtvi import RTVIProcessor
from pipecat.processors.frameworks.rtvi.models import ClientMessage
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.daily.transport import DailyParams
from pipecat.turns.user_start import VADUserTurnStartStrategy
from pipecat.turns.user_stop import SpeechTimeoutUserTurnStopStrategy
from pipecat.turns.user_turn_processor import UserTurnProcessor
from pipecat.turns.user_turn_strategies import UserTurnStrategies
from pipecat.workers.runner import WorkerRunner

from clips import SAMPLE_RATE, ClipPlayer, load_clips
from perception import QUESTIONS

load_dotenv(override=True)

#: Seconds of silence after which the VAD says the speech stopped, and a read starts. Long enough that a
#: breath mid-sentence doesn't split a turn in two.
VAD_STOP_SECS = 0.6
#: Seconds of silence played after a clip: the VAD's wait, and room for its read to start before the next.
CLIP_SILENCE_SECS = VAD_STOP_SECS + 0.5
#: The longest a session lasts, in seconds. The demo is public and every read is a paid request.
SESSION_MAX_SECS = float(os.getenv("SESSION_MAX_SECS", "600"))


def microphone_filter() -> BaseAudioFilter | None:
    """Krisp's voice isolation for the microphone, on Pipecat Cloud only.

    Its SDK and model come with Pipecat Cloud's image, and the deployment turns it on (``krisp_viva`` in
    ``pcc-deploy.toml``). Pipecat's development runner sets ``ENV=local``, and there the microphone is heard
    as it is. A clip enters after the transport's input, so it is never filtered.
    """
    if os.environ.get("ENV") == "local":
        return None
    from pipecat.audio.filters.krisp_viva_filter import KrispVivaFilter

    return KrispVivaFilter()


# Lambdas defer building the parameters until the runner has picked the transport.
transport_params = {
    "daily": lambda: DailyParams(
        audio_in_enabled=True, audio_in_filter=microphone_filter(), audio_out_enabled=True
    ),
    "webrtc": lambda: TransportParams(
        audio_in_enabled=True, audio_in_filter=microphone_filter(), audio_out_enabled=True
    ),
}


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments):
    logger.info("Starting bot")

    # The premade clips, played in as the user's audio.
    clips = ClipPlayer(load_clips(), silence_secs=CLIP_SILENCE_SECS)

    vad = VADProcessor(vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=VAD_STOP_SECS)))

    stt = DeepgramSTTService(api_key=os.environ["DEEPGRAM_API_KEY"])

    # Google's Decisions API hears each stretch of speech and answers the questions about the voice. The
    # reader sets the answers as the transcription's perception, which reaches the page in RTVI's
    # user-input message.
    google = GoogleDecisionsClassifier(api_key=os.environ["GOOGLE_API_KEY"])
    reader = PerceptionReader(sources=[PerceptionSource(classifier=google, questions=QUESTIONS)])

    # A turn here is one stretch of speech, the same stretch the reader hears: it starts and stops with
    # the VAD, without waiting for its words. It goes before the STT, so the page learns the speech is
    # over before its reading arrives. Nothing speaks, so there is nothing for a turn to interrupt but
    # the clip being played out.
    user_turns = UserTurnProcessor(
        user_turn_strategies=UserTurnStrategies(
            start=[VADUserTurnStartStrategy(enable_interruptions=False)],
            stop=[SpeechTimeoutUserTurnStopStrategy(user_speech_timeout=0, wait_for_transcript=False)],
        )
    )

    pipeline = Pipeline(
        [
            transport.input(),  # The microphone
            clips,  # A premade clip, in the microphone's place
            vad,
            user_turns,
            stt,
            reader,  # How each turn was said, right after the STT whose transcriptions carry it
            transport.output(),  # The clip being played, to be heard
        ]
    )

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=SAMPLE_RATE,
            audio_out_sample_rate=SAMPLE_RATE,
            # The classifier's processing time is how long a read took.
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
        idle_timeout_secs=runner_args.pipeline_idle_timeout_secs,
        # Without Google there is nothing to show.
        processor_unusable_policy=ProcessorUnusablePolicy.END,
    )

    runner = WorkerRunner(handle_sigint=runner_args.handle_sigint)
    await runner.add_workers(worker)

    @worker.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi: RTVIProcessor):
        await rtvi.send_server_message(
            {
                "type": "session",
                "model": google.model,
                "clips": [clip.describe() for clip in clips.clips],
                "maxSecs": SESSION_MAX_SECS,
            }
        )

    @worker.rtvi.event_handler("on_client_message")
    async def on_client_message(rtvi: RTVIProcessor, message: ClientMessage):
        if message.type == "play-clip":
            clip_id = message.data.get("clipId") if isinstance(message.data, dict) else None
            if not await clips.play(clip_id):
                await rtvi.send_error_response(message, "There is no such clip to play")
        elif message.type == "stop-clip":
            clips.stop()
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
