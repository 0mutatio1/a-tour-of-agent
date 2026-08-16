<script setup lang="ts">
import { RouterView } from "vue-router";

import SearchDialog from "./SearchDialog.vue";
import Sidebar from "./Sidebar.vue";
import { useUiStore } from "./ui";

const uiStore = useUiStore();
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--sidebar-collapsed': uiStore.sidebarCollapsed }">
    <Sidebar />

    <main class="app-workspace">
      <RouterView />
    </main>

    <SearchDialog v-if="uiStore.isSearchOpen" />

    <Transition name="notice">
      <div v-if="uiStore.notice" class="app-notice" role="status" aria-live="polite">
        {{ uiStore.notice }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-shell {
  --sidebar-current-width: var(--sidebar-width);

  min-height: 100vh;
  background: var(--color-canvas);
}

.app-shell--sidebar-collapsed {
  --sidebar-current-width: var(--sidebar-collapsed-width);
}

.app-workspace {
  width: calc(100% - var(--sidebar-current-width));
  min-width: 0;
  min-height: 100vh;
  margin-left: var(--sidebar-current-width);
  transition:
    width 180ms ease,
    margin-left 180ms ease;
}

.app-notice {
  position: fixed;
  z-index: 120;
  right: 24px;
  bottom: 24px;
  max-width: 390px;
  padding: 13px 16px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  color: var(--color-text-strong);
  background: var(--color-surface);
  box-shadow: var(--shadow-menu);
  font-size: 13.5px;
  font-weight: 520;
}

.notice-enter-active,
.notice-leave-active {
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.notice-enter-from,
.notice-leave-to {
  opacity: 0;
  transform: translateY(5px);
}

@media (prefers-reduced-motion: reduce) {
  .app-workspace,
  .notice-enter-active,
  .notice-leave-active {
    transition: none;
  }
}

@media (max-width: 860px) {
  .app-shell,
  .app-shell--sidebar-collapsed {
    --sidebar-current-width: 64px;
  }

  .app-notice {
    right: 12px;
    bottom: 12px;
    left: 76px;
    max-width: none;
  }
}
</style>
