# Orbit chat

One Vercel project containing a desktop-first Vue client and a stateless FastAPI
streaming endpoint. Messages live only in memory, and every prompt is sent
independently to the Python backend.

## Run the backend

Create the Python environment from the repository root:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
export OPENAI_API_KEY="your-api-key"
export OPENAI_MODEL="a-model-you-can-access"
.venv/bin/python -m uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload
```

Set `OPENAI_BASE_URL` when using an OpenAI-compatible provider endpoint.

## Run the frontend

In another terminal at the repository root:

```sh
npm ci --ignore-scripts
npm run dev
```

Vite proxies `POST /api/chat` to `http://127.0.0.1:8000`. The interface targets
desktop web viewports at least 1024 pixels wide.

## Deploy to Vercel

Create one Vercel project from the repository root and keep the Vite framework
preset. Leave Root Directory empty. Add `OPENAI_API_KEY` and `OPENAI_MODEL` as
Production and Preview environment variables. Add `OPENAI_BASE_URL` when using
an OpenAI-compatible provider.

Vercel builds `api/index.py` as the same project's Python function, so the
browser's `POST /api/chat` request stays on the deployment's own origin. No
frontend API URL or cross-origin configuration is required.

## Commands

```sh
npm run dev
npm run typecheck
npm test
npm run build
```

## Implemented scope

- Vue 3, TypeScript, Vite, Pinia, and Vue Router
- One in-memory transcript with user messages on the right and streamed plain text on the left
- Plain streamed text from the Python relay
- Collapsible desktop sidebar with New chat and the account menu

There is no conversation persistence, history, search, file upload, provider
selection, multi-turn model context, or Axios dependency.

## Source layout

```text
api/
  index.py           Vercel FastAPI entrypoint
server/
  main.py            streamed chat endpoint and tool loop
src/
  App.vue             app shell and notices
  Sidebar.vue         navigation, logo, and account menu
  ChatView.vue        transcript, composer, and message presentation
  chat-api.ts         fetch and streamed-text reading
  Icon.vue            shared inline icons
  SettingsView.vue    settings placeholder
  ui.ts               small Pinia UI store
  main.ts             router and app bootstrap
  style.css           global tokens and resets
```
