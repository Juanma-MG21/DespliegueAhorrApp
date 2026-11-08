import { defineConfig } from "vite";
import react from "@vitejs/plugin-react"; 
import fs from 'fs';

export default defineConfig({
  plugins: [react()], 
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
  server: {
    host: `localhost`,
    port: 5173,
    https: {
      key: fs.readFileSync('certs/private.key'),
      cert: fs.readFileSync('certs/certificate.crt'),
    },
    proxy: {
      "/api": {
        target: "https://ahorrapp-react-pkj9.onrender.com",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});