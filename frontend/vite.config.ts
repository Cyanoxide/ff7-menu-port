import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// Force the browser to re-fetch static assets (e.g. the font spritesheets) on
// every dev reload. Vite dev otherwise serves `/public` images with a validator
// that some browsers keep serving stale from cache after the file changes, so an
// updated spritesheet only shows up via HMR or a direct URL, not a full refresh.
const noStoreAssetsDev = {
  name: 'no-store-assets-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      const url = (req as { url?: string }).url;
      if (url && /\.(png|jpe?g|gif|webp|svg|ico)(\?.*)?$/i.test(url)) {
        res.setHeader('Cache-Control', 'no-store');
      }
      next();
    });
  },
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    noStoreAssetsDev,
  ],
})
