# Orbit chat frontend

Desktop-first Vue client for one stateless streaming chat dialog. Messages live only in memory, and every prompt is sent independently to the Python backend.

## Run the backend

From the repository root:

```sh
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
export OPENAI_API_KEY="your-api-key"
export OPENAI_MODEL="a-model-you-can-access"
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

## Run the frontend

In another terminal:

```sh
cd frontend
npm ci --ignore-scripts
npm run dev
```

Vite proxies `POST /api/chat` to `http://127.0.0.1:8000`. The interface targets desktop web viewports at least 1024 pixels wide.

## Deploy to Vercel

Deploy `backend` first, then create a second Vercel project whose Root Directory
is `frontend`. Keep the Vite framework preset and add this environment variable
for Production and Preview before deploying:

```sh
VITE_CHAT_API_URL=https://your-backend.vercel.app/api/chat
```

Also set the backend project's `FRONTEND_ORIGINS` to this frontend deployment's
origin, for example `https://your-frontend.vercel.app`, then redeploy the
backend. `VITE_CHAT_API_URL` is embedded during the Vite build, so redeploy the
frontend whenever it changes.

The relative `/api/chat` fallback remains for local development only. Vite's
development proxy is not part of the production bundle, which is why a frontend
deployment without `VITE_CHAT_API_URL` returns a Vercel 404.

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

There is no conversation persistence, history, search, file upload, provider selection, multi-turn model context, or Axios dependency.

## Source layout

The application intentionally keeps a flat structure:

```text
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
