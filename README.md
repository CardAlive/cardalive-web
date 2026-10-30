# CardAlive — landing page

Marketing site for **CardAlive**, the mixed-reality platform for trading-card games on Meta Quest 3:
"Your cards. Your rules. Your world, alive." It has two audiences and two paths. **Publishers** go to
`/publishers/` and can explore a pilot. **Players** join the waitlist on the home page. The two
original prototypes on the home page (AR Card Battles and the Walk with Kishi tutorial) are presented as capability demonstrations of
the technology, not as a separate TCG. The stance is partnership: CardAlive helps and partners with
TCG publishers and does not compete with them, and the copy says so on every page. Copy must not
imply that every existing game can already be fully integrated. "Every Card Game Deserves Another
Dimension." is the signature line (`.sig`), the largest text on both pages: an italic "Every card
game deserves" over "ANOTHER DIMENSION." in condensed capitals, sized by `assets/js/fit.js` to fill
the width.

Look: a poster set inside a HUD, over the city. Night ink, bone text, gold for actions. Condensed
capitals for display with an italic serif line on top, wide capitals for HUD labels, corner brackets
on what frames something, chamfers on what you press (see "Fonts"). The tokens and rules live in
`DESIGN.md`. Readability: light text sits on the moving city, so each scene lays a dark linear scrim
over the side its text is on (`.scene--*::before`). Keep new text on a scrim or a solid surface,
never bare over the canvas. No glows, gradient text or glass: run the slop check (below) after
changing the look.

Live: https://cardalive.xyz (GitHub Pages, deploy from `master` / root). Plain HTML, CSS and JS,
no build step.

## Pages

| Path | File | What it is |
|---|---|---|
| `/` | `index.html` | the stage: four full-screen scenes over the real-time city |
| `/publishers/` | `publishers/index.html` | a plain scrolling page that sells one offer, a private four-card proof of concept: the signature line and "Bring four of your cards to life." over a still of the city; what's in a proof (a hand of four blank cards beside the terms: four characters, permitted assets, private, your game stays yours); how it works (four steps on a track, the first three private, the fourth only by mutual interest); the three prototypes inline and where we are; beyond the proof (an illustrated shared-screen booth and three longer-term directions); the pilot form with the proof at a glance, on a raised band |
| `/contact/` | `contact/index.html` | redirects to `/#contact`, shows the address without JavaScript |

## How the home page works

The page does not scroll. It is a fixed stage of four full-screen scenes over a real-time city drawn
on a `<canvas>` (`assets/js/world.js`, three.js from jsDelivr through the import map in
`index.html`). One wheel flick, swipe or arrow key moves one scene; the camera flies there on an arc
over the roofs while the text dissolves out and re-forms.

| # | Scene (`id`) | Camera (`data-cam`) | What's in it |
|---|---|---|---|
| I | `hero` | `hero` | a HUD tag top left; the trailer loop in a viewfinder on the right; across the bottom the signature line, lede, For publishers (and Watch the trailer when the viewfinder is hidden), the player waitlist link |
| II | `prototypes` | `scale-table` | See what CardAlive can do: two prototype panels of one size (01 AR Card Battles, 02 Walk with Kishi), each opens its video in a dialog; the artwork note |
| III | `waitlist` | `finale` | the tagline in a full-width band, fitted to the screen by `fit.js`, that slides in with the scroll and rests whole, "Be first to play." and a HUD panel with the waitlist field and a line to the publishers page |
| IV | `contact` | `contact` | contact email field ("Send a raven"), fine print |

Camera keyframes live in `KF` in `world.js`. It still holds the keyframes for the old district tour
and scales, which nothing uses now. To add a scene, add a `<section class="scene">` with `data-cam`,
`data-corr` and `data-title`, and its keyframe. Then renumber the `data-goto` indexes in `index.html`.
The rail on the right is built from each scene's `data-title` and numbered; a gold marker slides to
the current scene. Only the current scene is named until the rail is hovered or focused.

The HUD is decorative and `aria-hidden`: corner brackets on the viewport (`.hud-frame`, they pull in
and turn gold while `body.is-flying`), a scan line that crosses the screen in the direction of travel
on each cut (`#scan`), and a readout bottom-right with the real camera position,
read from `CA.cam` (world.js sets it to `camera.position`). Labels marked `data-decode` scramble into
place when their scene arrives. Reduced motion turns the sweep and the decoding off.

There is no loading screen: the text shows at once over the night and the city fades in behind it
when its module is ready. Text in a scene carries `.fx` (with `--d` for its stagger) to leave
quickly and settle back in.

