import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// VITE_* is baked in at `vite build` time. On Render/Vercel you must set
// VITE_API_URL in the service Environment (Build + Runtime for static sites
// that build on the host) to your public API base, e.g.
// https://your-api.onrender.com/api — never http://localhost:8000/api.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiUrl = (env.VITE_API_URL || '').trim()

  if (mode === 'production') {
    if (!apiUrl) {
      throw new Error(
        'Missing VITE_API_URL: add it to your host Environment before build ' +
          '(e.g. Render → Environment → VITE_API_URL=https://your-backend.onrender.com/api). ' +
          'Local .env is not deployed from git.',
      )
    }
    if (/localhost|127\.0\.0\.1/i.test(apiUrl)) {
      throw new Error(
        'VITE_API_URL must not point to localhost in production builds. ' +
          'Browsers cannot reach your machine from the deployed site. ' +
          'Use your public API URL instead.',
      )
    }
  }

  return {
    plugins: [react(), tailwindcss()],
  }
})
