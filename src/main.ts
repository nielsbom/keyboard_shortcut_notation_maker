import './style.css'
import {
  detectPlatform,
  formatShortcut,
  resolvePlatform,
  shortcutFromKeyboardEvent,
  type FormatterConfig,
  type LabelStyle,
  type OutputStyle,
  type PlatformPreference,
  type SeparatorStyle,
  type Shortcut,
} from './formatter.ts'

const DEFAULT_CONFIG: FormatterConfig = {
  platform: 'auto',
  outputStyle: 'plain',
  labelStyle: 'auto',
  separator: 'space',
}

const PLATFORM_LABELS = {
  mac: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
} as const

const CONFIG_PANEL_STATE_KEY = 'shortcut-notation:config-panel-open'
const HISTORY_KEY = 'shortcut-notation:history'
const HISTORY_LIMIT = 6

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

let config = readConfigFromUrl()
let currentShortcut: Shortcut = {
  modifiers: [],
  key: null,
}
let historyItems: Shortcut[] = readHistory()
let isConfigPanelOpen = readConfigPanelState()

app.innerHTML = `
  <main class="app-shell ${isConfigPanelOpen ? 'app-shell--config-open' : ''}">
    <div class="topbar">
      <button id="toggle-config" type="button" class="toggle-config" aria-expanded="${isConfigPanelOpen}" aria-controls="config-panel">
        ${isConfigPanelOpen ? 'Hide options' : 'Show options'}
      </button>
    </div>

    <section class="capture-stage panel">
      <div class="capture-stage__header">
        <div>
          <p class="section-label">Shortcut capture</p>
          <h1>Press your shortcut.</h1>
        </div>
        <span class="capture-badge">Listening</span>
      </div>

      <p class="capture-help">
        Press any key combination anywhere on the page. The generated notation updates instantly.
      </p>

      <div class="field field--large">
        <span>Generated output</span>
        <textarea id="shortcut-output" readonly rows="6" tabindex="-1" data-ignore-shortcut-capture="true"></textarea>
      </div>

      <div class="button-row">
        <button id="copy-output" type="button">Copy</button>
        <button id="copy-link" type="button" class="secondary">Copy share link</button>
        <button id="clear-shortcut" type="button" class="ghost">Clear</button>
      </div>

      <p id="feedback" class="feedback" aria-live="polite"></p>

      <div class="rendered-preview">
        <p class="section-label">Rendered preview</p>
        <div id="rendered-output" class="render-surface" aria-live="polite"></div>
      </div>
    </section>

    <div class="secondary-layout">
      <section class="panel history-panel">
        <div class="history-header">
          <div>
            <p class="section-label">Recent captures</p>
            <h2>Quick history</h2>
          </div>
          <button id="clear-history" type="button" class="text-button">Clear</button>
        </div>
        <ul id="history-list" class="history-list"></ul>
      </section>

      <aside id="config-panel" class="panel config-panel" aria-hidden="${!isConfigPanelOpen}">
        <div class="panel-heading">
          <div>
            <p class="section-label">Configuration</p>
            <h2>Formatting options</h2>
          </div>
        </div>

        <div class="control-grid">
          <label class="field">
            <span>Preset</span>
            <select id="output-style">
              <option value="plain">Plain text</option>
              <option value="markdown-kbd">Markdown with &lt;kbd&gt;</option>
              <option value="html-kbd">HTML &lt;kbd&gt;</option>
              <option value="html-button">HTML &lt;button&gt;</option>
              <option value="mac-symbols">macOS symbols</option>
            </select>
          </label>

          <label class="field">
            <span>Platform</span>
            <select id="platform">
              <option value="auto">Auto-detect</option>
              <option value="mac">macOS</option>
              <option value="windows">Windows</option>
              <option value="linux">Linux</option>
            </select>
          </label>

          <label class="field">
            <span>Modifier labels</span>
            <select id="label-style">
              <option value="auto">Auto</option>
              <option value="short">Short labels</option>
              <option value="long">Long labels</option>
              <option value="symbols">Symbols</option>
            </select>
          </label>

          <label class="field">
            <span>Separator</span>
            <select id="separator">
              <option value="space">Space</option>
              <option value="plus">Plus sign</option>
            </select>
          </label>
        </div>
      </aside>
    </div>

    <footer class="footer-meta">
      <div class="platform-note">
        <span class="section-label">Detected platform</span>
        <span id="detected-platform"></span>
        <span class="muted-copy">Auto mode uses this and falls back to macOS.</span>
      </div>
      <a href="/about.html" class="footer-link">About</a>
    </footer>
  </main>
`

