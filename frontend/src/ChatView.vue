<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";

import { streamChat } from "./chat-api";
import { renderMarkdown } from "./markdown";
import { useUiStore } from "./ui";

type Message =
  | { id: string; role: "user"; content: string }
  | {
      id: string;
      role: "assistant";
      content: string;
      thinking: string;
      thinkingOpen: boolean;
    };
type AssistantMessage = Extract<Message, { role: "assistant" }>;

const uiStore = useUiStore();
const messages = ref<Message[]>([]);
const draft = ref("");
const loading = ref(false);
const messageList = ref<HTMLElement | null>(null);
const composerInput = ref<HTMLInputElement | null>(null);
let activeRequest: AbortController | null = null;

watch(
  () => uiStore.dialogResetVersion,
  () => {
    activeRequest?.abort();
    activeRequest = null;
    loading.value = false;
    messages.value = [];
  },
);

async function sendMessage(): Promise<void> {
  const prompt = draft.value.trim();
  if (!prompt || loading.value) {
    return;
  }

  draft.value = "";
  const reply = reactive<AssistantMessage>({
    id: crypto.randomUUID(),
    role: "assistant",
    content: "",
    thinking: "",
    thinkingOpen: true,
  });
  messages.value.push(
    { id: crypto.randomUUID(), role: "user", content: prompt },
    reply,
  );

  const history = messages.value
    .filter((message) => message.role !== "assistant" || message.content.length > 0)
    .map((message) =>
      message.role === "assistant"
        ? {
            role: "assistant" as const,
            content: [message.thinking, message.content].filter(Boolean).join("\n\n"),
          }
        : { role: "user" as const, content: message.content },
    );

  const request = new AbortController();
  activeRequest = request;
  loading.value = true;

  try {
    for await (const chunk of streamChat(history, request.signal)) {
      if (chunk.type === "thinking") {
        reply.thinking += chunk.text;
      } else {
        reply.content += chunk.text;
      }
      await nextTick();
      if (chunk.type === "thinking") {
        const thinkingContent = document.getElementById(`thinking-${reply.id}`);
        thinkingContent?.scrollTo({ top: thinkingContent.scrollHeight });
      }
      messageList.value?.scrollTo({ top: messageList.value.scrollHeight });
    }
  } catch {
    if (!request.signal.aborted && reply.content.length === 0) {
      reply.content = "Something went wrong.";
    }
  } finally {
    reply.thinkingOpen = false;
    if (activeRequest === request) {
      activeRequest = null;
      loading.value = false;
      await nextTick();
      composerInput.value?.focus();
    }
  }
}

onBeforeUnmount(() => activeRequest?.abort());
</script>

<template>
  <section class="chat-view" aria-label="Chat dialog">
    <div ref="messageList" class="message-list" role="log" aria-label="Messages">
      <div v-for="message in messages" :key="message.id" class="message-column">
        <p v-if="message.role === 'user'" class="message message--user">{{ message.content }}</p>
        <div v-else class="message message--assistant">
          <div v-if="message.thinking" class="thinking">
            <button
              class="thinking__toggle"
              type="button"
              :aria-expanded="message.thinkingOpen"
              :aria-controls="`thinking-${message.id}`"
              @click="message.thinkingOpen = !message.thinkingOpen"
            >
              <span>{{ message.thinkingOpen ? "Hide thinking" : "Show thinking" }}</span>
              <span class="thinking__chevron" aria-hidden="true">⌄</span>
            </button>
            <div
              v-if="message.thinkingOpen"
              :id="`thinking-${message.id}`"
              class="thinking__content"
              v-html="renderMarkdown(message.thinking)"
            ></div>
          </div>
          <div v-if="message.content" class="answer" v-html="renderMarkdown(message.content)"></div>
          <div v-else class="answer-loader" role="status" aria-label="Generating answer">
            <span class="sr-only">Generating answer</span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </div>
        </div>
      </div>
    </div>

    <div class="composer-wrap">
      <form class="chat-composer" aria-label="Message composer" @submit.prevent="sendMessage">
        <input
          ref="composerInput"
          v-model="draft"
          class="chat-composer__input"
          type="text"
          aria-label="Message"
          placeholder="Ask anything"
          autocomplete="off"
          autofocus
          :disabled="loading"
          @keydown.enter.prevent="sendMessage"
        />
      </form>
      <p class="composer-disclaimer">It make mistakes. Check important info.</p>
    </div>
  </section>
