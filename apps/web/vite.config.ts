import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // router プラグインは React プラグインより前に置く必要がある。
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  // Tailwind は Vite プラグインで処理する。設定を空で渡して、リポジトリ外の親ディレクトリにある
  // postcss.config を Vite が読み込まないようにする。
  css: { postcss: {} },
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  server: {
    port: 5173,
    // スマホの実機から Cloudflare Tunnel 経由で開けるようにする (docs/development.md を参照)。
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
