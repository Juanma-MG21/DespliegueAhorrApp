import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Desarrollo local: proxy de /api hacia el backend (por defecto http://127.0.0.1:5000).
// Producción (AWS): se sirve `dist/` con Nginx, que reenvía /api al backend.
const API_TARGET = process.env.VITE_API_TARGET || "http://127.0.0.1:5000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost",
    port: 5173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true, secure: false },
    },
  },
});
