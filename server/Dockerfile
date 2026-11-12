# The bot's image for Pipecat Cloud. The base image runs bot.py's bot() for each session.
FROM dailyco/pipecat-base:0.4.0-py3.13

# Compile bytecode at build time, so a session doesn't pay for it at start.
ENV UV_COMPILE_BYTECODE=1
# Copy from the cache instead of linking, since it's a mounted volume.
ENV UV_LINK_MODE=copy

# Install the dependencies from the lockfile.
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-dev

COPY ./bot.py ./clips.py ./perception.py ./reporter.py ./
# The premade clips: put there by prepare_clips.py before the image is built.
COPY ./clips ./clips