`assets/js/main.js` owns the page state in `window.CA`; `world.js` reads it every frame:

| State | Set by | What the city does |
|---|---|---|
| `camKey` | the scene | the camera flies to that keyframe |
| `corr` | `data-corr` | corruption roots grow out from the Cathedral |
| `reduceMotion` | the Reduce motion toggle (off by default) | dissolves instead of flights |

`span`, `veil`, `boss`, `withdrawn` and `hit` stay at their defaults. They drove scenes that were
removed in the 2026-10-21 platform redesign.

Wheel input is debounced per gesture: a trackpad flick and its inertia tail move one scene, as does
one mouse notch. Firefox's line-mode deltas are normalised. A scene whose content is taller than the
screen (small phones) scrolls inside itself first, then pages.

Sound is synthesised with WebAudio and stays off until the visitor presses **Sound**.

## The city's models

The city is built once, from fixed seeds, out of a small kit of modelled pieces in `world.js`
(`piece()`), each drawn as one instanced mesh:

- **Houses**: walls, a steep gabled or low hipped slate roof, a cornice on about half, chimneys on
  the ridge, gabled dormers on steep roofs, now and then an octagonal stair turret on a corner.
- **Towers**: shaft, clasping corner piers, a parapet with gabled corner pinnacles, and an
  octagonal spire on an open belfry lantern with four lucarnes. A few spires are verdigris copper.
- **The Cathedral**: the same massing as before, so the glass, door, roots and beam still line up,
  rebuilt with stepped buttresses and pinnacles, belfry spires, lead roofs with real gables, a
  polygonal apse with radiating piers, and flying buttresses down the nave.

The street plan (which cells hold a house or a tower, and their sizes) still comes from the
original seed, so the camera keyframes frame the same city. How each block is dressed draws from a
second seed (`rd`), so it can change without moving any street.

One stone shader (`TOWN_FRAG`) dresses every piece. Walls are told from roofs by their slope.
Windows are pointed lancets laid out per face in the piece's own metres, so every wall gets whole
windows centred on it; the Cathedral gets blind arcading from the same layout. Roofs get slate
courses (or lead seams), spires get ribs and crocket bands, walls get coursed stone and quoins.
Each material compiles only the parts it uses (`WINDOWS`, `BLIND`, `SIDES8`, `ROOF`).

GPU cost, against the old box-and-pyramid city:

- The big pieces (walls, roofs, spires) go into a **depth pre-pass** first, so the stone shader
  runs about once per visible pixel instead of once per layer of town behind it. Tile-based GPUs
  (phones, tablets, Apple silicon) already do this in hardware and skip the pre-pass (`TILER`).
- The **sky draws after the city**, so its cloud noise only runs where sky shows, and the moon's
  crater noise only runs on the moon. The ground's corruption veins only run inside their reach.
  The old sky ran eight octaves of noise on every pixel before the city covered most of them.
- The **mist** is one draw instead of 34 sprites.
- Instances are sorted near-first (every camera looks north), and chimneys and dormers sink away
  past `LOD` metres.
- The trade is geometry: about 190k triangles a frame instead of 88k, which is small next to the
  pixel work saved.

## Image quality

- The post chain (bloom, tone mapping) renders into its own targets, so the canvas `antialias`
  flag would do nothing; the composer's targets are multisampled instead (4x, 2x on small screens).
- Windows, glazing bars, sills, stone courses, quoins, slates, spire ribs, cobbles, blueprint grids
  and the conduit rings are procedural. Each is filtered: crisp up close, faded to its average once
  it shrinks toward a pixel. Without that they moire and sparkle in the far and top-down views.
- Lamps and embers fade instead of flickering when they are smaller than a pixel or two.

## Fallbacks

- No WebGL, or the CDN never loads: `body.no-webgl` paints a dusk gradient and
  `assets/img/skyline.svg`. Everything else still works.
- Motion is **on by default**, even for `prefers-reduced-motion: reduce` (including Windows with
  *Animation effects* off). Those visitors get a **Reduce motion** button in the nav, remembered in
  `localStorage` (`ca-motion`). Reduced, the camera dissolves through dark and cuts instead of
  flying; no lightning, drifting embers or drifting mist, text fades without moving, and the hero
  teaser shows a still frame.
- Slow GPUs: the renderer drops its pixel ratio after sustained slow frames. Small screens get a
  sparser city and fewer embers.
