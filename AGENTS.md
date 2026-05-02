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
