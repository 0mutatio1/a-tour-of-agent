export interface ChatChunk {
  type: "thinking" | "answer";
  text: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL?.trim() || "/api/chat";

export async function* streamChat(
  messages: Message[],
  signal: AbortSignal,
): AsyncGenerator<ChatChunk, void, void> {
  const response = await fetch(CHAT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!response.ok || response.body === null) {
    throw new Error(`Chat request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replaceAll("\r\n", "\n");
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const lines = frame.split("\n");
      const eventName = lines
        .find((line) => line.startsWith("event:"))
        ?.slice(6)
        .trim();
      const data = lines
        .find((line) => line.startsWith("data:"))
        ?.slice(5)
        .trimStart();
      if (!data || data === "[DONE]") {
        if (data === "[DONE]") {
          return;
        }
        continue;
      }
      const payload: unknown = JSON.parse(data);
      if (typeof payload !== "object" || payload === null) {
        continue;
      }
      if ("error" in payload && typeof payload.error === "string") {
        throw new Error(payload.error);
      }
      if ("delta" in payload && typeof payload.delta === "string") {
        if (eventName === "response.reasoning_text.delta") {
          yield { type: "thinking", text: payload.delta };
        } else if (eventName === "response.output_text.delta") {
          yield { type: "answer", text: payload.delta };
        }
      }
    }

    if (done) {
      return;
    }
  }
}
