# Showtime Project Notes

## Communication

- Prefer Chinese when communicating with the project owner unless they ask otherwise.

## Product Motivation

The core motivation for Showtime is not only to draw a timeline, but to help research gain context.

When researching a person, book, event, dynasty, school of thought, technology, or any other topic, it is often much easier to understand it by placing it inside a larger background:

- what happened before and after it
- what was happening in nearby fields at the same time
- what was happening in other regions, cultures, disciplines, or systems
- what parallel timelines can be compared against the current research topic

The tool should therefore support a workflow where a user can import a focused CSV timeline and then generate or load one or more background timelines around it. These background timelines are not decorative; they are meant to support comparison, orientation, and historical or conceptual context.

Examples of useful background timelines:

- philosophers compared with emperors, dynasties, wars, religious movements, or scientific milestones
- a political event compared with literature, economics, technology, or events on other continents
- a local historical sequence compared with global context
- a narrow research subject compared with broader intellectual, cultural, or geological scales

## Product Direction

Favor features that make contextual comparison easier:

- multiple layers that can be independently loaded, hidden, renamed, reordered, and colored
- CSV formats that support both broad yearly data and precise date-level data
- generated or suggested background timelines based on an imported CSV
- clear visual distinction between the user's primary topic and contextual/background layers
- workflows that help users move from a narrow subject to a wider frame without leaving the tool

Avoid treating the timeline as a static charting widget. The intended use is exploratory research: the user should be able to bring in a topic, add surrounding context, compare layers, and notice relationships that are hard to see from isolated notes.

## Background Library

The first local background library lives in `background/`. It currently contains 40 reusable background layers. Treat these CSVs as reusable contextual layers rather than exhaustive source-of-truth chronologies. When extending the library, prefer stable, broadly useful layers that help many research topics orient themselves:

- general political skeletons
- region-level context
- thought, religion, literature, science, technology, economy, and society layers
- deep-time layers for geological and biological context

The app should keep supporting manual background loading and lightweight recommendation rules. More advanced online or LLM-generated background timelines can build on this library later, but should not replace the user's ability to inspect, load, hide, reorder, and compare concrete CSV layers.

## Current Architecture

ShowTime is a no-build static ES-module application. Keep `index.html`, `styles.css`, and `app.js` at the repository root so GitHub Pages can publish the `main` branch root directly.

- `app.js`: application orchestration only; do not move domain logic back into it
- `src/time.js`, `src/csv.js`: pure parsing and quality-report foundations
- `src/zip.js`, `src/project.js`: project package, Manifest, migration and round-trip
- `src/storage.js`, `src/state.js`: IndexedDB, edits, undo/redo and saved views
- `src/search.js`, `src/probes.js`, `src/metadata.js`: research queries and sidecars
- `src/lod.js`, `src/renderer.js`, `src/minimap.js`: semantic zoom and Canvas rendering
- `src/diff.js`, `src/statistics.js`, `src/export.js`, `src/share.js`: analysis and output
- `src/ui.js`, `src/canvas-interactions.js`: DOM rendering and input gestures

Avoid circular dependencies and large catch-all modules. Prefer exported pure functions for research logic and cover them with Node's built-in test runner.

## Data Compatibility

- The simplest timeline format must remain strict two-column `time,title` CSV.
- Never require users to add metadata columns to their primary CSV.
- Preserve legacy CSV ZIP import, including ZIPs with only `00_manifest.md`.
- A formal project uses versioned `00_manifest.json`; update `migrateManifest()` when the format evolves.
- Treat sidecar matching ambiguity as a quality issue, never as permission to guess.
- Project export/import must round-trip groups, roles, LOD, views, probes and metadata.

Specifications live in `docs/`. Keep the JSON schema, README, fixture project and implementation behavior aligned.

## Quality Gates

Before completing a change, run:

```bash
npm run check
```

For UI, import, Canvas, storage or export changes, also run the real Chrome flow in `scripts/browser-test.mjs` against `npm run dev`. Check both desktop and a 390 px touch viewport, and keep the console free of errors.

Maintain keyboard access, visible focus, non-color role cues, high-DPI Canvas rendering, `prefers-reduced-motion`, and equivalent mobile actions. Do not introduce a runtime framework, backend, account system or cloud dependency.
