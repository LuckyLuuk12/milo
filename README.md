# Milo

Milo is a chatbot that helps students deal with stress: about a study task, about a specific situation outside their studies, or without a clear cause. It asks a few questions and suggests a small, realistic next step.

## How it works

```
Browser ──► SvelteKit dev server (:5173) ──/api──► Flask (:3000) ──► Rasa Pro (:5005)
```

- **Rasa Pro (CALM)** runs the conversation. Flows are in `data/flows.yml`, responses and slots in `domain.yml`, and the advice at the end of each flow comes from the custom actions in `actions/actions.py`.
- **Flask** (`app.py`) is a small proxy between the frontend and Rasa. Every conversation has its own Rasa sender ID, so conversations and users never share state.
- **SvelteKit** (`svelte-frontend/`) is the chat UI. Profiles are stored in `localStorage` and conversations in IndexedDB, so everything stays in the user's browser.

Only the SvelteKit dev server is reachable from outside. Flask and Rasa listen on `127.0.0.1`, and Rasa's HTTP API (`--enable-api`) is disabled, because it gives read and write access to every conversation.

## Getting started

It's recommended to run this repository in GitHub Codespaces (in GitHub, press the green 'Code' button and then Codespaces), or in VS Code with the Dev Containers extension. The dev container installs Python, Rasa Pro and Bun, and enables the git hooks.

To set things up manually instead:

```bash
pip install -U pip uv
uv venv
source .venv/bin/activate
uv pip install --extra-index-url https://europe-west3-python.pkg.dev/rasa-releases/rasa-pro-python/simple rasa-pro
uv pip install -r requirements.txt
curl -fsSL https://bun.sh/install | bash
git config core.hooksPath .githooks
```

Create a file called `.env` containing your license key:

```
RASA_LICENSE=<the Rasa license key you received when creating your developer account>
```

Then train the Rasa model. Train again whenever you change `domain.yml`, `config.yml` or anything in `data/`:

```bash
rasa train
```

## Running the application

```bash
./run.sh
```

This script starts Rasa (and waits until it is ready), the Flask API and the SvelteKit dev server. On the first run it also installs the frontend dependencies. Press `Ctrl+C` to stop everything.

Open `http://localhost:5173`, or in Codespaces the forwarded URL for port 5173 (`<your-codespace-name>-5173.app.github.dev`).

To start the services manually instead, use three terminals:

```bash
rasa run --interface 127.0.0.1 --port 5005
python -m flask --app app run --host 127.0.0.1 --port 3000
cd svelte-frontend && bun run dev -- --host 0.0.0.0
```

## Development

- **Type checking:** a pre-commit hook runs `svelte-check` whenever a commit touches `svelte-frontend/`. You can run it yourself with `cd svelte-frontend && bun run check`, and the linter with `bun run lint`.
- **Rasa data:** run `rasa data validate` after changing flows or the domain.
- **Custom actions:** every `action_...` step in a flow must be listed under `actions:` in `domain.yml` *and* implemented in `actions/actions.py`. Otherwise the flow fails as soon as it reaches that step.
- **Rephrasing:** responses with `rephrase: true` are rewritten by the LLM. The crisis responses and Rasa's system messages (cancelling, resuming and finishing a flow) deliberately use `rephrase: false`, so the LLM cannot change them.

## Crisis support

When a user mentions suicidal thoughts, self-harm or being in danger, the `crisis_support` flow refers them to 112 and 113 Suicide Prevention (113 or 0800-0113, or chat at 113.nl) with a fixed message. Recognising these messages depends on the LLM and is not guaranteed. Milo is not a replacement for professional help.

## Project structure

| Path | Contents |
| --- | --- |
| `data/flows.yml` | Conversation flows, including `crisis_support` |
| `data/patterns.yml` | Overrides of Rasa's built-in conversation patterns |
| `domain.yml` | Slots, responses and the list of custom actions |
| `actions/actions.py` | Custom actions that pick the advice |
| `config.yml`, `endpoints.yml` | Rasa pipeline, LLM and endpoint configuration |
| `app.py` | Flask proxy between the frontend and Rasa |
| `run.sh` | Starts all three services |
| `svelte-frontend/` | SvelteKit chat UI |
| `.githooks/` | Git hooks (pre-commit type check) |
