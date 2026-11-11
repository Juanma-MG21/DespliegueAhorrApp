import { defineConfig } from "vite";
import react from "@vitejs/plugin-react"; 
import fs from 'fs';

export default defineConfig(({ command }) => {
  // Solo intentamos leer los certificados si estamos en modo desarrollo local (npm run dev)
  let httpsConfig = false;
  if (command === 'serve') {
    try {
      httpsConfig = {
        key: fs.readFileSync('certs/private.key'),
        cert: fs.readFileSync('certs/certificate.crt'),
      };
    } catch (e) {
      console.warn("Certificados locales no encontrados. Se usará HTTP por defecto.");
    }
  }

  return {
    plugins: [react()], 
    server: {
      host: 'localhost',
      port: 5173,
      https: httpsConfig,
      proxy: {
        "/api": {
          target: "https://ahorrapp-react-gia9.onrender.com",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});