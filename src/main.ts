import './style.css'
import {
  detectPlatform,
  formatShortcut,
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

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

let config = readConfigFromUrl()
let currentShortcut: Shortcut = {
  modifiers: [],
  key: null,
}
let historyItems: string[] = []

app.innerHTML = `
  <main class="app-shell">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Keyboard shortcut notation maker</p>
        <h1>Capture shortcuts and export them in the format you want.</h1>
        <p class="lead">
          Press a key combination anywhere on the page. The app turns it into plain text,
          Markdown, or HTML button-style markup and keeps a shareable URL for your current settings.
        </p>
      </div>
      <div class="hero-card">
        <p class="status-label">Detected platform</p>
        <strong id="detected-platform"></strong>
        <p class="status-note">Auto mode uses the detected platform and falls back to macOS when it cannot tell.</p>
      </div>
    </section>

    <section class="layout">
      <section class="panel capture-panel">
        <div class="panel-heading">
          <div>
            <p class="section-label">Capture</p>
            <h2>Press your shortcut</h2>
          </div>
          <span class="capture-badge">Listening</span>
        </div>

        <p class="capture-help">
          Shortcut capture is active across the page. Browser-reserved shortcuts may still be intercepted before the page sees them.
        </p>

        <label class="field">
          <span>Generated output</span>
          <textarea id="shortcut-output" readonly rows="5" data-ignore-shortcut-capture="true"></textarea>
        </label>

        <div class="rendered-preview">
          <p class="section-label">Rendered preview</p>
          <div id="rendered-output" class="render-surface" aria-live="polite"></div>
        </div>

        <div class="button-row">
          <button id="copy-plain" type="button">Copy plain text</button>
          <button id="copy-html" type="button" class="secondary">Copy HTML</button>
          <button id="copy-link" type="button" class="secondary">Copy share link</button>
          <button id="clear-shortcut" type="button" class="ghost">Clear</button>
        </div>

        <p id="feedback" class="feedback" aria-live="polite"></p>
      </section>

      <aside class="panel controls-panel">
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

        <div class="tips-card">
          <p class="section-label">Ideas to explore</p>
          <ul>
            <li>Preset bundles for docs, product pages, and app UIs.</li>
            <li>Recent capture history for repeated copy workflows.</li>
            <li>Readable share links to pass formatting choices to teammates.</li>
          </ul>
        </div>

        <div class="history-card">
          <div class="history-header">
            <p class="section-label">Recent captures</p>
            <button id="clear-history" type="button" class="text-button">Clear history</button>
          </div>
          <ul id="history-list" class="history-list"></ul>
        </div>
      </aside>
    </section>
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
const copyPlainButton = getElement<HTMLButtonElement>('#copy-plain')
const copyHtmlButton = getElement<HTMLButtonElement>('#copy-html')
const copyLinkButton = getElement<HTMLButtonElement>('#copy-link')
const clearShortcutButton = getElement<HTMLButtonElement>('#clear-shortcut')
const clearHistoryButton = getElement<HTMLButtonElement>('#clear-history')
const historyListEl = getElement<HTMLUListElement>('#history-list')

outputStyleEl.value = config.outputStyle
platformEl.value = config.platform
labelStyleEl.value = config.labelStyle
separatorEl.value = config.separator

document.addEventListener('keydown', (event) => {
  if (shouldIgnoreCapture(event) || event.repeat) {
    return
  }

  const capturedShortcut = shortcutFromKeyboardEvent(event)

  if (capturedShortcut.modifiers.length === 0 && !capturedShortcut.key) {
    return
  }

  currentShortcut = capturedShortcut
  updateHistory(formatShortcut(currentShortcut, config).plainText)
  render()
})

outputStyleEl.addEventListener('change', () => {
  config.outputStyle = outputStyleEl.value as OutputStyle
  render()
})

platformEl.addEventListener('change', () => {
  config.platform = platformEl.value as PlatformPreference
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

copyPlainButton.addEventListener('click', async () => {
  const result = formatShortcut(currentShortcut, config)

  if (!result.plainText) {
    setFeedback('Capture a shortcut before copying it.')
    return
  }

  try {
    await navigator.clipboard.writeText(result.plainText)
    setFeedback('Plain-text shortcut copied.')
  } catch (error) {
    setFeedback(toErrorMessage(error))
  }
})

copyHtmlButton.addEventListener('click', async () => {
  const result = formatShortcut(currentShortcut, config)

  if (!result.htmlOutput) {
    setFeedback('Capture a shortcut before copying it.')
    return
  }

  try {
    if (typeof ClipboardItem === 'undefined') {
      await navigator.clipboard.writeText(result.htmlOutput)
    } else {
      const item = new ClipboardItem({
        'text/plain': new Blob([result.plainText], { type: 'text/plain' }),
        'text/html': new Blob([result.htmlOutput], { type: 'text/html' }),
      })

      await navigator.clipboard.write([item])
    }

    setFeedback('HTML shortcut copied.')
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
  renderHistory()
  setFeedback('History cleared.')
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
    .map((item) => `<li><code>${escapeMarkup(item)}</code></li>`)
    .join('')
}

function updateHistory(item: string): void {
  if (!item) {
    return
  }

  historyItems = [item, ...historyItems.filter((entry) => entry !== item)].slice(0, 6)
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
