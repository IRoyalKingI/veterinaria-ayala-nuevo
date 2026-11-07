import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  envDir: "../backend",
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: process.env.TUNNEL_HOST ? [process.env.TUNNEL_HOST] : [],
  },
});
