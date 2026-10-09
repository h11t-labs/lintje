/**
 * The host API without a tag, for a page that loads categories or single tags. Entries of one build
 * share these modules, so there is one host config, icon source and shortcut register.
 */
export { LINTJE_VERSION } from '../core/version'
export { LintjeElement, define } from '../core/element'
export type { Mode } from '../core/element'
export { shadowCss, toShadowCss, baseStyles, tokenStyles } from '../core/styles'
export { MediaController, MOBILE, WIDE } from '../core/media'
export { setHostConfig, scrollRoot, lockScroll } from '../core/host-config'
export type { HostConfig } from '../core/host-config'
export {
  FrameStateController,
  getFrameState,
  setFrameState,
  setScrolled,
  setTitleHidden,
  subscribeToFrameState,
} from '../core/frame-state'
export type { FrameState } from '../core/frame-state'
export {
  registerShortcut,
  shortcuts,
  keyLabels,
  ariaKeyShortcuts,
  isTypingTarget,
  characterKeys,
  setCharacterKeys,
} from '../core/shortcuts'
export type { ShortcutOptions, ShortcutInfo } from '../core/shortcuts'

export { ICONS } from '../icons/register'
export type { IconGlyph, IconName } from '../icons/register'
export { renderIcon, iconGlyph, iconStyles } from '../icons/render'
export type { IconOptions } from '../icons/render'
export {
  setIconSource,
  iconSource,
  loadIcon,
  loadedIcon,
  loadedIconNames,
  iconIsMissing,
  onIconChange,
} from '../icons/loader'
export type { IconSource } from '../icons/loader'
