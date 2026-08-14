import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [vue()],
    define: {
      "process.env.VITE_CHAT_API_URL": JSON.stringify(env.VITE_CHAT_API_URL ?? ""),
    },
    server: {
      proxy: {
        "/api": {
          target: process.env.CHAT_API_PROXY_TARGET ?? "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
  };
});
