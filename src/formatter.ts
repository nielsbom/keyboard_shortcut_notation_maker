export type PlatformPreference = 'auto' | 'mac' | 'windows' | 'linux'
export type ResolvedPlatform = 'mac' | 'windows' | 'linux'
export type OutputStyle =
  | 'plain'
  | 'markdown-kbd'
  | 'html-kbd'
  | 'html-button'
  | 'mac-symbols'
export type LabelStyle = 'auto' | 'short' | 'long' | 'symbols'
export type SeparatorStyle = 'space' | 'plus'
export type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta'

export interface FormatterConfig {
  platform: PlatformPreference
  outputStyle: OutputStyle
  labelStyle: LabelStyle
  separator: SeparatorStyle
}

export interface Shortcut {
  modifiers: ModifierKey[]
  key: string | null
}

export interface FormatResult {
  displayOutput: string
  plainText: string
  htmlOutput: string
  resolvedPlatform: ResolvedPlatform
}

const PLATFORM_ORDER: Record<ResolvedPlatform, ModifierKey[]> = {
  mac: ['meta', 'shift', 'alt', 'ctrl'],
  windows: ['ctrl', 'alt', 'shift', 'meta'],
  linux: ['ctrl', 'alt', 'shift', 'meta'],
}

const SHORT_LABELS: Record<ResolvedPlatform, Record<ModifierKey, string>> = {
  mac: { ctrl: 'Ctrl', alt: 'Opt', shift: 'Shift', meta: 'Cmd' },
  windows: { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Win' },
  linux: { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Super' },
}

const LONG_LABELS: Record<ResolvedPlatform, Record<ModifierKey, string>> = {
  mac: { ctrl: 'Control', alt: 'Option', shift: 'Shift', meta: 'Command' },
  windows: { ctrl: 'Control', alt: 'Alt', shift: 'Shift', meta: 'Windows' },
  linux: { ctrl: 'Control', alt: 'Alt', shift: 'Shift', meta: 'Super' },
}

const SYMBOL_LABELS: Record<ResolvedPlatform, Record<ModifierKey, string>> = {
  mac: { ctrl: '⌃', alt: '⌥', shift: '⇧', meta: '⌘' },
  windows: { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Win' },
  linux: { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Super' },
}

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta'])
const KEY_NAME_MAP: Record<string, string> = {
  ' ': 'Space',
  Escape: 'Esc',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  CapsLock: 'Caps Lock',
  NumLock: 'Num Lock',
  ScrollLock: 'Scroll Lock',
  Pause: 'Pause',
  PrintScreen: 'Print Screen',
  ContextMenu: 'Menu',
}

export function detectPlatform(): ResolvedPlatform {
  const nav = navigator as Navigator & {
    userAgentData?: {
      platform?: string
    }
  }

  const platformValue = `${nav.userAgentData?.platform ?? navigator.platform ?? ''}`.toLowerCase()

  if (platformValue.includes('mac')) {
    return 'mac'
  }

  if (platformValue.includes('win')) {
    return 'windows'
  }

  if (platformValue.includes('linux') || platformValue.includes('x11')) {
    return 'linux'
  }

  return 'mac'
}

export function resolvePlatform(platform: PlatformPreference): ResolvedPlatform {
  return platform === 'auto' ? detectPlatform() : platform
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent): Shortcut {
  const modifiers: ModifierKey[] = []

  if (event.ctrlKey) {
    modifiers.push('ctrl')
  }

  if (event.altKey) {
    modifiers.push('alt')
  }

  if (event.shiftKey) {
    modifiers.push('shift')
  }

  if (event.metaKey) {
    modifiers.push('meta')
  }

  const key = normalizeCapturedKey(event.key, event.code)

  return {
    modifiers,
    key: key && !MODIFIER_KEYS.has(key) ? key : null,
  }
}

export function formatShortcut(shortcut: Shortcut, config: FormatterConfig): FormatResult {
  const resolvedPlatform = resolvePlatform(config.platform)
  const resolvedLabelStyle = resolveLabelStyle(config, resolvedPlatform)
  const labels = getOrderedModifierLabels(shortcut, resolvedPlatform, resolvedLabelStyle)

  if (shortcut.key) {
    labels.push(normalizeDisplayKey(shortcut.key))
  }

  if (labels.length === 0) {
    return {
      displayOutput: '',
      plainText: '',
      htmlOutput: '',
      resolvedPlatform,
    }
  }

  const separator = getSeparator(config.separator)
  const plainText = labels.join(separator)
  const htmlTag = config.outputStyle === 'html-button' ? 'button' : 'kbd'
  const htmlOutput = labels.map((label) => `<${htmlTag}>${escapeHtml(label)}</${htmlTag}>`).join(separator)
  const markdownOutput = labels.map((label) => `<kbd>${escapeHtml(label)}</kbd>`).join(separator)

  let displayOutput = plainText

  switch (config.outputStyle) {
    case 'markdown-kbd':
      displayOutput = markdownOutput
      break
    case 'html-kbd':
    case 'html-button':
      displayOutput = htmlOutput
      break
    case 'mac-symbols':
    case 'plain':
      displayOutput = plainText
      break
  }

  return {
    displayOutput,
    plainText,
    htmlOutput,
    resolvedPlatform,
  }
}

function resolveLabelStyle(
  config: FormatterConfig,
  resolvedPlatform: ResolvedPlatform,
): Exclude<LabelStyle, 'auto'> {
  if (config.labelStyle !== 'auto') {
    return config.labelStyle
  }

  if (config.outputStyle === 'mac-symbols' && resolvedPlatform === 'mac') {
    return 'symbols'
  }

  return 'short'
}

function getOrderedModifierLabels(
  shortcut: Shortcut,
  platform: ResolvedPlatform,
  style: Exclude<LabelStyle, 'auto'>,
): string[] {
  const labelMap = getLabelMap(platform, style)
  const activeModifiers = new Set(shortcut.modifiers)

  return PLATFORM_ORDER[platform]
    .filter((modifier) => activeModifiers.has(modifier))
    .map((modifier) => labelMap[modifier])
}

function getLabelMap(
  platform: ResolvedPlatform,
  style: Exclude<LabelStyle, 'auto'>,
): Record<ModifierKey, string> {
  switch (style) {
    case 'long':
      return LONG_LABELS[platform]
    case 'symbols':
      return SYMBOL_LABELS[platform]
    case 'short':
      return SHORT_LABELS[platform]
  }
}

function normalizeCapturedKey(key: string, code: string): string | null {
  if (!key || key === 'Unidentified' || key === 'Dead') {
    return fallbackKeyFromCode(code)
  }

  return key
}

function normalizeDisplayKey(key: string): string {
  if (KEY_NAME_MAP[key]) {
    return KEY_NAME_MAP[key]
  }

  if (/^F\d{1,2}$/i.test(key)) {
    return key.toUpperCase()
  }

  if (key.length === 1) {
    return key.toUpperCase()
  }

  return key
}

function fallbackKeyFromCode(code: string): string | null {
  if (!code) {
    return null
  }

  if (code.startsWith('Key')) {
    return code.slice(3).toUpperCase()
  }

  if (code.startsWith('Digit')) {
    return code.slice(5)
  }

  if (code.startsWith('Numpad')) {
    return code.replace('Numpad', 'Numpad ')
  }

  return code.replace(/([a-z])([A-Z])/g, '$1 $2')
}

function getSeparator(separator: SeparatorStyle): string {
  return separator === 'plus' ? ' + ' : ' '
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
