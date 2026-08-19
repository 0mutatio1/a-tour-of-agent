# Features

Legend:

- ✅ **Implemented** — shipped and working
- 🚧 **Upcoming** — designed, not yet implemented

---

## 🚧 Upcoming: Event-Based Streaming Framework

### Status

**Not implemented — planned.** This is the designed target for replacing/upgrading the current minimal streaming path (`POST /api/v1/chat` + raw delta frames).

The core idea, modeled after pi's architecture: the agent loop emits plain typed events and knows nothing about HTTP; FastAPI is only a thin transport adapter. The same event stream can then drive SSE, WebSocket, or in-process subscribers without changing the agent core.

### Goals

- Typed, uniform event contract shared by backend and frontend.
- Explicit message lifecycle (start/delta/end) instead of clients inferring state from raw deltas.
- Cancellation that actually stops upstream LLM work when the client disconnects.
- Tool-execution progress visible in the UI (streamed tool output).
- Same agent core reusable for future transports (WebSocket, JSONL replay, SDK-style subscription).

### 1. Event contract (single source of truth)

A discriminated-union event set, mirrored on both sides:

```typescript
// Shared event contract (server/events.py  ⇄  src/api/events.ts)
export type AgentEvent =
  | { type: "agent_start" }
  | { type: "turn_start"; turn: number }
  | { type: "message_start"; messageId: string }               // server assigns the id
  | { type: "thinking_delta"; messageId: string; delta: string }
  | { type: "text_delta"; messageId: string; delta: string }
  | { type: "message_end"; messageId: string; stopReason: string }
  | { type: "tool_execution_start"; id: string; name: string }
  | { type: "tool_execution_output"; id: string; delta: string }  // streamed tool output
  | { type: "tool_execution_end"; id: string; result: string; isError: boolean }
  | { type: "turn_end"; turn: number }
  | { type: "agent_end"; messageIds: string[] }
  | { type: "error"; code: string; message: string; recoverable: boolean }
  | { type: "done" };
```

Design decisions:

- Deltas are keyed by `messageId` so multiple concurrent messages are possible.
- Lifecycle is explicit (`message_start` / `message_end`) — the UI never guesses state.
- Errors are typed events, not thrown parser exceptions or the legacy `[DONE]` string.
- Provider event names (`response.output_text.delta`, …) are mapped in the adapter and never leak onto the wire, so providers can be swapped without touching the client.
- Server assigns message/tool ids (`uuid4`) so correlation is stable across retries.

### 2. Wire format (SSE framing)

Unchanged framing, richer payloads:

```
event: message_start
data: {"messageId":"msg_01"}

event: thinking_delta
data: {"messageId":"msg_01","delta":"thought token"}

event: text_delta
data: {"messageId":"msg_01","delta":"answer token"}

event: tool_execution_start
data: {"id":"call_1","name":"get_weather"}

event: done
```

- Terminate with a typed `event: done` (replaces the raw `data: [DONE]` line).
- Emit `: keepalive` comment frames every ~15s so proxies do not kill idle connections.

### 3. Server structure

Planned target layout:

```
server/
  events.py         # event dataclasses (the contract)
  sse.py            # event → SSE frame bytes
  hub.py            # asyncio task + queue manager (HTTP decoupled from the loop)
  agent.py          # Agent / AgentState — mostly unchanged
  agent_loop.py     # AgentLoop.run() reshaped to yield AgentEvent objects
  main.py           # endpoints + StreamingResponse adapter only
```

Key pieces:

- **Hub pattern:** a `StreamSession` owns an `asyncio.Task` + bounded `asyncio.Queue`. The loop pushes events onto the queue; the HTTP endpoint drains it. Gains: clean cancellation (`task.cancel()`), testability without HTTP, and reuse for WebSocket/broadcast later. Queue `maxsize` gives backpressure against slow clients.
- **Cancellation:** on client disconnect, Starlette closes the response generator → `GeneratorExit` → the drain loop's `finally` runs → `task.cancel()` → `CancelledError` tears down the OpenAI `async with` streams. Today the upstream stream keeps running after the browser aborts.
- **Streaming tool output:** tool execution accepts an `on_update` callback; each chunk becomes a `tool_execution_output` event (`AgentTool.execute` already has this parameter slot in the skeleton).
- Hub lifecycle tied to the existing FastAPI `lifespan`; shutdown cancels all active sessions.

### 4. Frontend structure

Planned target layout:

```
src/
  api/events.ts          # TS mirror of the contract (type guards)
  api/sse.ts             # low-level frame parser (extracted from chat-api.ts)
  api/session-client.ts  # SessionClient: run() + subscribe() + abort()
  chat.ts                # Pinia store consumes events (messageId-keyed)
  ChatView.vue           # rendering + scroll only; no direct SSE knowledge
```

Key pieces:

- `SessionClient` mirrors pi's `session.subscribe()`: owns the `fetch` lifecycle and `AbortController`, broadcasts typed events to listeners (`isStreaming`, `abort()`, `subscribe()`).
- Pinia store switches on `event.type`: `message_start` creates the assistant message, `text_delta` / `thinking_delta` append by `messageId`, `error` marks it `failed`.
- `ChatView.vue` keeps only rendering and auto-scroll.

### 5. Related fixes folded into this work

- Move hardcoded `api_key` / `base_url` out of `main.py` and `agent.py` into configuration/environment.
- Remove the redundant duplicate `/api/chat` route (superseded by the v1 Agent loop).
- Fix the `sse(sefl, …)` typo in `agent_loop.py`.
- Add a tool-round safety cap to `AgentLoop` (the inline route has `MAX_TOOL_ROUNDS = 4`; the loop currently has none).
- Clear out dead skeleton code in `agent_loop.py` / `agent.py` (commented `NextTurnContext`, `shouldStopAfterTurn`, `prepareNextTurn`, `turn_start`/`agent_end` comments) or wire it up deliberately (`steer()` / `followUp()` queueing).

### 6. Implementation order

1. Event contract (`server/events.py` + `src/api/events.ts`) plus a cross-language drift-check test.
2. Refactor `agent_loop.py` to yield events; clean up config/credentials.
3. Add `server/hub.py`; rework `main.py` route with drain loop, cancellation, heartbeat, headers.
4. Split frontend parser, add `SessionClient`, rewire the Pinia store.
5. Tool-execution streaming via `on_update`.
6. JSONL event persistence for replay/resume (future).

---

## ✅ Implemented (current)

### Minimal OpenAI-compatible streaming

- `POST /api/chat` — inline streaming relay with a `MAX_TOOL_ROUNDS` cap.
- `POST /api/v1/chat` — `Agent`/`AgentLoop` based streaming with sequential tool execution.
- SSE framing (`text/event-stream`) with `response.reasoning_text.delta` / `response.output_text.delta` / `error` event types and a `data: [DONE]` terminator.
- Frontend: `streamChat()` async generator in `src/chat-api.ts` with byte-level decoding and frame buffering; Pinia chat store in `src/chat.ts`; rendering in `ChatView.vue`.