const detectedPlatformEl = getElement<HTMLSpanElement>('#detected-platform')
const outputEl = getElement<HTMLTextAreaElement>('#shortcut-output')
const renderedOutputEl = getElement<HTMLDivElement>('#rendered-output')
const feedbackEl = getElement<HTMLParagraphElement>('#feedback')
const outputStyleEl = getElement<HTMLSelectElement>('#output-style')
const platformEl = getElement<HTMLSelectElement>('#platform')
const labelStyleEl = getElement<HTMLSelectElement>('#label-style')
const separatorEl = getElement<HTMLSelectElement>('#separator')
const copyOutputButton = getElement<HTMLButtonElement>('#copy-output')
const copyLinkButton = getElement<HTMLButtonElement>('#copy-link')
const clearShortcutButton = getElement<HTMLButtonElement>('#clear-shortcut')
const clearHistoryButton = getElement<HTMLButtonElement>('#clear-history')
const historyListEl = getElement<HTMLUListElement>('#history-list')
const toggleConfigButton = getElement<HTMLButtonElement>('#toggle-config')
const configPanelEl = getElement<HTMLElement>('#config-panel')
const appShellEl = getElement<HTMLElement>('.app-shell')

const symbolsLabelOption = getElement<HTMLOptionElement>('#label-style option[value="symbols"]')

outputStyleEl.value = config.outputStyle
platformEl.value = config.platform
labelStyleEl.value = config.labelStyle
separatorEl.value = config.separator

updateConfigPanelUi()
updateLabelStyleOptions()

document.addEventListener('keydown', (event) => {
  if (shouldIgnoreCapture(event) || event.repeat) {
    return
  }

  const capturedShortcut = shortcutFromKeyboardEvent(event)

  if (capturedShortcut.modifiers.length === 0 && !capturedShortcut.key) {
    return
  }

  currentShortcut = capturedShortcut
  updateHistory(capturedShortcut)
  render()
})

toggleConfigButton.addEventListener('click', () => {
  isConfigPanelOpen = !isConfigPanelOpen
  writeConfigPanelState(isConfigPanelOpen)
  updateConfigPanelUi()
})

outputStyleEl.addEventListener('change', () => {
  config.outputStyle = outputStyleEl.value as OutputStyle
  render()
})

platformEl.addEventListener('change', () => {
  config.platform = platformEl.value as PlatformPreference
  updateLabelStyleOptions()
  render()
})

labelStyleEl.addEventListener('change', () => {
  config.labelStyle = labelStyleEl.value as LabelStyle
  render()
})

separatorEl.addEventListener('change', () => {
  config.separator = separatorEl.value as SeparatorStyle
  render()
})

copyOutputButton.addEventListener('click', async () => {
  const result = formatShortcut(currentShortcut, config)

  if (!result.displayOutput) {
    setFeedback('Capture a shortcut before copying it.')
    return
  }

  try {
    await navigator.clipboard.writeText(`${outputEl.value} `)
    setFeedback('Shortcut copied.')
  } catch (error) {
    setFeedback(toErrorMessage(error))
  }
})

copyLinkButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(getShareUrl(config))
    setFeedback('Share link copied.')
  } catch (error) {
    setFeedback(toErrorMessage(error))
  }
})

clearShortcutButton.addEventListener('click', () => {
  currentShortcut = { modifiers: [], key: null }
  render()
  setFeedback('Shortcut cleared.')
})

clearHistoryButton.addEventListener('click', () => {
  historyItems = []
  writeHistory(historyItems)
  renderHistory()
  setFeedback('History cleared.')
})

historyListEl.addEventListener('click', (event) => {
  const button = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-index]') : null

  if (!button) {
    return
  }

  const entry = historyItems[Number(button.dataset.index)]

  if (!entry) {
    return
  }

  currentShortcut = entry
  render()
  setFeedback('Shortcut restored from history.')
})

render()

function render(): void {
  const result = formatShortcut(currentShortcut, config)
  detectedPlatformEl.textContent = PLATFORM_LABELS[detectPlatform()]
  outputEl.value = result.displayOutput || 'Press a shortcut to generate output.'
  renderedOutputEl.innerHTML = result.htmlOutput || '<span class="placeholder">Your rendered shortcut preview will appear here.</span>'
  syncUrl(config)
  renderHistory()
}

function renderHistory(): void {
  if (historyItems.length === 0) {
    historyListEl.innerHTML = '<li class="history-empty">No shortcuts captured yet.</li>'
    return
  }

  historyListEl.innerHTML = historyItems
    .map((shortcut, index) => {
      const label = formatShortcut(shortcut, config).plainText

      return `<li><button type="button" class="history-item" data-index="${index}" aria-label="Click to restore ${escapeMarkup(label)}"><code>${escapeMarkup(label)}</code><span class="history-item__action" aria-hidden="true">Click to restore</span></button></li>`
    })
    .join('')
}

