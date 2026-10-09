/**
 * Tab for a browser test. Playwright's WebKit skips buttons on Tab and stops on every control
 * with Alt+Tab; Chromium on Linux and Firefox do not move the focus on Alt+Tab.
 */
import { server } from 'vitest/browser'

const webkit = server.browser === 'webkit'

export const TAB = webkit ? '{Alt>}{Tab}{/Alt}' : '{Tab}'
export const SHIFT_TAB = webkit ? '{Shift>}{Alt>}{Tab}{/Alt}{/Shift}' : '{Shift>}{Tab}{/Shift}'
