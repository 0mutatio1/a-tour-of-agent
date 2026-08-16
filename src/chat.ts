import { defineStore } from "pinia";

export interface UserMessage {
  id: string;
  role: "user";
  content: string;
  createdAt: number;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  content: string;
  thinking: string;
  status: "pending" | "streaming" | "completed" | "stopped" | "failed";
  createdAt: number;
}

export type ChatMessage = UserMessage | AssistantMessage;

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface ConversationGroups {
  today: Conversation[];
  yesterday: Conversation[];
  earlier: Conversation[];
}

export interface MessageSearchResult {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface SearchExcerpt {
  before: string;
  match: string;
  after: string;
  leadingEllipsis: boolean;
  trailingEllipsis: boolean;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
}

const TITLE_LENGTH = 48;

function createTitle(prompt: string): string {
  const normalizedPrompt = prompt.replace(/\s+/g, " ").trim();
  return normalizedPrompt.length <= TITLE_LENGTH
    ? normalizedPrompt
    : `${normalizedPrompt.slice(0, TITLE_LENGTH - 1)}…`;
}

export function createSearchExcerpt(content: string, searchQuery: string): SearchExcerpt {
  const compactContent = content.replace(/\s+/g, " ").trim();
  const trimmedQuery = searchQuery.trim();
  const matchIndex = compactContent.toLocaleLowerCase().indexOf(trimmedQuery.toLocaleLowerCase());

  if (matchIndex < 0) {
    const end = Math.min(compactContent.length, 140);
    return {
      before: compactContent.slice(0, end),
      match: "",
      after: "",
      leadingEllipsis: false,
      trailingEllipsis: end < compactContent.length,
    };
  }

  const start = Math.max(0, matchIndex - 48);
  const end = Math.min(compactContent.length, matchIndex + trimmedQuery.length + 72);
  return {
    before: compactContent.slice(start, matchIndex),
    match: compactContent.slice(matchIndex, matchIndex + trimmedQuery.length),
    after: compactContent.slice(matchIndex + trimmedQuery.length, end),
    leadingEllipsis: start > 0,
    trailingEllipsis: end < compactContent.length,
  };
}

function findConversation(state: ChatState, conversationId: string): Conversation | undefined {
  return state.conversations.find((conversation) => conversation.id === conversationId);
}

export const useChatStore = defineStore("chat", {
  state: (): ChatState => ({
    conversations: [],
    activeConversationId: null,
  }),
  getters: {
    activeConversation(state): Conversation | null {
      if (state.activeConversationId === null) {
        return null;
      }
      return findConversation(state, state.activeConversationId) ?? null;
    },
    sortedConversations(state): Conversation[] {
      return [...state.conversations].sort(
        (left, right) => right.updatedAt - left.updatedAt,
      );
    },
    historyGroups(): ConversationGroups {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      const groups: ConversationGroups = {
        today: [],
        yesterday: [],
        earlier: [],
      };

      for (const conversation of this.sortedConversations) {
        if (conversation.updatedAt >= todayStart.getTime()) {
          groups.today.push(conversation);
        } else if (conversation.updatedAt >= yesterdayStart.getTime()) {
          groups.yesterday.push(conversation);
        } else {
          groups.earlier.push(conversation);
        }
      }

      return groups;
    },
    searchMessages(state): (query: string) => MessageSearchResult[] {
      return (query: string): MessageSearchResult[] => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        if (!normalizedQuery) {
          return [];
        }

        const results: MessageSearchResult[] = [];
        const conversations = [...state.conversations].sort(
          (left, right) => right.updatedAt - left.updatedAt,
        );

        for (const conversation of conversations) {
          const titleMatches = conversation.title.toLocaleLowerCase().includes(normalizedQuery);
          for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
            const message = conversation.messages[index];
            if (message === undefined) {
              continue;
            }
            const contentMatches = message.content.toLocaleLowerCase().includes(normalizedQuery);
            if (!contentMatches && !(index === 0 && titleMatches)) {
              continue;
            }
            results.push({
              conversationId: conversation.id,
              conversationTitle: conversation.title,
              messageId: message.id,
              role: message.role,
              content: message.content,
              createdAt: message.createdAt,
            });
          }
        }

        return results;
      };
    },
  },
  actions: {
    createConversation(firstPrompt: string): string | null {
      const prompt = firstPrompt.trim();
      if (!prompt) {
        return null;
      }

      const now = Date.now();
      const conversationId = crypto.randomUUID();
      const conversation: Conversation = {
        id: conversationId,
        title: createTitle(prompt),
        createdAt: now,
        updatedAt: now,
        messages: [
          {
            id: crypto.randomUUID(),
            role: "user",
            content: prompt,
            createdAt: now,
          },
        ],
      };

      this.conversations.push(conversation);
      this.activeConversationId = conversationId;
      return conversationId;
    },
    selectConversation(conversationId: string): boolean {
      if (findConversation(this, conversationId) === undefined) {
        return false;
      }
      this.activeConversationId = conversationId;
      return true;
    },
    startNewConversation(): void {
      this.activeConversationId = null;
    },
    addUserMessage(conversationId: string, content: string): string | null {
      const prompt = content.trim();
      const conversation = findConversation(this, conversationId);
      if (!prompt || conversation === undefined) {
        return null;
      }

      const now = Date.now();
      const messageId = crypto.randomUUID();
      conversation.messages.push({
        id: messageId,
        role: "user",
        content: prompt,
        createdAt: now,
      });
      conversation.updatedAt = now;
      return messageId;
    },
    addAssistantMessage(conversationId: string): string | null {
      const conversation = findConversation(this, conversationId);
      if (conversation === undefined) {
        return null;
      }

      const now = Date.now();
      const messageId = crypto.randomUUID();
      conversation.messages.push({
        id: messageId,
        role: "assistant",
        content: "",
        thinking: "",
        status: "pending",
        createdAt: now,
      });
      conversation.updatedAt = now;
      return messageId;
    },
    appendAssistantContent(
      conversationId: string,
      messageId: string,
      chunk: string,
    ): boolean {
      const conversation = findConversation(this, conversationId);
      const message = conversation?.messages.find(
        (candidate) => candidate.id === messageId && candidate.role === "assistant",
      );
      if (conversation === undefined || message?.role !== "assistant") {
        return false;
      }
      if (["completed", "stopped", "failed"].includes(message.status)) {
        return false;
      }

      message.content += chunk;
      message.status = "streaming";
      conversation.updatedAt = Date.now();
      return true;
    },
    appendAssistantThinking(
      conversationId: string,
      messageId: string,
      chunk: string,
    ): boolean {
      const conversation = findConversation(this, conversationId);
      const message = conversation?.messages.find(
        (candidate) => candidate.id === messageId && candidate.role === "assistant",
      );
      if (conversation === undefined || message?.role !== "assistant") {
        return false;
      }
      if (["completed", "stopped", "failed"].includes(message.status)) {
        return false;
      }

      message.thinking += chunk;
      message.status = "streaming";
      conversation.updatedAt = Date.now();
      return true;
    },
    finishAssistantMessage(
      conversationId: string,
      messageId: string,
      status: "completed" | "stopped" | "failed",
    ): boolean {
      const conversation = findConversation(this, conversationId);
      const message = conversation?.messages.find(
        (candidate) => candidate.id === messageId && candidate.role === "assistant",
      );
      if (conversation === undefined || message?.role !== "assistant") {
        return false;
      }
      if (["completed", "stopped", "failed"].includes(message.status)) {
        return false;
      }

      message.status = status;
      conversation.updatedAt = Date.now();
      return true;
    },
  },
});
