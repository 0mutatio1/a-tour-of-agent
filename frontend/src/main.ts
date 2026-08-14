import { createPinia } from "pinia";
import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";

import App from "./App.vue";
import ChatView from "./ChatView.vue";
import SettingsView from "./SettingsView.vue";
import "./style.css";
import "highlight.js/styles/github.css";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "new-chat", component: ChatView },
    { path: "/settings", name: "settings", component: SettingsView },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

createApp(App).use(createPinia()).use(router).mount("#app");
