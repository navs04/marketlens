import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Lets the frontend call fetch("/api/v1/...") in dev without CORS
      // config drift between environments; production will call the real
      // API base URL directly (see src/api/client.ts).
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
