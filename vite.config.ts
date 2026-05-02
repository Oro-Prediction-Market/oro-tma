import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig(async (): Promise<UserConfig> => {
  const extraPlugins: import("vite").PluginOption[] = [];
  if (process.env.HTTPS) {
    const { default: mkcert } = await import("vite-plugin-mkcert");
    extraPlugins.push(mkcert());
  }

  return {
    base: "/",
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, "./shared"),
      },
    },
    plugins: [react(), tsconfigPaths(), ...extraPlugins],
    build: {
      target: "esnext",
      minify: "terser",
      cssCodeSplit: true,
      terserOptions: {
        compress: { drop_console: true, drop_debugger: true, passes: 2 },
        format: { comments: false },
      },
      rollupOptions: {
        treeshake: { propertyReadSideEffects: false },
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/react-dom")) return "vendor-react-dom";
            if (id.includes("node_modules/react/") || id.includes("node_modules/react-router")) return "vendor-react";
            if (id.includes("node_modules/lucide-react")) return "vendor-lucide";
            if (id.includes("node_modules/@telegram-apps/telegram-ui")) return "vendor-tg-ui";
            if (id.includes("node_modules/@tma.js") || id.includes("node_modules/@telegram-apps")) return "vendor-tma-sdk";
            if (id.includes("node_modules/@tonconnect")) return "vendor-ton";
            if (id.includes("node_modules/socket.io-client") || id.includes("node_modules/engine.io")) return "vendor-socket";
            if (id.includes("node_modules/eruda")) return "vendor-eruda";
            if (id.includes("node_modules/")) return "vendor-misc";
          },
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
      chunkSizeWarningLimit: 400,
    },
    server: {
      host: true,
      port: 5175,
      allowedHosts: [".ngrok-free.dev", ".ngrok.io", ".trycloudflare.com", "localhost"],
      proxy: {
        "/api": { target: "http://localhost:3000", changeOrigin: true },
      },
    },
  };
});
