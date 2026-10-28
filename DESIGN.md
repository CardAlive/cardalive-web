---
name: CardAlive
description: A night city, one typeface, gold for what you can press. The mixed-reality platform for trading-card games.
colors:
  night: "oklch(0.14 0.02 285)"
  night-2: "oklch(0.185 0.022 285)"
  night-3: "oklch(0.235 0.025 285)"
  bone: "oklch(0.94 0.018 85)"
  bone-2: "oklch(0.84 0.02 85)"
  bone-3: "oklch(0.72 0.02 85)"
  line: "oklch(0.94 0.018 85 / 0.16)"
  line-2: "oklch(0.94 0.018 85 / 0.32)"
  gold: "oklch(0.81 0.115 78)"
  gold-hi: "oklch(0.87 0.1 82)"
  gold-ink: "oklch(0.23 0.045 60)"
  err: "oklch(0.8 0.12 22)"
  scrim: "oklch(0.12 0.02 285)"
  video-black: "#000"
typography:
  signature:
    fontFamily: "Switzer, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 1.1rem + 3.1vw, 4.75rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Switzer, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.25rem + 2.1vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Switzer, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 1.05rem + 0.55vw, 1.625rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  lede:
    fontFamily: "Switzer, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.125rem, 1.02rem + 0.3vw, 1.3125rem)"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Switzer, Segoe UI, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Switzer, Segoe UI, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.4
  input:
    fontFamily: "Switzer, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
  chip:
    fontFamily: "Switzer, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1
  fine:
    fontFamily: "Switzer, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  focus: "2px"
  control: "4px"
  surface: "8px"
spacing:
  gutter: "clamp(16px, 4.5vw, 72px)"
  rail: "132px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.gold-ink}"
    rounded: "{rounded.control}"
    height: "50px"
    padding: "0 22px"
  button-primary-hover:
    backgroundColor: "{colors.gold-hi}"
  button-line:
    backgroundColor: "{colors.night}"
    textColor: "{colors.bone}"
    rounded: "{rounded.control}"
    height: "50px"
    padding: "0 22px"
  field:
    backgroundColor: "{colors.night}"
    textColor: "{colors.bone}"
    rounded: "{rounded.control}"
    height: "52px"
  frame:
    backgroundColor: "{colors.video-black}"
    rounded: "{rounded.surface}"
  chip:
    backgroundColor: "{colors.night}"
    textColor: "{colors.bone}"
    rounded: "{rounded.control}"
    height: "34px"
  panel:
    backgroundColor: "{colors.night-2}"
    textColor: "{colors.bone}"
    rounded: "{rounded.surface}"
    padding: "30px 32px 32px"
---

# CardAlive design

## Overview

A night city with plain type set over it. The home page is a fixed stage of four scenes over a
real-time gothic city (`assets/js/world.js`); the city carries the mood, so the interface stays
quiet: one typeface, two surfaces, and gold only on what you can press. `/publishers/` is a plain
scrolling page in the same world: a still frame of the city, night ink below, and the pilot form on a
slightly raised band.

The page is for persuasion. Publishers should leave knowing CardAlive partners with them and that
their game stays theirs. Players should leave on the waitlist. "Every Card Game Deserves Another
Dimension." is the largest text after the logo on both pages.

## Colors

- **Night** (`night`, `night-2`, `night-3`): the ground and the surfaces on it. Violet-tinted to
  sit with the city's sky. `night-2` is the one raised surface (panels, the pilot band, the dialog).
- **Bone** (`bone`, `bone-2`, `bone-3`): text. `bone-2` for body copy and ledes, `bone-3` for fine
  print, meta lines, placeholders and the inactive rail. All pass 4.5:1 on night.
- **Gold**: buttons, focus rings, the current rail mark, link underlines, step numbers, and the
  "Your game. Our technology." line. Text on gold is `gold-ink`, never white.
- No other accent. The city's own lights carry the cyan and violet.

## Typography

- **Switzer** for everything, from the signature line to the fine print. Hierarchy comes from size
  and weight: 700 for the signature line and headlines, 600 for titles, buttons and emphasis, 500 for
  nav and labels, 400 for reading.
- Headlines take slight negative tracking (`-0.02em` to `-0.01em`); body text takes none.
- Durations and step numbers use tabular figures.
- Sentence case everywhere. No tracked uppercase labels, no second display face, no monospace.
- Headings balance (`text-wrap: balance`); paragraphs, list items and cells use `pretty`.

## Layout

- Home scenes pad by `gutter` on the left and `gutter + rail` on the right, so text never runs
  under the scene rail. Hero bottom-left with the trailer loop on the right; prototypes as a 7/5
  split with frames of unequal size; waitlist as tagline left and panel right; contact left over the
  cathedral.
- Every scene must fit 1280×720 without scrolling; `.demos` is capped at `129vh` wide for that.
- `/publishers/` sections sit in a 1160px column with 80–140px between sections and more space
  above a heading than below it.
- Phones: one column, the scene scrolls inside itself before it pages.

## Elevation & Depth

Flat. Surfaces are set apart by `night-2` and a `line` border, not by shadow; only the dialog casts
one. Legibility over the city comes from linear scrims on each scene's text side (`scrim` at 45–92%
alpha), not from radial spotlights. Text over the city may carry a short offset shadow,
`0 1px 3px rgb(0 0 0 / 0.8)`.

## Shapes

Two radii: `control` 4px for buttons, fields, tools and chips; `surface` 8px for video frames,
panels and the dialog.

## Components

- **Buttons**: gold (primary) or line (secondary, translucent night with a `line-2` border). Icons
  are Lucide paths in the page's SVG sprite, 18px, stroke 2. The arrow nudges 3px on hover.
- **Frame**: a 16:9 video still or loop with a chip (play icon and duration) bottom-left. The chip
  turns gold on hover. Used by the hero teaser and both prototypes.
- **Plate**: a frame, then title, a `bone-3` meta line and one sentence.
- **Panel**: `night-2`, `line` border, `surface` radius. Holds the waitlist form and the pilot form.
- **Field**: input plus an inset gold send button; focuses with a gold border.
- **Rail**: scene names with a line that grows and turns gold on the current scene. Names hide
  under 1000px.

## Do's and Don'ts

- Do keep text on a scrim or a solid surface.
- Do reuse frame, panel and field before adding a component.
- Don't add a second typeface, a monospace, or decorative card chrome (cost rows, type lines,
  tilted cards, inset frame lines).
- Don't add labels above headings, numbered section labels, gradient text, glows, glass, pulsing
  dots or spinning borders.
- Don't add a second accent color.
- Don't use em dashes in copy, or slogan pairs of the "not X, but Y" kind. Say the partnership plainly.
- Run the Impeccable detector (README "Slop check") on every scene after a visual change.
