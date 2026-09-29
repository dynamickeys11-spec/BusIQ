import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      includeAssets: ["icons/icon-192.svg", "icons/icon-512.svg"],
      manifest: {
        id: "/",
        name: "BUSIQ",
        short_name: "BUSIQ",
        description: "An intelligent business operating environment for understanding, deciding and acting.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        background_color: "#F7F6F2",
        theme_color: "#111318",
        icons: [
          {
            src: "/icons/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
