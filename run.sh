#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${ROOT_DIR}/.venv"
FRONTEND_DIR="${ROOT_DIR}/svelte-frontend"

RASA_PID=""
FLASK_PID=""
SVELTE_PID=""
CLEANING_UP=0

cleanup() {
    if [[ "$CLEANING_UP" -eq 1 ]]; then
        return
    fi

    CLEANING_UP=1
    trap - INT TERM EXIT

    echo
    echo "Stopping chatbot servers..."

    for pid in "$SVELTE_PID" "$FLASK_PID" "$RASA_PID"; do
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done

    for pid in "$SVELTE_PID" "$FLASK_PID" "$RASA_PID"; do
        if [[ -n "$pid" ]]; then
            wait "$pid" 2>/dev/null || true
        fi
    done

    echo "All servers stopped."
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

fail() {
    echo "Error: $*" >&2
    exit 1
}

# Verify required tools.
command -v python >/dev/null 2>&1 ||
    fail "Python is not installed or is not available on PATH."

command -v bun >/dev/null 2>&1 ||
    fail "Bun is not installed or is not available on PATH."

# Activate the Python virtual environment when available.
if [[ -f "${VENV_DIR}/bin/activate" ]]; then
    echo "Activating Python virtual environment..."
    # shellcheck disable=SC1091
    source "${VENV_DIR}/bin/activate"
elif [[ -f "${ROOT_DIR}/venv/bin/activate" ]]; then
    echo "Activating legacy Python virtual environment..."
    # shellcheck disable=SC1091
    source "${ROOT_DIR}/venv/bin/activate"
else
    echo "Warning: No .venv or venv virtual environment found."
    echo "Using the Python environment available on PATH."
fi

# Verify backend dependencies and frontend files.
python -c "import flask, flask_cors, requests" ||
    fail "Flask dependencies are missing. Install requirements.txt first."

command -v rasa >/dev/null 2>&1 ||
    fail "Rasa is not installed in the active Python environment."

[[ -f "${FRONTEND_DIR}/package.json" ]] ||
    fail "SvelteKit package.json not found at ${FRONTEND_DIR}."

# Install frontend dependencies if necessary.
if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
    echo "Installing SvelteKit dependencies..."
    (
        cd "${FRONTEND_DIR}"
        bun install
    ) || fail "Failed to install SvelteKit dependencies."
fi

# Start Rasa.
echo "Starting Rasa on port 5005..."
(
    cd "${ROOT_DIR}"
    # Only Flask talks to Rasa, so listen on localhost and keep the HTTP API
    # (which can read and modify every conversation) disabled.
    exec rasa run --interface 127.0.0.1 --port 5005
) &
RASA_PID=$!

# Wait for Rasa to become available, rather than sleeping for a fixed period.
echo "Waiting for Rasa..."
RASA_READY=0

for _ in {1..360}; do
    if ! kill -0 "$RASA_PID" 2>/dev/null; then
        wait "$RASA_PID" || true
        fail "Rasa exited before becoming ready."
    fi

    if python -c \
        "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5005/webhooks/rest/', timeout=1)" \
        >/dev/null 2>&1; then
        RASA_READY=1
        break
    fi

    sleep 1
done

if [[ "$RASA_READY" -ne 1 ]]; then
    fail "Rasa did not become available within 360 seconds."
fi

# Start Flask API.
echo "Starting Flask API on port 3000..."
(
    cd "${ROOT_DIR}"
    exec python -m flask --app app run --host 127.0.0.1 --port 3000
) &
FLASK_PID=$!

# Start SvelteKit development server.
echo "Starting SvelteKit on port 5173..."
(
    cd "${FRONTEND_DIR}"
    exec bun run dev -- --host 0.0.0.0
) &
SVELTE_PID=$!

echo
echo "Chatbot development environment started."
echo "  Frontend: http://localhost:5173"
echo "  Flask API: http://localhost:3000"
echo "  Rasa API:  http://localhost:5005"
echo
echo "Press Ctrl+C to stop all servers."

# Monitor all services. Exit if any service exits, then clean up the rest.
while true; do
    for service in "Rasa:${RASA_PID}" "Flask:${FLASK_PID}" "SvelteKit:${SVELTE_PID}"; do
        name="${service%%:*}"
        pid="${service#*:}"

        if ! kill -0 "$pid" 2>/dev/null; then
            echo "Error: ${name} stopped unexpectedly." >&2
            exit 1
        fi
    done

    sleep 2
done
