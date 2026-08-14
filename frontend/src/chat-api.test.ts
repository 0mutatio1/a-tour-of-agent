import { afterEach, describe, expect, it, vi } from "vitest";

import { streamChat } from "./chat-api";

afterEach(() => vi.unstubAllGlobals());

describe("streamChat", () => {
  it("separates thinking and answer SSE chunks", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: response.reasoning_text.delta\ndata: {"delta":"Checking"}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'event: response.output_text.delta\ndata: {"delta":"Answer"}\n\ndata: [DONE]\n\n',
          ),
        );
        controller.close();
      },
    });
    const fetcher = vi.fn(async () => new Response(body));
    vi.stubGlobal("fetch", fetcher);

    const chunks = [];
    for await (const chunk of streamChat([{ role: "user", content: "Hi" }], new AbortController().signal)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { type: "thinking", text: "Checking" },
      { type: "answer", text: "Answer" },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fails for HTTP and streamed provider errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    await expect(
      streamChat([{ role: "user", content: "Hi" }], new AbortController().signal).next(),
    ).rejects.toThrow("Chat request failed (500)");

    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('event: error\ndata: {"error":"Model failed"}\n\n'),
        );
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));
    await expect(
      streamChat([{ role: "user", content: "Hi" }], new AbortController().signal).next(),
    ).rejects.toThrow("Model failed");
  });
});
