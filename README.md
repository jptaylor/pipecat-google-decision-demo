# Voice perception demo (Google Decisions)

A hosted, listen-only demo: play a premade clip or open the microphone, and see what Google's Decisions API
(`gemini-decision-1`) hears in the voice, turn by turn. There is no speech-to-text, LLM or TTS.

- `server/`: the Pipecat bot (Pipecat 1.16), deployed to Pipecat Cloud.
- `client/`: the page (Vite, React 19, Tailwind 4, shadcn, Zustand), with the glass pill's source in it.
- `prepare_clips.py`: copies the premade clips into `server/clips/`.

## How it works

```
transport input -> ClipPlayer -> Silero VAD -> PerceptionReader (Google) -> PerceptionReporter -> transport output
```

Each time the VAD says the speech stopped, the reader sends that stretch of audio to Google with five
questions (`server/perception.py`): `tone`, `arousal`, `laughter`, `speech_rate` and `sarcasm`. The reporter
tells the page what came back and how long the read took, as RTVI server messages (listed in
`server/reporter.py`).

A clip is played into the pipeline just after the transport's input, in real time, so it takes the same road
as the microphone. The same audio is sent out through the transport, so the visitor hears the clip as the
model does. The microphone isn't heard while a clip plays.

The page has two controls. **Play** plays the next clip (the bot goes round its list), and stops it if pressed
again. **Mic** opens the microphone. Either one starts a session first if there isn't one. The pill follows the
turn: its light moves with the voice, it turns over while the model reads, and it takes the colour of the tone
the model heard.

## Run it locally

The clips first. They are synthetic audio, kept out of git: `server/clips/manifest.json` lists them, and
`prepare_clips.py` copies their WAVs (16 kHz, 16-bit, mono) in from a folder of mood takes that holds a
`manifest.json` of its own:

```bash
python prepare_clips.py /path/to/moods
```

Without them the bot still runs, with the microphone alone.

Then the bot, which needs `GOOGLE_API_KEY` (in `server/.env`; see `server/env.example`):

```bash
cd server && uv sync && uv run bot.py
```

And the page, in another terminal:

```bash
cd client && cp env.example .env.local && npm install && npm run dev
```

Locally the two talk over SmallWebRTC, which needs no Daily account: `VITE_TRANSPORT=smallwebrtc` in
`.env.local`, and Vite proxies `/api` to the bot's runner on port 7860 (`BOT_URL`).

To run the local page against the bot deployed on Pipecat Cloud instead, put `PIPECAT_CLOUD_AGENT_NAME` and
`PIPECAT_CLOUD_PUBLIC_KEY` in `.env.local` and leave `VITE_TRANSPORT` out: the dev server then answers
`/api/start` itself, with the same function production runs.

## Checks

```bash
cd server && uv run pytest && uv run ruff check . && uv run ruff format --check .
cd client && npm run typecheck && npm run lint && npm run build
```

## Deploy

**The bot**, to Pipecat Cloud, from `server/` (`uv tool install "pipecat-ai[cli]" --with pipecatcloud` for the
CLI). Run `prepare_clips.py` first: the image is built from the folder as it is, clips included.

```bash
pipecat cloud auth login
pipecat cloud secrets set google-perception-demo-secrets GOOGLE_API_KEY=...
pipecat cloud deploy
```

`pcc-deploy.toml` names the agent `google-perception-demo`, turns on Krisp's voice isolation for the microphone
and keeps 15 instances warm (`min_agents`), which are billed whether or not anyone is using them. A session ends when the visitor leaves, after five minutes
without speech, or after `SESSION_MAX_SECS` (600 by default), whichever comes first.

**The page**, to a static host that can run one function. In production the page connects over Daily
(leave `VITE_TRANSPORT` unset) and starts a session by POSTing to `/api/start`, which is `client/api/start.ts`:
it asks Pipecat Cloud for a session with the public API key, so the key never reaches the browser. It is
written for Vercel's `api/` folder; on another host, mount its `POST` at `/api/start`. Set on that host:

- `PIPECAT_CLOUD_AGENT_NAME`: `google-perception-demo`
- `PIPECAT_CLOUD_PUBLIC_KEY`: a public key from `pipecat cloud organizations keys create`

The glass pill is the source of the `webgl-pill` project (0.3.0), in `client/src/components/pill/webgl-pill/`.
It is kept as it is there: it type-checks under its own settings (`client/tsconfig.pill.json`) and isn't held to
the app's lint or formatting rules.

## Changing what it reads

The questions are `QUESTIONS` in `server/perception.py`. The page lays out those five signals by name
(`client/src/lib/perception.ts`), so a change to one is a change to the other. The clips are the takes named
in `prepare_clips.py`, in the order the bot plays them.
