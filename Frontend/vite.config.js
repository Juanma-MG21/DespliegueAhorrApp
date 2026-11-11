import { defineConfig } from "vite";
import react from "@vitejs/plugin-react"; 
import fs from 'fs';

// Detecta automáticamente si Vite está compilando para producción en AWS
const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [react()], 
  server: {
    host: `localhost`,
    port: 5173,
    // En tu PC (desarrollo) usa HTTPS, en AWS (producción) se desactiva solo
    https: isProduction ? false : {
      key: fs.readFileSync('certs/private.key'),
      cert: fs.readFileSync('certs/certificate.crt'),
    },
    proxy: {
      "/api": {
        // En tu PC apunta a tu API o Render, en AWS Nginx se encarga por el puerto 5000
        target: isProduction ? "http://127.0.0.1:5000" : "https://ahorrapp-react-pkj9.onrender.com",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
