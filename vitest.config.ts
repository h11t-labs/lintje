/**
 * The tests (`npm test`), in two projects.
 *
 * `unit` — every `*.test.ts` under `src/`, in `happy-dom`: what is tested there is the
 * arithmetic — the query, the dirty set, the key diff — and a document with elements is enough
 * for that. The files a worker runs share one window (`src/bundle/unit-setup.ts` clears the page
 * between them); `unit-window` gives the few files that need a fresh page or module registry a
 * window of their own. `npm run test:unit` runs both.
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
import type { BrowserCommand } from 'vitest/node'

type Engine = 'chromium' | 'firefox' | 'webkit'

/** Lays the page out as it goes to paper, or back to the screen (`print.browser.test.ts`). */
const emulatePrint: BrowserCommand<[on: boolean]> = async ({ page }, on) => {
  await page.emulateMedia({ media: on ? 'print' : 'screen' })
}

/** Draws the page in the system's palette, as a contrast theme does (`forced-colors.browser.test.ts`). */
const emulateForcedColors: BrowserCommand<[on: boolean]> = async ({ page }, on) => {
  await page.emulateMedia({ forcedColors: on ? 'active' : 'none' })
}

const engines = (process.env.LINTJE_BROWSERS ?? 'chromium').split(',') as Engine[]

const unit = {
  environment: 'happy-dom',
  // A link the page does not take over is followed: here that only sets the URL.
  environmentOptions: {
    happyDOM: { settings: { navigation: { disableMainFrameNavigation: true } } },
  },
}

/**
 * The files that need a window of their own: one looks at the registry of a page that loaded
 * nothing else, one mocks a module (`vi.mock`), which a module the cache already holds skips.
 */
const FRESH_WINDOW = ['src/bundle/forms.test.ts', 'src/components/map/map/map.test.ts']

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          ...unit,
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.ts', ...FRESH_WINDOW],
          // One window per worker, not per file: setting one up is half the time of the run.
          isolate: false,
          setupFiles: ['src/bundle/unit-setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          ...unit,
          name: 'unit-window',
          include: FRESH_WINDOW,
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
            {
              find: /^.*\/dist-elements\/core\.js$/,
              replacement: fileURLToPath(new URL('./src/bundle/core.ts', import.meta.url)),
            },
          ],
        },
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts'],
          setupFiles: ['src/bundle/browser-setup.ts'],
          // A page mostly waits for a frame, so more pages than cores: CI has four.
          maxWorkers: 6,
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
            commands: { emulatePrint, emulateForcedColors },
            // WebKit on the Linux runner of the CI misses a one-second poll now and then (a viewport
            // that has not flipped yet, a toast's close button not drawn yet); on macOS it never
            // does. One more try separates that from a real failure.
            // Firefox holds one pointer capture for the mouse across all its pages: a click in a
            // file running beside a drag lands on the dragged grip. Its files run one at a time.
            instances: engines.map((browser) => ({
              browser,
              retry: browser === 'webkit' ? 1 : 0,
              fileParallelism: browser !== 'firefox',
            })),
          },
        },
      },
    ],
  },
})
