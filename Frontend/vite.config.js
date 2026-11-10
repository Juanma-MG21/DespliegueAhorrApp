import { defineConfig } from "vite";
import react from "@vitejs/plugin-react"; 
import fs from 'fs';

const privateKeyPath = new URL('./certs/private.key', import.meta.url);
const certificatePath = new URL('./certs/certificate.crt', import.meta.url);
const httpsOptions = fs.existsSync(privateKeyPath) && fs.existsSync(certificatePath)
  ? {
      key: fs.readFileSync(privateKeyPath),
      cert: fs.readFileSync(certificatePath),
    }
  : undefined;

export default defineConfig({
  plugins: [react()], 
  server: {
    host: `localhost`,
    port: 5173,
    https: httpsOptions,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
