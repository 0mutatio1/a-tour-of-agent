<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { useChatStore } from "./chat";
import Icon from "./Icon.vue";
import { useUiStore } from "./ui";

const router = useRouter();
const chatStore = useChatStore();
const uiStore = useUiStore();
const userCard = ref<HTMLElement | null>(null);
const historyOpen = ref(true);
const historySections = computed(() =>
  [
    { label: "Today", conversations: chatStore.historyGroups.today },
    { label: "Yesterday", conversations: chatStore.historyGroups.yesterday },
    { label: "Earlier", conversations: chatStore.historyGroups.earlier },
  ].filter((section) => section.conversations.length > 0),
);
const activeConversationId = computed(() =>
  router.currentRoute.value.name === "chat" ? chatStore.activeConversationId : null,
);

function startNewChat(): void {
  uiStore.startNewChat();
  if (router.currentRoute.value.name !== "new-chat") {
    void router.push({ name: "new-chat" });
  }
}

function openSettings(): void {
  uiStore.closeUserMenu();
  void router.push({ name: "settings" });
}

function openConversation(conversationId: string): void {
  uiStore.closeUserMenu();
  void router.push({ name: "chat", params: { conversationId } });
}

function logOut(): void {
  uiStore.closeUserMenu();
  uiStore.showNotice("Authentication is not available in this prototype");
}

function handleOutsidePointer(event: PointerEvent): void {
  if (
    uiStore.isUserMenuOpen &&
    event.target instanceof Node &&
    !userCard.value?.contains(event.target)
  ) {
    uiStore.closeUserMenu();
  }
}

function handleEscape(event: KeyboardEvent): void {
  if (event.key === "Escape" && uiStore.isUserMenuOpen) {
    uiStore.closeUserMenu();
  }
}

onMounted(() => {
  document.addEventListener("pointerdown", handleOutsidePointer);
  window.addEventListener("keydown", handleEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleOutsidePointer);
  window.removeEventListener("keydown", handleEscape);
});
</script>

<template>
  <aside
    class="app-sidebar"
    :class="{ 'app-sidebar--collapsed': uiStore.sidebarCollapsed }"
    aria-label="Chat navigation"
  >
    <button
      class="sidebar-collapse-toggle"
      type="button"
      :aria-label="uiStore.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      :title="uiStore.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      @click="uiStore.toggleSidebar"
    >
      <Icon
        :name="uiStore.sidebarCollapsed ? 'sidebar-expand' : 'sidebar-collapse'"
        :size="18"
      />
    </button>

    <div class="app-sidebar__primary">
      <RouterLink class="app-sidebar__brand" to="/" aria-label="Agent chat home">
        <svg
          class="stone-logo"
          viewBox="7 6 34 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Agent chat"
        >
          <path d="M10 20.3 18.1 8.8l14.2 3.4 6.2 12.4-8.7 13.1-14.4-1.9L10 20.3Z" fill="#29303B" />
          <path d="m18.1 8.8 14.2 3.4-8.8 9.3L10 20.3l8.1-11.5Z" fill="#606875" />
          <path d="m10 20.3 13.5 1.2-8.1 14.3L10 20.3Z" fill="#414955" />
          <path d="m23.5 21.5 8.8-9.3 2 13.2-4.5 12.3-6.3-16.2Z" fill="#151B24" />
          <path d="m23.5 21.5 10.8 3.9-4.5 12.3-6.3-16.2Z" fill="#2F6FFF" />
          <path d="m15.4 35.8 8.1-14.3 6.3 16.2-14.4-1.9Z" fill="#A5ACB7" />
        </svg>
      </RouterLink>

      <nav class="app-sidebar__actions" aria-label="Chat actions">
        <button
          class="sidebar-action"
          :class="{ 'sidebar-action--compact': uiStore.sidebarCollapsed }"
          type="button"
          aria-label="New chat"
          :title="uiStore.sidebarCollapsed ? 'New chat' : undefined"
          @click="startNewChat"
        >
          <Icon name="new-chat" :size="23" />
          <span>New chat</span>
        </button>
        <button
          class="sidebar-action"
          :class="{ 'sidebar-action--compact': uiStore.sidebarCollapsed }"
          type="button"
          aria-label="Search messages"
          :title="uiStore.sidebarCollapsed ? 'Search messages' : undefined"
          data-search-trigger
          @click="uiStore.openSearch"
        >
          <Icon name="search" :size="23" />
          <span>Search</span>
        </button>
      </nav>
    </div>

    <section class="sidebar-history">
      <div
        v-if="!uiStore.sidebarCollapsed"
        class="sidebar-history__content"
        role="region"
        aria-label="Conversation history"
      >
        <button
          class="history-toggle"
          type="button"
          :aria-expanded="historyOpen"
          aria-controls="conversation-history"
          @click="historyOpen = !historyOpen"
        >
          <span>History</span>
          <span class="history-toggle__chevron" aria-hidden="true">⌄</span>
        </button>

        <div v-if="historyOpen" id="conversation-history" class="history-list">
          <p v-if="historySections.length === 0" class="history-empty">No conversations yet</p>
          <section
            v-for="section in historySections"
            :key="section.label"
            class="history-group"
            :aria-label="section.label"
          >
            <h2>{{ section.label }}</h2>
            <button
              v-for="conversation in section.conversations"
              :key="conversation.id"
              class="history-item"
              :class="{ 'history-item--active': conversation.id === activeConversationId }"
              type="button"
              :aria-current="conversation.id === activeConversationId ? 'page' : undefined"
              :title="conversation.title"
              @click="openConversation(conversation.id)"
            >
              {{ conversation.title }}
            </button>
          </section>
        </div>
      </div>
    </section>
    <footer
      ref="userCard"
      class="sidebar-user"
      :class="{ 'sidebar-user--compact': uiStore.sidebarCollapsed }"
    >
      <div v-if="uiStore.isUserMenuOpen" class="user-menu" role="menu" aria-label="User menu">
        <button type="button" role="menuitem" @click="openSettings">
          <Icon name="settings" :size="21" />
          <span>Settings</span>
        </button>
        <button type="button" role="menuitem" @click="logOut">
          <Icon name="logout" :size="21" />
          <span>Log out</span>
        </button>
      </div>
      <button
        class="user-card"
        type="button"
        aria-haspopup="menu"
        aria-label="Open account menu for Jane Developer"
        :aria-expanded="uiStore.isUserMenuOpen"
        @click="uiStore.toggleUserMenu"
      >
        <span class="user-card__avatar" aria-hidden="true">JD</span>
        <span class="user-card__identity">
          <strong>Jane Developer</strong>
          <span>jane.dev@example.com</span>
        </span>
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.app-sidebar {
  position: fixed;
  z-index: 10;
  inset: 0 auto 0 0;
  display: flex;
  width: var(--sidebar-width);
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  background: var(--color-sidebar);
  transition: width 180ms ease;
}

