import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

app.innerHTML = `
  <main class="about-shell">
    <section class="about-panel panel">
      <p class="section-label">About</p>
      <h1>Keyboard shortcut notation maker</h1>
      <p class="about-copy">
        This project captures keyboard shortcuts and turns them into reusable notation for documentation,
        UI copy, and HTML snippets.
      </p>
      <p class="about-copy">
        It supports plain text, Markdown-style <code>&lt;kbd&gt;</code>, HTML <code>&lt;kbd&gt;</code>,
        HTML <code>&lt;button&gt;</code>, and macOS symbol-oriented output, plus readable share URLs for the current settings.
      </p>
      <div class="button-row">
        <a href="./" class="button-link">Back to app</a>
      </div>
    </section>
  </main>
`
