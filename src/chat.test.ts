import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSearchExcerpt, useChatStore } from "./chat";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("chat store", () => {
  it("creates and selects a conversation from its first prompt", () => {
    vi.setSystemTime(new Date(2026, 7, 16, 9));
    const store = useChatStore();
    const conversationId = store.createConversation(
      "  Explain   how a streaming response reaches the browser and stays responsive  ",
    );

    expect(conversationId).not.toBeNull();
    expect(store.activeConversationId).toBe(conversationId);
    expect(store.activeConversation).toMatchObject({
      id: conversationId,
      title: "Explain how a streaming response reaches the br…",
      messages: [{ role: "user", content: "Explain   how a streaming response reaches the browser and stays responsive" }],
    });

    store.startNewConversation();
    expect(store.activeConversation).toBeNull();
    expect(store.selectConversation(conversationId ?? "")).toBe(true);
    expect(store.activeConversation?.id).toBe(conversationId);
  });

  it("adds messages and appends streamed assistant chunks", () => {
    const store = useChatStore();
    const conversationId = store.createConversation("Hello");
    expect(conversationId).not.toBeNull();
    if (conversationId === null) {
      return;
    }

    const assistantMessageId = store.addAssistantMessage(conversationId);
    expect(assistantMessageId).not.toBeNull();
    if (assistantMessageId === null) {
      return;
    }

    expect(store.appendAssistantThinking(conversationId, assistantMessageId, "Checking ")).toBe(true);
    expect(store.appendAssistantThinking(conversationId, assistantMessageId, "the details")).toBe(true);
    expect(store.appendAssistantContent(conversationId, assistantMessageId, "Hello ")).toBe(true);
    expect(store.appendAssistantContent(conversationId, assistantMessageId, "there.")).toBe(true);
    expect(store.addUserMessage(conversationId, "  Follow up  ")).not.toBeNull();

    expect(store.activeConversation?.messages).toEqual([
      expect.objectContaining({ role: "user", content: "Hello" }),
      expect.objectContaining({
        role: "assistant",
        thinking: "Checking the details",
        content: "Hello there.",
        status: "streaming",
      }),
      expect.objectContaining({ role: "user", content: "Follow up" }),
    ]);
  });

  it("sorts and groups conversations by their latest activity", () => {
    const store = useChatStore();

    vi.setSystemTime(new Date(2026, 7, 13, 12));
    const earlierId = store.createConversation("Earlier conversation");
    vi.setSystemTime(new Date(2026, 7, 15, 12));
    const yesterdayId = store.createConversation("Yesterday conversation");
    vi.setSystemTime(new Date(2026, 7, 16, 8));
    const todayId = store.createConversation("Today conversation");
    vi.setSystemTime(new Date(2026, 7, 16, 14));

    expect(store.sortedConversations.map((conversation) => conversation.id)).toEqual([
      todayId,
      yesterdayId,
      earlierId,
    ]);
    expect(store.historyGroups.today.map((conversation) => conversation.id)).toEqual([todayId]);
    expect(store.historyGroups.yesterday.map((conversation) => conversation.id)).toEqual([
      yesterdayId,
    ]);
    expect(store.historyGroups.earlier.map((conversation) => conversation.id)).toEqual([
      earlierId,
    ]);
  });

  it("updates a conversation independently from the active conversation", () => {
    const store = useChatStore();
    const firstConversationId = store.createConversation("First conversation");
    const secondConversationId = store.createConversation("Second conversation");
    expect(firstConversationId).not.toBeNull();
    expect(secondConversationId).not.toBeNull();
    if (firstConversationId === null || secondConversationId === null) {
      return;
    }

    const assistantMessageId = store.addAssistantMessage(firstConversationId);
    expect(assistantMessageId).not.toBeNull();
    if (assistantMessageId === null) {
      return;
    }

    expect(store.activeConversationId).toBe(secondConversationId);
    expect(
      store.appendAssistantContent(firstConversationId, assistantMessageId, "First answer"),
    ).toBe(true);
    expect(
      store.finishAssistantMessage(firstConversationId, assistantMessageId, "completed"),
    ).toBe(true);
    expect(
      store.appendAssistantContent(firstConversationId, assistantMessageId, "Too late"),
    ).toBe(false);
    expect(store.activeConversation?.messages).toHaveLength(1);
    expect(
      store.conversations.find((conversation) => conversation.id === firstConversationId)
        ?.messages,
    ).toEqual([
      expect.objectContaining({ role: "user", content: "First conversation" }),
      expect.objectContaining({
        role: "assistant",
        content: "First answer",
        status: "completed",
      }),
    ]);
  });

  it("searches user and assistant content without searching thinking text", () => {
    vi.setSystemTime(new Date(2026, 7, 16, 9));
    const store = useChatStore();
    const firstConversationId = store.createConversation("A visible user match");
    expect(firstConversationId).not.toBeNull();
    if (firstConversationId === null) {
      return;
    }
    const assistantMessageId = store.addAssistantMessage(firstConversationId);
    expect(assistantMessageId).not.toBeNull();
    if (assistantMessageId === null) {
      return;
    }
    store.appendAssistantThinking(firstConversationId, assistantMessageId, "Hidden keyword");
    store.appendAssistantContent(firstConversationId, assistantMessageId, "An assistant MATCH");
    store.finishAssistantMessage(firstConversationId, assistantMessageId, "completed");

    vi.setSystemTime(new Date(2026, 7, 16, 10));
    const secondConversationId = store.createConversation("Newest match");

    expect(store.searchMessages("MaTcH")).toEqual([
      expect.objectContaining({
        conversationId: secondConversationId,
        role: "user",
        content: "Newest match",
      }),
      expect.objectContaining({
        conversationId: firstConversationId,
        role: "assistant",
        content: "An assistant MATCH",
      }),
      expect.objectContaining({
        conversationId: firstConversationId,
        role: "user",
        content: "A visible user match",
      }),
    ]);
    expect(store.searchMessages("Hidden keyword")).toEqual([]);
    expect(store.searchMessages("   ")).toEqual([]);
  });

  it("creates bounded excerpts and preserves the matching text", () => {
    const excerpt = createSearchExcerpt(
      `${"before ".repeat(12)}Needle${" after".repeat(20)}`,
      "needle",
    );

    expect(excerpt.match).toBe("Needle");
    expect(excerpt.leadingEllipsis).toBe(true);
    expect(excerpt.trailingEllipsis).toBe(true);
    expect(`${excerpt.before}${excerpt.match}${excerpt.after}`).toContain("Needle");
  });

  it("rejects blank prompts and unknown conversation or message ids", () => {
    const store = useChatStore();

    expect(store.createConversation("   ")).toBeNull();
    expect(store.selectConversation("missing")).toBe(false);
    expect(store.addUserMessage("missing", "Hello")).toBeNull();
    expect(store.addAssistantMessage("missing")).toBeNull();
    expect(store.appendAssistantContent("missing", "missing", "text")).toBe(false);
    expect(store.appendAssistantThinking("missing", "missing", "text")).toBe(false);
    expect(store.finishAssistantMessage("missing", "missing", "failed")).toBe(false);
    expect(store.conversations).toEqual([]);
  });
});