.app-sidebar--collapsed {
  width: var(--sidebar-collapsed-width);
}

.sidebar-collapse-toggle {
  position: absolute;
  z-index: 2;
  top: 31px;
  right: -14px;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 1px solid var(--color-border-strong);
  border-radius: 50%;
  color: var(--color-text-muted);
  background: var(--color-surface);
  box-shadow: 0 3px 10px rgb(15 23 42 / 8%);
  cursor: pointer;
  transition:
    color 130ms ease,
    border-color 130ms ease,
    background-color 130ms ease;
}

.sidebar-collapse-toggle:hover {
  border-color: #bfc7d4;
  color: var(--color-text-strong);
  background: var(--color-sidebar-hover);
}

.sidebar-collapse-toggle:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.app-sidebar__primary {
  flex: 0 0 auto;
  padding: 22px 20px 20px;
  border-bottom: 1px solid var(--color-border);
}

.app-sidebar__brand {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: var(--radius-md);
  color: inherit;
}

.app-sidebar__brand:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.app-sidebar__actions {
  display: grid;
  gap: 3px;
  margin-top: 22px;
}

.stone-logo {
  display: block;
  width: 46px;
  height: 46px;
}

.sidebar-action {
  display: flex;
  width: 100%;
  height: 52px;
  align-items: center;
  gap: 14px;
  padding: 0 11px;
  border: 0;
  border-radius: var(--radius-md);
  color: var(--color-text-strong);
  background: transparent;
  font-size: 16px;
  font-weight: 680;
  line-height: 1;
  text-align: left;
  cursor: pointer;
  transition: background-color 130ms ease;
}

.sidebar-action:hover { background: var(--color-sidebar-hover); }
.sidebar-action:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }
.sidebar-action svg { flex: 0 0 auto; }
.sidebar-action--compact { width: 52px; justify-content: center; gap: 0; margin: 0 auto; padding: 0; }
.sidebar-action--compact span { display: none; }

.sidebar-history {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
}

.sidebar-history__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  padding: 17px 14px 12px;
}

.history-toggle {
  display: flex;
  width: 100%;
  height: 38px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  background: transparent;
  font-size: 13.5px;
  font-weight: 650;
  text-align: left;
  cursor: pointer;
}

.history-toggle:hover {
  color: var(--color-text-strong);
  background: var(--color-sidebar-hover);
}

.history-toggle:focus-visible,
.history-item:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
}

.history-toggle__chevron {
  font-size: 14px;
  transition: transform 150ms ease;
}

.history-toggle[aria-expanded="true"] .history-toggle__chevron {
  transform: rotate(180deg);
}

.history-list {
  min-height: 0;
  overflow-y: auto;
  padding: 8px 0 4px;
  scrollbar-color: var(--color-border-strong) transparent;
  scrollbar-width: thin;
}

.history-empty {
  margin: 9px 10px;
  color: var(--color-text-subtle);
  font-size: 12.5px;
}

