/**
 * The tests (`npm test`), in two projects.
 *
 * `unit` — every `*.test.ts` under `src/`, in `happy-dom`: what is tested there is the
 * arithmetic — the query, the dirty set, the key diff — and a document with elements is enough
 * for that.
 *
 * `browser` — every `*.browser.test.ts` under `src/`, in a real browser (Vitest's browser mode,
 * driven by Playwright): what needs layout, focus, a pointer or the computed colours. Behaviour
 * that elements share has one contract in `src/bundle/contracts/`, a table of every element
 * that uses it; a component's own file covers only a mechanism it owns. The source
 * is served as it stands, so there is no build and no server to start. `npm run test:browser`
 * runs it in Chromium; `npm run test:browser:all` adds WebKit. The browsers come from
 * `npx playwright install chromium webkit`.
 */
import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

type Engine = 'chromium' | 'firefox' | 'webkit'

const engines = (process.env.LINTJE_BROWSERS ?? 'chromium').split(',') as Engine[]

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'happy-dom',
          // A link the page does not take over is followed: here that only sets the URL.
          environmentOptions: {
            happyDOM: { settings: { navigation: { disableMainFrameNavigation: true } } },
          },
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.ts'],
        },
      },
      {
        extends: true,
        resolve: {
          // The style guide's specimens import the built bundle; here that is the source, so a
          // specimen and the test share one module and one icon source.
          alias: [
            {
              find: /^.*\/dist-elements\/lintje\.js$/,
              replacement: fileURLToPath(new URL('./src/bundle/index.ts', import.meta.url)),
            },
          ],
        },
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts'],
          setupFiles: ['src/bundle/browser-setup.ts'],
          // One file at a time: with files in parallel, WebKit's `userEvent` now and then loses
          // the test's frame ("Cannot find vitest-iframe"); the run takes 5 % longer.
          fileParallelism: false,
          browser: {
            enabled: true,
            provider: playwright({
              // Nothing moves, so what a test measures does not depend on when it looks.
              contextOptions: { reducedMotion: 'reduce' },
              // Nothing leaves the machine: a request to another host ends at a closed port.
              launchOptions: {
                proxy: { server: 'http://127.0.0.1:9', bypass: 'localhost,127.0.0.1' },
              },
            }),
            headless: true,
            // A failed test writes no picture into `src/`.
            screenshotFailures: false,
            viewport: { width: 1440, height: 900 },
            // WebKit on the Linux runner of the CI misses a one-second poll now and then (a viewport
            // that has not flipped yet, a toast's close button not drawn yet); on macOS it never
            // does. One more try separates that from a real failure.
            instances: engines.map((browser) => ({ browser, retry: browser === 'webkit' ? 1 : 0 })),
          },
        },
      },
    ],
  },
})
