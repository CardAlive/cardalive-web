---
name: CardAlive
description: A poster set inside a HUD, over a night city. Condensed capitals, an italic voice, brackets on what frames, chamfers on what you press, gold for actions. The mixed-reality platform for trading-card games.
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
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "fitted to the width (fit.js), at most 21vh"
    fontWeight: 800
    fontStretch: "62%"
    lineHeight: 0.84
    textTransform: uppercase
  kick:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(1.375rem, 0.8rem + 1.9vw, 2.875rem)"
    fontStyle: italic
    fontWeight: 400
    lineHeight: 1.05
  headline:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1rem + 3.6vw, 4.75rem)"
    fontWeight: 800
    fontStretch: "62%"
    lineHeight: 0.88
    textTransform: uppercase
  title:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 1rem + 1vw, 2rem)"
    fontWeight: 800
    fontStretch: "62%"
    lineHeight: 0.92
    textTransform: uppercase
  lede:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1rem, 0.95rem + 0.25vw, 1.1875rem)"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  hud:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    fontStretch: "112%"
    letterSpacing: "0.1em"
    textTransform: uppercase
  button:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    fontStretch: "112%"
    letterSpacing: "0.1em"
    textTransform: uppercase
  input:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
  fine:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  everything: "0"
  chamfer: "7px, two corners (top-left, bottom-right)"
spacing:
  gutter: "clamp(16px, 4.5vw, 72px)"
  rail: "140px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.gold-ink}"
    shape: chamfer
    height: "46px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.gold-hi}"
  button-line:
    backgroundColor: "{colors.night} / 0.6"
    textColor: "{colors.bone}"
    border: "1px {colors.line}, brackets {colors.bone-2}, gold on hover"
    height: "46px"
  field:
    backgroundColor: "{colors.night} / 0.6"
    textColor: "{colors.bone}"
    border: "underline {colors.bone-3}, gold on focus"
    height: "50px"
  panel:
    backgroundColor: "#000 under the footage"
    border: "1px {colors.line}, brackets inset 8px"
  hudbox:
    backgroundColor: "{colors.night-2} / 0.9"
    border: "1px {colors.line}, brackets {colors.bone-2}, a header bar of HUD labels"
  chip:
    backgroundColor: "{colors.night} / 0.85"
    shape: chamfer
    height: "30px"
---

# CardAlive design

## Overview

A poster set inside a HUD. The home page is a fixed stage of four scenes over a real-time gothic city
(`assets/js/world.js`); each scroll, swipe or key moves one scene and the camera flies there. The
interface reads like a viewfinder over that flight: brackets on the corners of the screen, a scan
line on every cut, a readout of where the camera is, a rail with a sliding marker. Type does the
poster work: huge condensed capitals with an italic serif line on top. `/publishers/` is a plain
scrolling page in the same world: a still frame of the city under the same poster hero, night ink
below, and the pilot form on a slightly raised band.

The page is for persuasion. Publishers should leave knowing CardAlive partners with them and that
their game stays theirs. Players should leave on the waitlist. "Every Card Game Deserves Another
Dimension." is the largest text on both pages: no other line may be set bigger.

## Colors

- **Night** (`night`, `night-2`, `night-3`): the ground and the surfaces on it. Violet-tinted to
  sit with the city's sky. `night-2` is the one raised surface (the waitlist box, the pilot band, the
  dialog).
- **Bone** (`bone`, `bone-2`, `bone-3`): text, brackets and HUD lines. `bone-2` for body copy, ledes
  and labels, `bone-3` for fine print, the readout and inactive rail numbers.
- **Gold**: buttons, chips on hover, focus rings, the rail marker and current number, the nav
  diamond, the bracket colour on hover and in flight, the waitlist heading, "Your game. Our
  technology." and the diamonds in the band. Text on gold is `gold-ink`, never white.
- No other accent. The city's own lights carry the cyan and violet.

## Typography

- **Archivo** (variable width) for everything but one line. Three widths, three jobs:
  - 62%, weight 800, uppercase: the signature line, headings (`.h2`), titles (`.h3`, panel titles,
    the band). Line height under 0.9.
  - 100%, weight 400: reading text. Weight 600 for emphasis.
  - 112% (`--wide`), weight 600, uppercase, tracked 0.1em (`--track`), 12px: HUD labels, nav,
    buttons, chips, the rail, the readout, form labels, table heads. One width, one tracking, one
    size for all of them.
