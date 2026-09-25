Problem

Build a static single-page web app that captures pressed keyboard shortcuts, renders them into a configurable notation, and makes the result easy to copy. The brief in `INSTRUCTIONS.md` is the current source of truth, and the project still needs to be scaffolded from scratch.

Proposed approach

Use Vite to scaffold a static SPA, likely with plain TypeScript unless a framework becomes clearly useful during implementation. Build the app in phases: project setup, shortcut capture, formatting logic, configuration UI, copy flow, and final validation. Keep formatting logic separate from UI so additional output styles can be added cleanly.

Current state

- `INSTRUCTIONS.md` contains the product brief and technical setup request.
- The app is now scaffolded with Vite and a local git repository exists.
- The current implementation captures shortcuts, formats them in multiple output styles, supports copy actions, and exposes shareable configuration URLs.
- The latest refinement request is to make the UI more minimal, prioritize the capture area, collapse configuration by default with localStorage persistence, and move product/about copy onto a separate page linked from the footer.

Implementation plan

1. Initialize the project
   - Create a local git repository.
   - Scaffold a Vite-based static application.
   - Verify the baseline app runs and builds successfully.

2. Implement keyboard shortcut capture
   - Listen for keyboard input in the page.
   - Normalize modifier keys and choose a stable ordering.
   - Handle repeat events and edge cases so the output stays clean.

3. Build the formatting layer
   - Convert captured shortcuts into display output.
   - Support configurable naming styles such as `cmd`, `command`, or symbol-style variants where practical.
   - Keep formatting rules isolated so they can drive both preview and copy output.

4. Create the configuration UI
   - Add checkboxes and dropdowns for formatting choices.
   - Update the output live as settings change.
   - Provide sensible defaults and an easy reset path if needed.

5. Add the output and copy experience
   - Show the generated shortcut notation in a textarea or readonly field.
   - Add a copy button using the browser clipboard API.
   - Surface clear success and failure feedback.

6. Validate and polish
   - Test common combinations such as Cmd/Ctrl/Shift/Alt with letters and function keys.
   - Confirm the static production build works.
   - Leave the work ready for user review before any commit is made.

7. Refine the UI to a more minimal layout
   - Make the capture section the dominant element at the top of the page.
   - Move the detected platform display into a small footer-level detail.
   - Collapse the side configuration panel by default and persist its state in localStorage.
   - Move the app description onto a dedicated about page linked only from the footer.

Notes and considerations

- We should define shortcut ordering rules early so output is consistent across browsers and platforms.
- The brief mentions “HTML button markup”; during implementation we should decide whether that means literal HTML such as `<kbd>Ctrl</kbd>` output, `<button>Ctrl</button>` output, styled visual tokens in the UI, or both.
- Optional enhancements can be layered in without blocking the core version.

Brainstormed product ideas

- Presets for plain text, Markdown, HTML `<kbd>`, `<button>`, and macOS-style symbols.
- A platform toggle for Windows, macOS, and Linux naming conventions. Detect the platform and select based on that, fallback to macOS.
- Separate copy actions for plain text and HTML output.
- A short history of recently captured shortcuts.
- Shareable URLs that encode the current formatting settings. Make sure the URL scheme is somewhat readable.
- Accessibility helpers such as strong focus states and a manual input fallback.