.history-group + .history-group {
  margin-top: 18px;
}

.history-group h2 {
  margin: 0 10px 6px;
  color: var(--color-text-subtle);
  font-size: 11.5px;
  font-weight: 650;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.history-item {
  display: block;
  width: 100%;
  height: 38px;
  overflow: hidden;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-md);
  color: var(--color-text);
  background: transparent;
  font-size: 13.5px;
  font-weight: 480;
  line-height: 38px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.history-item:hover {
  background: var(--color-sidebar-hover);
}

.history-item--active {
  color: var(--color-text-strong);
  background: #e9edf4;
  font-weight: 620;
}

.app-sidebar--collapsed .app-sidebar__primary {
  padding-right: 12px;
  padding-left: 12px;
}

.app-sidebar--collapsed .app-sidebar__brand {
  margin: 0 auto;
}

.app-sidebar--collapsed .sidebar-collapse-toggle {
  top: 78px;
}

.app-sidebar--collapsed .app-sidebar__actions {
  margin-top: 38px;
}

.sidebar-user {
  position: relative;
  flex: 0 0 auto;
  border-top: 1px solid var(--color-border);
  background: var(--color-sidebar);
}

.user-card {
  display: flex;
  width: 100%;
  height: 103px;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 22px 0;
  border: 0;
  color: var(--color-text-strong);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 130ms ease;
}

.user-card:hover:not([aria-expanded="true"]) { background: var(--color-sidebar-hover); }
.user-card:focus { outline: none; }
.user-card:focus-visible:not([aria-expanded="true"]) { outline: 2px solid var(--color-focus); outline-offset: -3px; }

.user-card__avatar {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  color: #ffffff;
  background: var(--color-accent);
  box-shadow: 0 5px 16px rgb(37 99 235 / 18%);
  font-size: 16px;
  font-weight: 680;
  letter-spacing: -0.02em;
}

.user-card__identity { display: grid; min-width: 0; gap: 5px; padding-top: 8px; }
.user-card__identity strong, .user-card__identity span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-card__identity strong { font-size: 14.5px; font-weight: 650; line-height: 1; }
.user-card__identity span { color: var(--color-text-muted); font-size: 12.5px; line-height: 1.2; }

.user-menu {
  position: absolute;
  z-index: 20;
  right: 13px;
  bottom: calc(100% + 4px);
  left: 82px;
  display: grid;
  gap: 2px;
  padding: 7px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-menu);
}

.user-menu button {
  display: flex;
  width: 100%;
  height: 44px;
  align-items: center;
  gap: 13px;
  padding: 0 9px;
  border: 0;
  border-radius: var(--radius-md);
  color: var(--color-text-strong);
  background: transparent;
  font-size: 14.5px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.user-menu button:hover { background: var(--color-sidebar-hover); }
.user-menu button:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }
.sidebar-user--compact .user-card { height: 76px; align-items: center; justify-content: center; gap: 0; padding: 0; }
.sidebar-user--compact .user-card__avatar { width: 42px; height: 42px; font-size: 14px; }
.sidebar-user--compact .user-card__identity { display: none; }
.sidebar-user--compact .user-menu { right: auto; bottom: 8px; left: calc(100% + 10px); width: 210px; }

@media (max-width: 860px) {
  .app-sidebar,
  .app-sidebar--collapsed {
    width: 64px;
  }

  .sidebar-collapse-toggle {
    display: none;
  }

  .app-sidebar__primary,
  .app-sidebar--collapsed .app-sidebar__primary {
    padding: 16px 6px 14px;
  }

  .app-sidebar__brand,
  .app-sidebar--collapsed .app-sidebar__brand {
    width: 44px;
    height: 44px;
    margin: 0 auto;
  }

  .stone-logo {
    width: 42px;
    height: 42px;
  }

  .app-sidebar__actions,
  .app-sidebar--collapsed .app-sidebar__actions {
    margin-top: 20px;
  }

  .sidebar-action,
  .sidebar-action--compact {
    width: 48px;
    height: 48px;
    justify-content: center;
    gap: 0;
    margin: 0 auto;
    padding: 0;
  }

  .sidebar-action span {
    display: none;
  }

  .user-card,
  .sidebar-user--compact .user-card {
    height: 68px;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 0;
  }

  .user-card__avatar,
  .sidebar-user--compact .user-card__avatar {
    width: 40px;
    height: 40px;
    font-size: 13px;
  }

  .user-card__identity {
    display: none;
  }

  .user-menu,
  .sidebar-user--compact .user-menu {
    right: auto;
    bottom: 8px;
    left: calc(100% + 8px);
    width: min(210px, calc(100vw - 80px));
  }

  .sidebar-history__content {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-sidebar,
  .sidebar-collapse-toggle,
  .sidebar-action,
  .user-card,
  .history-toggle__chevron {
    transition: none;
  }
}
</style>
