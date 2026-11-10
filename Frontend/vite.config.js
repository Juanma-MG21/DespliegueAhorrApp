import { defineConfig } from "vite";
import react from "@vitejs/plugin-react"; 
import fs from 'fs';

export default defineConfig({
  plugins: [react()], 
  server: {
    host: `localhost`,
    port: 5173,
    https: {
      key: fs.readFileSync('certs/private.key'),
      cert: fs.readFileSync('certs/certificate.crt'),
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
