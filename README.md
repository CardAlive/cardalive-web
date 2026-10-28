# CardAlive — landing page

Marketing site for **CardAlive**, the mixed-reality platform for trading-card games on Meta Quest 3:
"Your cards. Your rules. Your world, alive." It has two audiences and two paths. **Publishers** go to
`/publishers/` and can explore a pilot. **Players** join the waitlist on the home page. The two
original prototypes (AR Card Battles and Kishi City) are presented as capability demonstrations of
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
| `/publishers/` | `publishers/index.html` | a plain scrolling page: the signature line and "Your game. Our technology." over a still of the city, Your game stays yours, both demos inline, the capability table, where we are, the Explore a Pilot form on a raised band |
| `/contact/` | `contact/index.html` | redirects to `/#contact`, shows the address without JavaScript |

## How the home page works

The page does not scroll. It is a fixed stage of four full-screen scenes over a real-time city drawn
on a `<canvas>` (`assets/js/world.js`, three.js from jsDelivr through the import map in
`index.html`). One wheel flick, swipe or arrow key moves one scene; the camera flies there on an arc
over the roofs while the text dissolves out and re-forms.

| # | Scene (`id`) | Camera (`data-cam`) | What's in it |
|---|---|---|---|
| I | `hero` | `hero` | HUD tags top; the trailer loop in a viewfinder on the right; across the bottom the signature line, lede, For publishers (and Watch the trailer when the viewfinder is hidden), the player waitlist link |
| II | `prototypes` | `scale-table` | See what CardAlive can do: two prototype panels of unequal width, each opens its video in a dialog; the artwork note |
| III | `waitlist` | `finale` | the tagline as a full-width band that slides in with the scroll, "Be first to play." and a HUD panel with the waitlist field and a line to the publishers page |
| IV | `contact` | `contact` | contact email field ("Send a raven"), fine print |

Camera keyframes live in `KF` in `world.js`. It still holds the keyframes for the old district tour
and scales, which nothing uses now. To add a scene, add a `<section class="scene">` with `data-cam`,
`data-corr` and `data-title`, and its keyframe. Then renumber the `data-goto` indexes in `index.html`.
The rail on the right is built from each scene's `data-title` and numbered; a gold marker slides to
the current scene.

The HUD is decorative and `aria-hidden`: corner brackets on the viewport (`.hud-frame`, they pull in
and turn gold while `body.is-flying`), a scan line that crosses the screen in the direction of travel
on each cut (`#scan`), and a readout bottom-right with the scene number and the real camera position,
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

## Image quality

- The post chain (bloom, tone mapping) renders into its own targets, so the canvas `antialias`
  flag would do nothing; the composer's targets are multisampled instead (4x, 2x on small screens).
- Windows, cobbles, box edges, blueprint grids and the conduit rings are procedural. Each is
  filtered with `fwidth`: crisp up close, faded to its average once it shrinks toward a pixel.
  Without that they moire and sparkle in the far and top-down views.
- Lamps and embers fade instead of flickering when they are smaller than a pixel or two.

## Fallbacks

- No WebGL, or the CDN never loads: `body.no-webgl` paints a dusk gradient and
  `assets/img/skyline.svg`. Everything else still works.
- Motion is **on by default**, even for `prefers-reduced-motion: reduce` (including Windows with
  *Animation effects* off). Those visitors get a **Reduce motion** button in the nav, remembered in
  `localStorage` (`ca-motion`). Reduced, the camera dissolves through dark and cuts instead of
  flying; no lightning or drifting embers, text fades without moving, and the hero teaser shows a
  still frame.
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
| Prototype 02 · Kishi City, 1:16 | scene II dialog, `/publishers/` inline | YouTube, unlisted on the CardAlive channel: `3THAZpt9uw8` ("Prototype 02: Every Character Has a World"). Thumbnail `assets/img/prototype-02.jpg` is YouTube's 640×480 `sddefault` frame with the letterbox cropped off |

YouTube loads only when a visitor presses play: the scene II dialog builds the player when it opens
and removes it on close, and `/publishers/` swaps the still for the player in place
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
(`CardAlive/Environments/ATTRIBUTION.md`). In-engine captures of the city are on the site in two
places only. The first is the trailer's two in-engine shots (0:26–0:30 of the 40 s cut, Kishi in the
alley and the city diorama), live since 2026-10-13 on the owner's call. The second is Prototype 02's
video and thumbnail, which the 2026-10-21 redesign brief asked for. If a pack turns out to forbid
this, re-cut the trailer and the Prototype 02 video without it, and pick another thumbnail.

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
assets/js/publishers.js    in-place video players on /publishers/
assets/js/world.js         the city (three.js module)
assets/img/                logo, favicon, share image, prototype thumbnails, fallback skyline,
                           city-cathedral.jpg (the /publishers/ hero)
DESIGN.md                  tokens and rules for the look
assets/video/              trailer, Prototype 01, poster frames
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
