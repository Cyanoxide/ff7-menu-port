import { defineConfig } from "vitest/config";

/**
 * Its own config rather than a `test` block on vite.config.ts.
 *
 * That file loads the React and Tailwind plugins, which the suite has no use
 * for — everything under test here is a plain module. Keeping them out means a
 * run does not depend on the app's build pipeline working, which matters when
 * the thing you are trying to find out is whether the send path is broken.
 *
 *   npm test          run once
 *   npm run test:watch
 *
 * The PHP handlers have their own suites, which need a server and so cannot
 * live here: tests/contact.sh and tests/guestbook.sh.
 */
export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
});