- **Newsreader italic** only for the line that sits on top of a display line: "Every card game
  deserves", and the `<em>` that opens a heading ("See what", "Get in", "Be first"). It is 0.46em of
  its heading, or the kick size on the signature. Never a whole headline.
- Outline capitals (`-webkit-text-stroke`, 1.5px) for big numerals and every other phrase of the band.
- Tabular figures for every number in the HUD.

## Layout

- Home scenes pad by `gutter` on the left and `gutter + rail` on the right, so text never runs under
  the rail or the readout.
- Hero: one HUD tag top left, the trailer viewfinder on the right, the signature line across
  the bottom with the lede (7) and the actions (5) under it. Prototypes: heading and lede, then three
  panels of one size, then the pilot link and the art note. Waitlist: the band full-bleed, then the heading
  (6) and the box (5). Contact: left over the cathedral, fine print along the bottom.
- Every scene must fit 1280×590 without scrolling (a 1280×720 laptop at 150% scaling, minus the
  browser's own bar), and tablets in portrait. Only phones and landscape phones scroll a scene.
- Keep it compact: one HUD tag on the hero, no crosshairs, one readout. When something new is added,
  take something away.
- `/publishers/` sections sit in a 1160px column with 80–140px between sections.
- Phones: one column, the signature splits onto two lines, the scene scrolls inside itself before it
  pages.

## Elevation & Depth

Flat. Surfaces are set apart by `night-2`, a 1px `line` and brackets, not by shadow; only the dialog
casts one. Legibility over the city comes from linear scrims on each scene's text side (`scrim` at
45–92% alpha). Text over the city may carry a short offset shadow, `0 1px 3px rgb(0 0 0 / 0.8)`.

## Shapes

No radii. Two marks instead:

- **Brackets**: four 1px L marks on the corners, drawn by the element's `::after` from `--bk` (colour),
  `--bl` (leg) and `--bi` (inset). Anything that frames something gets them: the viewport, the
  trailer viewfinder, panels, the waitlist box, the pilot form, video frames, line buttons, tools,
  the dialog. They grow and turn gold on hover.
- **Chamfer**: the top-left and bottom-right corners cut at 45°, drawn by the background gradient so
  focus rings are not clipped. Only what you press and is gold: primary buttons, send buttons,
  chips.

## Motion

- A cut: the old scene's text drops out fast, the scan line crosses the screen in the direction of
  travel, the viewport brackets pull in and turn gold while the camera flies, then the new scene's
  display lines rise out of a slot (`.wipe`) and the rest settles in, staggered by `--d`. HUD labels
  marked `data-decode` scramble into place. The rail marker slides.
- The band moves only when its scene arrives: in from the right going down the page, from the left
  coming back up, then rests. No looping marquees.
- Reduced motion: no flights, sweeps, decoding or band slide. Text fades without moving.

## Components

- **Buttons**: gold (primary, chamfered) or line (secondary, translucent night, `line` border and
  brackets). Wide-cap labels. Icons are Lucide paths in the page's SVG sprite, 16px, stroke 2. The
  arrow nudges 3px on hover.
- **Panel**: a prototype still with its outline numeral top left and the duration chip top right; at
  the bottom a HUD tag, the title and one sentence. Opens the footage dialog.
- **Viewfinder**: the hero's trailer loop inside brackets, with a HUD bar under it.
- **HUD box**: `night-2`, `line` border, brackets, a header bar of HUD labels with a gold diamond.
  Holds the waitlist form and the pilot form.
- **Field**: input on an underline plus a chamfered gold send button; the underline turns gold on
  focus.
- **Rail**: numbers on a 1px track; a gold marker slides to the current scene, and only its name
  shows until the rail is pointed at. Names hide under 1000px.
- **Readout**: bottom right, the camera's X / Y / Z. Hidden under 1000px and without WebGL.
- **Band**: the tagline, fitted to the content width so it rests whole; stacked on phones.

## Do's and Don'ts

- Do keep text on a scrim or a solid surface.
- Do reuse panel, HUD box, field, brackets and chamfer before adding a component.
- Do keep the HUD honest: it shows the real scene and the real camera, not invented telemetry.
- Don't set anything larger than the signature line.
- Don't add a third typeface, a monospace, or an italic serif headline.
- Don't add glows, gradient text, glass, pulsing dots, spinning borders, rounded corners or
  repeating stripe textures.
- Don't add a second accent colour.
- Don't use em dashes in copy, or slogan pairs of the "not X, but Y" kind. Say the partnership plainly.
- Run the Impeccable detector (README "Slop check") on every scene after a visual change.