- `/publishers/` has no live city: its hero is a still frame of it (`assets/img/city-cathedral.jpg`,
  the `contact` camera captured from `?still&cam=contact` with the UI hidden, 1600×900).

## Preview and screenshots

```
python -m http.server 8765
```

Then open `http://127.0.0.1:8765/` or `http://127.0.0.1:8765/publishers/`. Deep links work by scene
id (`/#prototypes`). Old ids from the dark-fantasy site (`#kishi`, `#maw`, ...) open the hero.
Debug query parameters:

| Parameter | Effect |
|---|---|
| `?still` | no entrance stagger, no lightning |
| `?cam=<scene id>` | open on a scene |
| `?timescale=0.1` | slow the camera flights down to inspect them |
| `?nowebgl` | preview the no-WebGL fallback |
| `?gputime` | log the GPU's time per frame to the console every 120 frames (Chrome; needs `EXT_disjoint_timer_query_webgl2`) |

Headless Chrome will not lay out narrower than about 500 px. For phone widths, screenshot a page
that holds the site in a 390 px `<iframe>`.

`assets/img/og.jpg` (share image, both pages) is a 1200×630 capture of `?still` with the nav, rail
and hint hidden.

### Slop check

[Impeccable](https://impeccable.style)'s detector (listed on designeer.xyz) checks the rendered page
for generated-UI tells: glows, gradient text, kickers, nested cards, tiny text, long lines, low
contrast. Run it against the preview server for every scene, at desktop and phone sizes:

```
npx impeccable detect http://127.0.0.1:8765/?still
npx impeccable detect --viewport 390x844 "http://127.0.0.1:8765/?still#waitlist"
npx impeccable detect http://127.0.0.1:8765/publishers/
```

Use `#scene` deep links rather than `&cam=`: on Windows `npx` hands the URL to `cmd`, which splits it
at `&`. A clean scan prints nothing.

## Footage

| Video | Where | Source |
|---|---|---|
| Trailer, 40 s | hero button, hero teaser | `assets/video/cardalive-trailer.mp4` (+ `-loop.mp4` teaser, `.jpg` poster) |
| Prototype 01 · AR Card Battles, 1:05 | scene II dialog, `/publishers/` inline | `assets/video/where-we-are-now.mp4`, the tabletop card battle recorded in-headset. Thumbnail `assets/img/prototype-01.jpg` |
| Prototype 02 · Kishi City, 1:16 | `/publishers/` inline (off the home page since 2026-10-30) | YouTube, unlisted on the CardAlive channel: `3THAZpt9uw8` ("Prototype 02: Every Character Has a World"). Thumbnail `assets/img/prototype-02.jpg` is YouTube's 640×480 `sddefault` frame with the letterbox cropped off |
| Prototype 03 · Walk with Kishi, 2:05 | scene II dialog (numbered 02 there, tagged in development), `/publishers/` inline | `assets/video/walk-with-kishi.mp4`, the CardAlive Tutorial build (`com.cardalive.sgcitywalk.master`) recorded in-headset on 2026-10-29: Kishi's city projected onto a desk, then the walk with him and the bridge carry. Re-encoded from the Quest's HEVC to H.264 720p30 (the command below, plus `fps=30`). Poster `assets/video/walk-with-kishi.jpg` and thumbnail `assets/img/prototype-03.jpg` are the 0:23 frame |

YouTube loads only when a visitor presses play: a scene II dialog with `data-yt` builds the player when it
opens and removes it on close (none uses it now), and `/publishers/` swaps the still for the player in place
(`assets/js/publishers.js`). Both use `youtube-nocookie.com`. To use a YouTube upload for Prototype 01
too, give its dialog a `<div class="reel__video" data-yt="ID">` instead of the `<video>`, and give its
`/publishers/` button `data-yt` instead of `data-src`.

The teaser is a muted loop of 0:06–0:36 (`cardalive-trailer-loop.mp4`, 640×360, ~1.5 MB) in a
bracketed 16:9 viewfinder on the hero's right; clicking it opens the full cut with sound. It shows
from 1100×720 up, and there it replaces the Watch the trailer button; smaller screens hide it, the
loop never loads, and the button carries the trailer. Bump the `?v=` on the
trailer URLs in `index.html` when you replace a file. Re-encode from the master render:

```
ffmpeg -i ad.mp4 -c:v libx264 -preset slow -crf 22 -maxrate 5M -bufsize 10M -pix_fmt yuv420p \
       -c:a aac -b:a 160k -movflags +faststart cardalive-trailer.mp4
ffmpeg -ss 6 -t 30 -i ad.mp4 -vf scale=640:-2 -c:v libx264 -preset slow -crf 27 -maxrate 900k \
       -bufsize 1800k -pix_fmt yuv420p -an -movflags +faststart cardalive-trailer-loop.mp4
```

Local videos must be **H.264**. The Quest records HEVC, which Chrome, Firefox and Android will not play:

```
ffmpeg -i raw.mp4 -vf scale=-2:720 -c:v libx264 -profile:v high -pix_fmt yuv420p \
       -preset slow -crf 24 -c:a aac -b:a 128k -movflags +faststart out.mp4
```

Several city source packs in the game repo are still marked `LICENSE_REVIEW_REQUIRED`
(`CardAlive/Environments/ATTRIBUTION.md`). In-engine captures of the city are on the site in three
places only. The first is the trailer's two in-engine shots (0:26–0:30 of the 40 s cut, Kishi in the
alley and the city diorama), live since 2026-10-13 on the owner's call. The second is Prototype 02's
video and thumbnail, which the 2026-10-21 redesign brief asked for. The third is Prototype 03's video,
poster and thumbnail, added on the owner's request on 2026-10-29. If a pack turns out to forbid
this, re-cut the trailer and the Prototype 02 and 03 videos without it, and pick other thumbnails.

