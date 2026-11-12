"""Copy the demo's premade clips into ``server/clips/`` from a folder of mood takes.

    python prepare_clips.py /path/to/moods

The folder holds the takes' WAVs and a ``manifest.json`` listing each one: its ``id`` (``<mood>.<engine>.<take>``),
``path``, ``voice`` and ``text``. Keeps the takes named in ``TAKES`` for every mood, and writes them beside a
``manifest.json`` of the fields the demo shows, in the order the bot plays them: every mood in the first take's
voice, then every mood in the second's. The bot plays 16 kHz 16-bit mono WAVs as they are, so a take in any other
format stops the run. Standard library only.
"""

from __future__ import annotations

import argparse
import json
import shutil
import wave
from pathlib import Path

TARGET = Path(__file__).resolve().parent / "server" / "clips"

#: The takes kept for each mood, as ``<engine>.<take>`` in the mood manifest's ids.
TAKES = ("eleven-v4.a", "eleven-v4.b")
#: The order the moods are played in.
MOODS = ("neutral", "happy", "sad", "frustrated", "sarcastic", "laughing")

SAMPLE_RATE = 16000


def check_format(path: Path) -> float:
    """The clip's length in seconds, or a ValueError if it isn't 16 kHz 16-bit mono."""
    with wave.open(str(path), "rb") as wav:
        found = (wav.getframerate(), wav.getnchannels(), wav.getsampwidth())
        if found != (SAMPLE_RATE, 1, 2):
            raise ValueError(f"{path.name} is {found}, not 16 kHz 16-bit mono")
        return wav.getnframes() / SAMPLE_RATE


def prepare(source: Path, target: Path) -> list[dict[str, object]]:
    """Copy the kept takes into ``target`` and return their manifest, in the order they're played."""
    takes = {take["id"]: take for take in json.loads((source / "manifest.json").read_text())}
    target.mkdir(parents=True, exist_ok=True)
    for stale in target.glob("*.wav"):
        stale.unlink()

    clips: list[dict[str, object]] = []
    for kept in TAKES:
        for mood in MOODS:
            take = takes[f"{mood}.{kept}"]
            duration = check_format(source / take["path"])
            shutil.copyfile(source / take["path"], target / take["path"])
            clips.append(
                {
                    "id": take["id"],
                    "mood": mood,
                    "voice": take["voice"],
                    "text": take["text"],
                    "duration": round(duration, 2),
                    "file": take["path"],
                }
            )
    (target / "manifest.json").write_text(json.dumps(clips, indent=2) + "\n")
    return clips


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("source", type=Path, help="the folder of mood takes")
    parser.add_argument("--target", type=Path, default=TARGET, help="the bot's clips folder")
    args = parser.parse_args()
    clips = prepare(args.source, args.target)
    print(f"{len(clips)} clips in {args.target}")


if __name__ == "__main__":
    main()
