# Minimal OpenAI streaming backend

A stateless FastAPI endpoint that relays streamed text from an OpenAI-compatible
Responses API. It has no database, conversation storage, uploads, authentication,
or custom stream protocol. A small example `get_weather` function demonstrates
the Responses API tool-call continuation flow.

## Setup

Python 3.11 or newer is required.

```sh
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
export OPENAI_API_KEY="your-api-key"
export OPENAI_MODEL="a-model-you-can-access"
export FRONTEND_ORIGINS="https://your-frontend.vercel.app"
```

Set `OPENAI_BASE_URL` only when using an OpenAI-compatible provider endpoint.

The `.env.example` file documents the required variables; the application does
not load `.env` files automatically.

## Run

```sh
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

## Stream a response

```sh
curl -N http://127.0.0.1:8000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

The response uses `text/event-stream`. Provider reasoning summaries and final
answer text are streamed separately using their native event names:

- `response.reasoning_text.delta`
- `response.output_text.delta`

Both event payloads use `data: {"delta":"..."}`. The final frame is
`data: [DONE]`.

## Deploy to Vercel

Create a Vercel project whose Root Directory is `backend`. Vercel loads the
FastAPI application through `index.py`; do not set a build command or output
directory. Add these project environment variables for Production and Preview:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL` when using a compatible provider
- `FRONTEND_ORIGINS`, as a comma-separated list of allowed frontend origins

After deploying, the endpoint is
`https://your-backend.vercel.app/api/chat`. A browser GET will return `405`
because the endpoint intentionally accepts only POST requests; `404` means the
backend project or request URL is not configured correctly.
