"""The demo's premade clips, and the processor that plays one into the pipeline as if the user had said it.

A clip goes in just after the transport's input, 20 ms at a time in real time, so the VAD finds its speech and
the reader hears it exactly as it would a caller's. The same audio goes out through the transport, so the visitor
hears the clip as the model does. The microphone isn't heard while a clip plays.
"""

from __future__ import annotations

import asyncio
import json
import wave
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

from loguru import logger
from pipecat.frames.frames import Frame, InputAudioRawFrame, OutputAudioRawFrame, SystemFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

SAMPLE_RATE = 16000
CLIPS_DIR = Path(__file__).resolve().parent / "clips"

_CHUNK_SECS = 0.02
_CHUNK_BYTES = int(SAMPLE_RATE * _CHUNK_SECS) * 2  # 16-bit mono


@dataclass(frozen=True)
class Clip:
    """One premade clip.

    Parameters:
        id: Its name in messages to and from the page.
        mood: How it was said, such as ``"sarcastic"``.
        voice: Who says it.
        text: Its words.
        duration: Its length in seconds.
        audio: Its sound, 16 kHz 16-bit mono PCM.
    """

    id: str
    mood: str
    voice: str
    text: str
    duration: float
    audio: bytes

    def describe(self) -> dict[str, Any]:
        """The clip as the page lists it."""
        return {
            "id": self.id,
            "mood": self.mood,
            "voice": self.voice,
            "text": self.text,
            "duration": self.duration,
        }


@cache
def load_clips(folder: Path = CLIPS_DIR) -> dict[str, Clip]:
    """The clips in a folder's ``manifest.json``, by id, in the manifest's order. Loaded once a process.

    A clip whose file is missing or isn't 16 kHz 16-bit mono is left out with a warning, so a folder that
    was never filled leaves the demo with the microphone alone.
    """
    manifest = folder / "manifest.json"
    if not manifest.is_file():
        logger.warning(f"No clips: {manifest} is missing (run prepare_clips.py)")
        return {}
    clips: dict[str, Clip] = {}
    for entry in json.loads(manifest.read_text()):
        try:
            audio = _read_wav(folder / entry["file"])
        except (OSError, ValueError, wave.Error) as e:
            logger.warning(f"Clip {entry['id']} is left out: {e}")
            continue
        clips[entry["id"]] = Clip(
            id=entry["id"],
            mood=entry["mood"],
            voice=entry["voice"],
            text=entry["text"],
            duration=len(audio) / 2 / SAMPLE_RATE,
            audio=audio,
        )
    return clips


def _read_wav(path: Path) -> bytes:
    """A WAV file's samples, or a ValueError if it isn't 16 kHz 16-bit mono."""
    with wave.open(str(path), "rb") as wav:
        found = (wav.getframerate(), wav.getnchannels(), wav.getsampwidth())
        if found != (SAMPLE_RATE, 1, 2):
            raise ValueError(f"{path.name} is {found}, not 16 kHz 16-bit mono")
        return wav.readframes(wav.getnframes())


@dataclass
class ClipStartedFrame(SystemFrame):
    """A clip has started playing into the pipeline.

    Parameters:
        clip: The clip.
    """

    clip: Clip


@dataclass
class ClipFinishedFrame(SystemFrame):
    """A clip is over, with the silence after it: what's heard next is the microphone.

    Parameters:
        clip: The clip.
        completed: Whether it played to its end, rather than being stopped.
    """

    clip: Clip
    completed: bool


class ClipPlayer(FrameProcessor):
    """Plays a clip into the pipeline as the user's audio, and out through the transport to be heard.

    Goes right after the transport's input. While a clip plays, the microphone's audio is dropped and the
    clip's takes its place, followed by enough silence for the VAD to find the end of its speech. A
    ``ClipStartedFrame`` goes downstream before the clip's first audio and a ``ClipFinishedFrame`` after that
    silence. One clip plays at a time: playing another stops the one playing first.
    """

    def __init__(self, *, silence_secs: float, **kwargs):
        """Initialize the player.

        Args:
            silence_secs: Seconds of silence played after a clip, longer than the VAD waits before it
                says the speech stopped.
            **kwargs: Additional arguments passed to the parent.
        """
        super().__init__(**kwargs)
        self._silence = bytes(_CHUNK_BYTES) * round(silence_secs / _CHUNK_SECS)
        self._playing: asyncio.Task | None = None
        # Set to stop the latest clip asked for. Each clip has its own, so stopping one that waits its
        # turn doesn't stop the one after it.
        self._stop = asyncio.Event()

    @property
    def playing(self) -> bool:
        """Whether a clip, or the silence after it, is being played."""
        return self._playing is not None and not self._playing.done()

    async def play(self, clip: Clip):
        """Play a clip, once any clip already playing has been stopped and its silence played."""
        self.stop()
        self._stop = asyncio.Event()
        self._playing = self.create_task(self._play(clip, self._stop, after=self._playing))

    def stop(self):
        """Stop the clip playing, if any. Its silence is still played, so the VAD ends its speech."""
        self._stop.set()

    async def cleanup(self):
        await super().cleanup()
        if self._playing:
            await self.cancel_task(self._playing)
            self._playing = None

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, InputAudioRawFrame) and self.playing:
            return  # the microphone isn't heard over a clip
        await self.push_frame(frame, direction)

    async def _play(self, clip: Clip, stop: asyncio.Event, *, after: asyncio.Task | None):
        if after:
            # A wait that doesn't cancel the earlier clip's silence, nor fails if it was cancelled.
            await asyncio.wait({after})
        if stop.is_set():
            return  # stopped while it waited its turn: none of it was heard
        await self.push_frame(ClipStartedFrame(clip=clip))
        completed = await self._feed(clip.audio, stop)
        await self._feed(self._silence)
        await self.push_frame(ClipFinishedFrame(clip=clip, completed=completed))

    async def _feed(self, audio: bytes, stop: asyncio.Event | None = None) -> bool:
        """Push audio in as the user's, in real time. Returns False if it was stopped before its end.

        A clip, which comes with ``stop``, also goes out through the transport to be heard. The silence
        after it has none: it's played whole, since the VAD needs all of it, and isn't sent out.
        """
        loop = asyncio.get_running_loop()
        started = loop.time()
        for index, offset in enumerate(range(0, len(audio), _CHUNK_BYTES)):
            if stop and stop.is_set():
                return False
            chunk = audio[offset : offset + _CHUNK_BYTES]
            await self.push_frame(InputAudioRawFrame(audio=chunk, sample_rate=SAMPLE_RATE, num_channels=1))
            if stop:
                await self.push_frame(
                    OutputAudioRawFrame(audio=chunk, sample_rate=SAMPLE_RATE, num_channels=1)
                )
            # Paced against the audio's start, so the sleeps' overshoot doesn't add up.
            await asyncio.sleep(max(0.0, started + (index + 1) * _CHUNK_SECS - loop.time()))
        return True
