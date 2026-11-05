import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({base:process.env.PUBLIC_BASE_PATH || '/',plugins:[react(),tailwindcss()]});
