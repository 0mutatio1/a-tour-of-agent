import { defineStore } from "pinia";

interface UiState {
  sidebarCollapsed: boolean;
  isUserMenuOpen: boolean;
  notice: string | null;
  dialogResetVersion: number;
}

const STORAGE_KEY = "agent-chat.ui-preferences.v1";
let noticeTimeout: number | undefined;

function readSidebarCollapsed(): boolean {
  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (storedValue === null) {
      return false;
    }
    const parsedValue: unknown = JSON.parse(storedValue);
    return (
      typeof parsedValue === "object" &&
      parsedValue !== null &&
      "sidebarCollapsed" in parsedValue &&
      typeof parsedValue.sidebarCollapsed === "boolean" &&
      parsedValue.sidebarCollapsed
    );
  } catch {
    return false;
  }
}

export const useUiStore = defineStore("ui", {
  state: (): UiState => ({
    sidebarCollapsed: readSidebarCollapsed(),
    isUserMenuOpen: false,
    notice: null,
    dialogResetVersion: 0,
  }),
  actions: {
    toggleSidebar(): void {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      this.isUserMenuOpen = false;
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ sidebarCollapsed: this.sidebarCollapsed }),
        );
      } catch {
        // The sidebar remains usable when local storage is unavailable.
      }
    },
    startNewChat(): void {
      this.isUserMenuOpen = false;
      this.dialogResetVersion += 1;
    },
    toggleUserMenu(): void {
      this.isUserMenuOpen = !this.isUserMenuOpen;
    },
    closeUserMenu(): void {
      this.isUserMenuOpen = false;
    },
    showNotice(message: string): void {
      if (noticeTimeout !== undefined) {
        window.clearTimeout(noticeTimeout);
      }
      this.notice = message;
      noticeTimeout = window.setTimeout(() => {
        this.notice = null;
        noticeTimeout = undefined;
      }, 3200);
    },
  },
});
