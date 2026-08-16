<script setup lang="ts">
type AppIconName =
  | "new-chat"
  | "search"
  | "settings"
  | "logout"
  | "sidebar-collapse"
  | "sidebar-expand";

withDefaults(
  defineProps<{
    name: AppIconName;
    size?: number;
  }>(),
  {
    size: 20,
  },
);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <g
      v-if="name === 'new-chat'"
      stroke="currentColor"
      stroke-width="1.65"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M13.4 5H6.75A2.75 2.75 0 0 0 4 7.75v9.5A2.75 2.75 0 0 0 6.75 20h9.5A2.75 2.75 0 0 0 19 17.25V11" />
      <path d="m10 14 1.2-3.55L17.65 4a1.66 1.66 0 1 1 2.35 2.35l-6.45 6.45L10 14Z" />
    </g>

    <g
      v-else-if="name === 'search'"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="10.7" cy="10.7" r="5.7" />
      <path d="m15 15 4.2 4.2" />
    </g>

    <g
      v-else-if="name === 'settings'"
      stroke="currentColor"
      stroke-width="1.55"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.1 13.9a1.7 1.7 0 0 0 .34 1.88l.06.06-1.66 1.66-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V19h-2.34v-.34a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.66-1.66.06-.06a1.7 1.7 0 0 0 .34-1.88 1.7 1.7 0 0 0-1.56-1.03H6.4v-2.34h.34A1.7 1.7 0 0 0 8.3 9.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06L9.56 5.9l.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56V4.4h2.34v.34A1.7 1.7 0 0 0 15.9 6.3a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.66 1.66-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03H21v2.34h-.34a1.7 1.7 0 0 0-1.56 1.03Z" />
    </g>

    <g
      v-else-if="name === 'logout'"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M10 5H6.75A2.75 2.75 0 0 0 4 7.75v8.5A2.75 2.75 0 0 0 6.75 19H10" />
      <path d="M14.5 8.5 18 12l-3.5 3.5M18 12H9" />
    </g>

    <g
      v-else-if="name === 'sidebar-collapse' || name === 'sidebar-expand'"
      stroke="currentColor"
      stroke-width="1.55"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3.75" y="4" width="16.5" height="16" rx="2.5" />
      <path d="M9 4v16" />
      <path v-if="name === 'sidebar-collapse'" d="m15 9-3 3 3 3" />
      <path v-else d="m12 9 3 3-3 3" />
    </g>

  </svg>
</template>
