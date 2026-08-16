<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import type { MessageSearchResult, SearchExcerpt } from "./chat";
import { createSearchExcerpt, useChatStore } from "./chat";
import Icon from "./Icon.vue";
import { useUiStore } from "./ui";

interface DisplaySearchResult extends MessageSearchResult {
  excerpt: SearchExcerpt;
}

const router = useRouter();
const chatStore = useChatStore();
const uiStore = useUiStore();
const dialog = ref<HTMLElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const query = ref("");
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
let restoreTriggerFocus = true;

const results = computed<DisplaySearchResult[]>(() =>
  chatStore.searchMessages(query.value).map((result) => ({
    ...result,
    excerpt: createSearchExcerpt(result.content, query.value),
  })),
);

function closeDialog(): void {
  uiStore.closeSearch();
}

function handleDialogKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    closeDialog();
    return;
  }
  if (event.key !== "Tab" || dialog.value === null) {
    return;
  }

  const focusableElements = Array.from(
    dialog.value.querySelectorAll<HTMLElement>("input, button:not([disabled])"),
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements.at(-1);
  if (firstElement === undefined || lastElement === undefined) {
    return;
  }
  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

async function openResult(result: DisplaySearchResult): Promise<void> {
  restoreTriggerFocus = false;
  await router.push({
    name: "chat",
    params: { conversationId: result.conversationId },
  });
  uiStore.closeSearch();
  await nextTick();
  uiStore.highlightMessage(result.messageId);
  await nextTick();

  const message = document.getElementById(`message-${result.messageId}`);
  message?.scrollIntoView({ behavior: "smooth", block: "center" });
  message?.focus({ preventScroll: true });
}

onMounted(async () => {
  await nextTick();
  searchInput.value?.focus();
});

onBeforeUnmount(() => {
  if (restoreTriggerFocus) {
    document.querySelector<HTMLButtonElement>("[data-search-trigger]")?.focus();
  }
});
</script>

<template>
  <Teleport to="body">
    <div class="search-overlay" @pointerdown.self="closeDialog">
      <section
        ref="dialog"
        class="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-dialog-title"
        @keydown="handleDialogKeydown"
      >
        <header class="search-dialog__header">
          <h2 id="search-dialog-title">Search messages</h2>
          <button type="button" aria-label="Close search" @click="closeDialog">×</button>
        </header>

        <label class="search-field">
          <span class="sr-only">Search conversation messages</span>
          <Icon name="search" :size="20" />
          <input
            ref="searchInput"
            v-model="query"
            type="search"
            placeholder="Search conversations"
            autocomplete="off"
          />
        </label>

        <div class="search-summary" role="status" aria-live="polite">
          <span v-if="query.trim()">{{ results.length }} {{ results.length === 1 ? "result" : "results" }}</span>
          <span v-else>Search user messages and assistant answers</span>
        </div>

        <div class="search-results">
          <p v-if="!query.trim()" class="search-empty">
            {{ chatStore.conversations.length ? "Start typing to search your conversations." : "No conversations yet." }}
          </p>
          <p v-else-if="results.length === 0" class="search-empty">No messages found.</p>
          <template v-else>
            <button
              v-for="result in results"
              :key="result.messageId"
              class="search-result"
              type="button"
              @click="openResult(result)"
            >
              <span class="search-result__topline">
                <strong>{{ result.conversationTitle }}</strong>
                <span>{{ timeFormatter.format(result.createdAt) }}</span>
              </span>
              <span class="search-result__role">{{ result.role === "user" ? "You" : "Assistant" }}</span>
              <span class="search-result__excerpt">
                <span v-if="result.excerpt.leadingEllipsis">…</span>{{ result.excerpt.before }}<mark v-if="result.excerpt.match">{{ result.excerpt.match }}</mark>{{ result.excerpt.after }}<span v-if="result.excerpt.trailingEllipsis">…</span>
              </span>
            </button>
          </template>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.search-overlay {
  position: fixed;
  z-index: 200;
  inset: 0;
  display: grid;
  place-items: start center;
  padding: 12vh 20px 24px;
  background: rgb(16 22 36 / 28%);
  backdrop-filter: blur(2px);
}

.search-dialog {
  display: flex;
  width: min(680px, 100%);
  max-height: min(680px, 76dvh);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border-strong);
  border-radius: 14px;
  background: var(--color-surface);
  box-shadow: 0 24px 70px rgb(15 23 42 / 22%);
}

.search-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 22px 12px;
}

.search-dialog__header h2 {
  margin: 0;
  color: var(--color-text-strong);
  font-size: 18px;
  font-weight: 680;
}

.search-dialog__header button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--color-text-muted);
  background: transparent;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.search-dialog__header button:hover {
  color: var(--color-text-strong);
  background: var(--color-sidebar-hover);
}

.search-dialog__header button:focus-visible,
.search-result:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
}

.search-field {
  display: flex;
  height: 50px;
  flex: 0 0 auto;
  align-items: center;
  gap: 11px;
  margin: 0 22px;
  padding: 0 15px;
  border: 1px solid var(--color-border-strong);
  border-radius: 10px;
  color: var(--color-text-muted);
}

.search-field:focus-within {
  border-color: #aeb9cb;
  box-shadow: 0 0 0 2px rgb(31 99 243 / 8%);
}

.search-field input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--color-text-strong);
  background: transparent;
  font-size: 14.5px;
}

.search-field input::placeholder {
  color: var(--color-text-subtle);
}

.search-summary {
  min-height: 36px;
  padding: 11px 24px 7px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.search-results {
  min-height: 150px;
  overflow-y: auto;
  padding: 0 12px 14px;
  scrollbar-color: var(--color-border-strong) transparent;
  scrollbar-width: thin;
}

.search-empty {
  margin: 30px 12px;
  color: var(--color-text-subtle);
  font-size: 13.5px;
  text-align: center;
}

.search-result {
  display: grid;
  width: 100%;
  gap: 6px;
  padding: 14px 12px;
  border: 0;
  border-radius: 9px;
  color: var(--color-text);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.search-result:hover {
  background: var(--color-sidebar-hover);
}

.search-result__topline {
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.search-result__topline strong {
  overflow: hidden;
  color: var(--color-text-strong);
  font-size: 13.5px;
  font-weight: 640;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result__topline > span {
  flex: 0 0 auto;
  color: var(--color-text-subtle);
  font-size: 11.5px;
}

.search-result__role {
  color: var(--color-text-muted);
  font-size: 11.5px;
  font-weight: 620;
}

.search-result__excerpt {
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-text);
  font-size: 13px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.search-result__excerpt mark {
  border-radius: 2px;
  color: inherit;
  background: #fff0a8;
}

@media (max-width: 720px) {
  .search-overlay {
    padding: 20px 12px;
  }

  .search-dialog {
    max-height: calc(100dvh - 40px);
  }

  .search-dialog__header {
    padding: 17px 17px 10px;
  }

  .search-field {
    margin: 0 17px;
  }

  .search-result__topline > span {
    display: none;
  }
}
</style>