## Forms: waitlist, contact, pilot

Each form asks for the visitor's email. The pilot form also has optional company/game and message
fields. There is no backend: every `form[data-raven]` (`assets/js/forms.js`, shared by both pages)
posts all its fields as JSON to [FormSubmit](https://formsubmit.co)'s AJAX endpoint. FormSubmit
emails them to `cardalive@protonmail.com` (the form `action`). Subjects read
`CardAlive waitlist: <email>`, `CardAlive contact: <email>` or `CardAlive pilot inquiry: <email>`,
Reply-To is the visitor, and a `source` field says which form it came from. No account, no keys.

- **First use:** FormSubmit sends an *Activate Form* email to the inbox on the first submission.
  Until someone clicks it, submissions are held (up to 30 days) and arrive once it is clicked; the
  page treats that "needs activation" reply as success.
- **Spam:** a hidden `_honey` field; anything that fills it is dropped.
- **Hide the address:** after activation FormSubmit offers a random alias. Put it in place of the
  address in all three `action` URLs (two in `index.html`, one in `publishers/index.html`).
- **Testing:** submitting locally sends a real email. To test the page without that, stub
  `window.fetch` for `formsubmit.co` (the forms only call `fetch`).
- Sounds: `forms.js` fires a `ca:sfx` event; `main.js` plays it on the home page.
- The header waitlist button and the hero's player link fly to scene III and focus the field (`data-focus`).

## Structure

```
index.html                 home: the stage, import map
publishers/index.html      the publisher page
contact/index.html         redirect to /#contact
assets/css/style.css       the whole look (publishers reuses its tokens, buttons, type, frames, fields)
assets/css/publishers.css  publisher page layout, scrolling, pilot form
assets/js/main.js          scenes, input, HUD (rail, readout, scan, decode), footage dialogs, sound
assets/js/forms.js         email forms (both pages)
assets/js/fit.js           sizes the signature line to the width (both pages)
assets/js/publishers.js    in-place video players and the hand's deal on /publishers/
assets/js/world.js         the city (three.js module)
assets/img/                logo, favicon, share image, prototype thumbnails, fallback skyline,
                           city-cathedral.jpg (the /publishers/ hero)
DESIGN.md                  tokens and rules for the look
assets/video/              trailer, Prototypes 01 and 03, poster frames
CNAME                      cardalive.xyz — deleting it drops the custom domain
```

## Fonts

Two families from Google Fonts (both SIL Open Font License), Segoe UI and Georgia as fallbacks:

- [Archivo](https://fonts.google.com/specimen/Archivo), variable in width and weight
  (`wdth,wght@62..125,400..800`). Display capitals are 800 at `font-stretch: 62%`; reading text is 400
  at 100%; HUD labels, nav, buttons and the rail are 600 at 125%, uppercase, tracked 0.12 to 0.14em.
- [Newsreader](https://fonts.google.com/specimen/Newsreader) italic 400, only for the line that sits
  on top of a display line (`.sig__kick`, `<em>` inside `.h2`).

Numbers in the HUD use `font-variant-numeric: tabular-nums`. Avoid Inter, Roboto, Geist and the like: the slop
check flags them as overused.