</template>

<style scoped>
.chat-view {
  position: relative;
  height: 100dvh;
  min-height: 500px;
  overflow: hidden;
  background: var(--color-canvas);
}

.message-list {
  position: absolute;
  inset: 0 0 104px;
  overflow-y: auto;
  padding: 54px 48px 22px;
  scrollbar-color: var(--color-border-strong) transparent;
  scrollbar-width: thin;
}

.message-column {
  position: relative;
  left: 15px;
  width: min(100%, 940px);
  margin: 0 auto 32px;
}

.message {
  margin: 0;
  color: var(--color-text-strong);
  font-size: 15px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.message--user {
  width: min(66%, 612px);
  margin-left: auto;
  padding: 17px 18px;
  border: 1px solid var(--color-border-strong);
  border-radius: 10px;
  background: #fbfcfe;
  white-space: pre-wrap;
}

.message--assistant {
  width: min(100%, 650px);
  margin-left: 62px;
}

.thinking {
  margin-bottom: 16px;
  border-left: 2px solid var(--color-border-strong);
  padding-left: 14px;
  color: var(--color-text-muted);
}

.thinking__toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.thinking__toggle:focus-visible {
  border-radius: 3px;
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
}

.thinking__chevron {
  transition: transform 150ms ease;
}

.thinking__toggle[aria-expanded="true"] .thinking__chevron {
  transform: rotate(180deg);
}

.thinking__content,
.answer {
  margin: 0;
  line-height: 1.45;
}

.thinking__content {
  height: 128px;
  overflow-y: auto;
  margin-top: 9px;
  padding-right: 10px;
  font-size: 13.5px;
  line-height: 1.45;
  overscroll-behavior: contain;
  scrollbar-color: var(--color-border-strong) transparent;
  scrollbar-width: thin;
}

.answer-loader {
  display: inline-flex;
  height: 24px;
  align-items: center;
  gap: 5px;
  color: var(--color-text-muted);
}

.answer-loader > span:not(.sr-only) {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: answer-wave 900ms ease-in-out infinite;
}

.answer-loader > span:nth-of-type(3) {
  animation-delay: 120ms;
}

.answer-loader > span:nth-of-type(4) {
  animation-delay: 240ms;
}

@keyframes answer-wave {
  0%,
  60%,
  100% {
    opacity: 0.3;
    transform: translateY(0) scale(0.85);
  }

  30% {
    opacity: 1;
    transform: translateY(-5px) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .answer-loader > span:not(.sr-only) {
    animation: none;
    opacity: 0.65;
  }

  .thinking__chevron {
    transition: none;
  }
}

.composer-wrap {
  position: absolute;
  right: 48px;
  bottom: 22px;
  left: 48px;
  width: min(calc(100% - 96px), 940px);
  margin: 0 auto;
  padding-top: 4px;
  background: linear-gradient(to bottom, rgb(255 255 255 / 0%), #ffffff 18px);
}

.chat-composer {
  display: flex;
  width: 100%;
  height: 64px;
  align-items: center;
  padding: 0 24px;
  border: 1px solid var(--color-border-strong);
  border-radius: 11px;
  background: var(--color-surface);
  box-shadow: 0 5px 20px rgb(15 23 42 / 4%);
}

.chat-composer:focus-within {
  border-color: #aeb9cb;
  box-shadow:
    0 5px 20px rgb(15 23 42 / 4%),
    0 0 0 2px rgb(31 99 243 / 7%);
}

.chat-composer__input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--color-text-strong);
  background: transparent;
  font-size: 14.5px;
}

.chat-composer__input::placeholder {
  color: var(--color-text-subtle);
}

.composer-disclaimer {
  margin: 8px 0 0;
  color: var(--color-text-muted);
  font-size: 11.5px;
  text-align: center;
}

@media (max-width: 1150px) {
  .message-column {
    left: 0;
  }

  .message--assistant {
    margin-left: 0;
  }
}

@media (max-width: 720px) {
  .message-list {
    bottom: 92px;
    padding: 28px 18px 18px;
  }

  .message-column {
    width: 100%;
    margin-bottom: 24px;
  }

  .message--user {
    width: min(88%, 520px);
    padding: 13px 14px;
  }

  .message--assistant {
    width: 100%;
  }

  .thinking__content {
    height: 112px;
  }

  .composer-wrap {
    right: 14px;
    bottom: 12px;
    left: 14px;
    width: calc(100% - 28px);
  }

  .chat-composer {
    height: 56px;
    padding: 0 17px;
  }

  .composer-disclaimer {
    margin-top: 6px;
    font-size: 10.5px;
  }
}

@media (max-width: 420px) {
  .message-list {
    padding-right: 12px;
    padding-left: 12px;
  }

  .message {
    font-size: 14px;
  }

  .message--user {
    width: 92%;
  }

  .thinking {
    padding-left: 11px;
  }
}
</style>

<style>
.thinking__content > :first-child,
.answer > :first-child {
  margin-top: 0;
}

.thinking__content > :last-child,
.answer > :last-child {
  margin-bottom: 0;
}

.thinking__content p,
.answer p {
  margin: 0.15em 0;
  overflow-wrap: anywhere;
}

.thinking__content h1,
.thinking__content h2,
.thinking__content h3,
.thinking__content h4,
.answer h1,
.answer h2,
.answer h3,
.answer h4 {
  margin: 1em 0 0.5em;
  color: var(--color-text-strong);
  font-weight: 700;
  line-height: 1.3;
}

.thinking__content h1,
.answer h1 {
  font-size: 1.35em;
}

.thinking__content h2,
.answer h2 {
  font-size: 1.2em;
}

.thinking__content h3,
.thinking__content h4,
.answer h3,
.answer h4 {
  font-size: 1.05em;
}

.thinking__content ul,
.thinking__content ol,
.answer ul,
.answer ol {
  margin: 0.3em 0;
  padding-left: 1.4em;
}

.thinking__content li,
.answer li {
  margin: 0.25em 0;
}

.thinking__content blockquote,
.answer blockquote {
  margin: 0.3em 0;
  padding-left: 1em;
  border-left: 3px solid var(--color-border-strong);
  color: var(--color-text-muted);
}

.thinking__content code,
.answer code {
  padding: 0.15em 0.35em;
  border-radius: 4px;
  background: #eef1f5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
}

.thinking__content pre,
.answer pre {
  margin: 0.3em 0;
  padding: 12px 14px;
  border: 1px solid var(--color-border-strong);
  border-radius: 8px;
  background: #f6f8fa;
  overflow-x: auto;
  white-space: pre;
  scrollbar-color: var(--color-border-strong) transparent;
  scrollbar-width: thin;
}

.thinking__content pre code,
.answer pre code {
  display: block;
  padding: 0;
  border-radius: 0;
  background: transparent;
  font-size: 0.88em;
  line-height: 1.5;
}

.thinking__content a,
.answer a {
  color: var(--color-focus);
  text-decoration: underline;
}

.thinking__content table,
.answer table {
  margin: 0.3em 0;
  border-collapse: collapse;
}

.thinking__content th,
.thinking__content td,
.answer th,
.answer td {
  padding: 6px 10px;
  border: 1px solid var(--color-border-strong);
}

.thinking__content hr,
.answer hr {
  margin: 1em 0;
  border: 0;
  border-top: 1px solid var(--color-border-strong);
}
</style>