function updateHistory(shortcut: Shortcut): void {
  if (shortcut.modifiers.length === 0 && !shortcut.key) {
    return
  }

  historyItems = [shortcut, ...historyItems.filter((entry) => !sameShortcut(entry, shortcut))].slice(
    0,
    HISTORY_LIMIT,
  )
  writeHistory(historyItems)
}

function updateLabelStyleOptions(): void {
  const supportsSymbols = resolvePlatform(config.platform) === 'mac'
  const symbolsOptionPresent = labelStyleEl.contains(symbolsLabelOption)

  if (!supportsSymbols && config.labelStyle === 'symbols') {
    config.labelStyle = 'auto'
    labelStyleEl.value = 'auto'
  }

  if (supportsSymbols && !symbolsOptionPresent) {
    labelStyleEl.append(symbolsLabelOption)
  } else if (!supportsSymbols && symbolsOptionPresent) {
    symbolsLabelOption.remove()
  }
}

function updateConfigPanelUi(): void {
  appShellEl.classList.toggle('app-shell--config-open', isConfigPanelOpen)
  toggleConfigButton.textContent = isConfigPanelOpen ? 'Hide options' : 'Show options'
  toggleConfigButton.setAttribute('aria-expanded', String(isConfigPanelOpen))
  configPanelEl.setAttribute('aria-hidden', String(!isConfigPanelOpen))
}

function readConfigFromUrl(): FormatterConfig {
  const params = new URLSearchParams(window.location.search)

  return {
    platform: readEnumValue(params.get('platform'), ['auto', 'mac', 'windows', 'linux'], DEFAULT_CONFIG.platform),
    outputStyle: readEnumValue(
      params.get('style'),
      ['plain', 'markdown-kbd', 'html-kbd', 'html-button', 'mac-symbols'],
      DEFAULT_CONFIG.outputStyle,
    ),
    labelStyle: readEnumValue(params.get('labels'), ['auto', 'short', 'long', 'symbols'], DEFAULT_CONFIG.labelStyle),
    separator: readEnumValue(params.get('separator'), ['space', 'plus'], DEFAULT_CONFIG.separator),
  }
}

function readConfigPanelState(): boolean {
  const stored = window.localStorage.getItem(CONFIG_PANEL_STATE_KEY)
  return stored === 'true'
}

function writeConfigPanelState(isOpen: boolean): void {
  window.localStorage.setItem(CONFIG_PANEL_STATE_KEY, String(isOpen))
}

function readHistory(): Shortcut[] {
  try {
    const stored = window.localStorage.getItem(HISTORY_KEY)
    const parsed: unknown = stored ? JSON.parse(stored) : null

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isShortcut).slice(0, HISTORY_LIMIT)
  } catch {
    return []
  }
}

function isShortcut(value: unknown): value is Shortcut {
  if (!value || typeof value !== 'object') {
    return false
  }

  const { modifiers, key } = value as Shortcut
  const validModifiers =
    Array.isArray(modifiers) && modifiers.every((modifier) => ['ctrl', 'alt', 'shift', 'meta'].includes(modifier))

  return validModifiers && (typeof key === 'string' || key === null)
}

function writeHistory(items: Shortcut[]): void {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items))
}

function sameShortcut(a: Shortcut, b: Shortcut): boolean {
  return a.key === b.key && a.modifiers.join() === b.modifiers.join()
}

function syncUrl(nextConfig: FormatterConfig): void {
  const params = new URLSearchParams()
  params.set('platform', nextConfig.platform)
  params.set('style', nextConfig.outputStyle)
  params.set('labels', nextConfig.labelStyle)
  params.set('separator', nextConfig.separator)
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
}

function getShareUrl(nextConfig: FormatterConfig): string {
  const params = new URLSearchParams()
  params.set('platform', nextConfig.platform)
  params.set('style', nextConfig.outputStyle)
  params.set('labels', nextConfig.labelStyle)
  params.set('separator', nextConfig.separator)
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`
}

function shouldIgnoreCapture(event: KeyboardEvent): boolean {
  const target = event.target

  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.closest('[data-ignore-shortcut-capture="true"]')) {
    return true
  }

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true
  }

  return target.isContentEditable
}

function setFeedback(message: string): void {
  feedbackEl.textContent = message
}

function readEnumValue<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && allowed.includes(value as T) ? (value as T) : fallback
}

function getElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)

  if (!element) {
    throw new Error(`Expected element ${selector}`)
  }

  return element
}

function escapeMarkup(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Clipboard access failed.'
}
