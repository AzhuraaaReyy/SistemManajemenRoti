import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Port dikunci karena backend hanya mengizinkan origin ini di config/cors.php
    // dan memakainya untuk membangun tautan reset password (FRONTEND_URL).
    // Tanpa strictPort, Vite diam-diam pindah port saat 5180 terpakai dan
    // seluruh panggilan API akan diblokir browser karena CORS.
    port: 5180,
    strictPort: true,
  },
})
