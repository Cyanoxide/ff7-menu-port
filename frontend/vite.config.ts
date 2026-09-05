import { defineConfig, type ResolvedConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Where scripts/dev.sh puts the PHP backend. Passed through the environment so
 * the two cannot disagree about the port.
 */
const PHP_PORT = process.env.PHP_PORT ?? '8123'

/**
 * **Every** .php request goes to the PHP backend. Not a list of endpoints.
 *
 * Vite serves the app but cannot run PHP, and public/ — which is the dev
 * server's static root — holds the handlers *and* contact-config.php, with its
 * recipient address and its signing secret. So anything .php that Vite handles
 * itself is served as a **static file**, and the source comes back over HTTP.
 *
 * That is not hypothetical. This started as a list of the three endpoints
 * anchored with `\\.php$`, and since the pattern is matched against req.url —
 * query string included — every guestbook delete link missed the proxy and was
 * answered with the source of guestbook-moderate.php. It looked like it worked:
 * a curl piped into grep found "Entry removed" and "not valid" every time,
 * because those strings are *in* the file it had just been handed.
 *
 * Catching every .php removes the whole class of mistake, and it is also what
 * the host actually does — one document root, PHP handles the lot. The config
 * and form-lib.php refuse to run when required directly, so they answer 403
 * here exactly as they would in production, rather than 404ing differently and
 * hiding a rule that does not work.
 *
 * `[^?]*` keeps the match on the path, and `(\\?|$)` allows the query string
 * that broke it the first time.
 */
const PHP_REQUESTS = '^/[^?]*\\.php(\\?|$)'

/**
 * Local-only files that must never reach the build.
 *
 * Both live in public/, which Vite copies into dist/ verbatim:
 *
 *  - contact-config.php — the dev config, with its dev secret and its
 *    dev@localhost recipient. Deploying it over the real one would leave both
 *    forms quietly broken.
 *  - guestbook-data/ — the guestbook's store when `guestbook_dir` is left
 *    unset. On the server that is exactly where it should be; here it is local
 *    test entries, and shipping them would publish them *and* overwrite the
 *    real ones on a mirroring upload.
 *
 * The example config is emitted as documentation and stays.
 */
const LOCAL_ONLY = ['contact-config.php', 'guestbook-data'];

const dropLocalConfig = () => {
  /**
   * Taken from the resolved config rather than from __dirname and a hardcoded
   * 'dist'. package.json sets "type": "module", so Vite bundles this file as
   * ESM and __dirname would be undefined at runtime however well it typechecks.
   * This is the more honest source anyway — it follows build.outDir if it moves.
   */
  let resolved: ResolvedConfig

  return {
    name: 'drop-local-contact-config',
    configResolved(config: ResolvedConfig) {
      resolved = config
    },
    closeBundle() {
      for (const name of LOCAL_ONLY) {
        const stray = path.resolve(resolved.root, resolved.build.outDir, name)
        if (!fs.existsSync(stray)) continue
        fs.rmSync(stray, { recursive: true, force: true })
        resolved.logger.info(`  removed ${name} from the build (local only — never deploy it)`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    proxy: {
      [PHP_REQUESTS]: {
        target: `http://127.0.0.1:${PHP_PORT}`,
        changeOrigin: false,
        /**
         * Without the backend up, this would otherwise be a bare 502 with
         * nothing to say which of the two servers was missing.
         */
        configure: (proxy) => {
          // Cast because the declared proxy type does not expose `on`. The shape
          // asked for below is the whole of what is used.
          const emitter = proxy as unknown as {
            on: (
              event: 'error',
              listener: (
                error: unknown,
                request: unknown,
                response: {
                  headersSent?: boolean
                  writeHead?: (status: number, headers: Record<string, string>) => void
                  end?: (body: string) => void
                },
              ) => void,
            ) => void
          }

          emitter.on('error', (_error, _request, res) => {
            if (!res?.writeHead || !res.end || res.headersSent) return
            res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end(
              `The PHP backend is not answering on 127.0.0.1:${PHP_PORT}.\n\n` +
              'Start it with `npm run dev`, which runs both servers. `npm run dev:vite`\n' +
              'is the app on its own, and the form and guestbook will not work under it.\n'
            )
          })
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    dropLocalConfig(),
  ],
})
