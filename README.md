# CardAlive — landing page

Marketing site and waitlist for **CardAlive**, a mixed-reality dark-fantasy adventure for Meta
Quest 3: summon Kishi, the Fallen Paladin, from a printed card, carry him through a dying
Gothic city, and face Jaw, the Mawborn, at its heart.

Live: https://cardalive.xyz (GitHub Pages, deploy from `master` / root). Plain HTML, CSS and JS,
no build step.

## How the page works

The page does not scroll. It is a fixed stage of seven full-screen scenes over a real-time city drawn
on a `<canvas>` (`assets/js/world.js`, three.js from jsDelivr through the import map in
`index.html`). One wheel flick, swipe or arrow key moves one scene; the camera flies there on an arc
over the roofs while the text dissolves out and re-forms.

| # | Scene (`id`) | Camera (`data-cam`) | What's in it |
|---|---|---|---|
| I | `hero` | `hero` | logo, tagline, waitlist button (flies to VI), the trailer teaser |
| II | `kishi` | `companion` | holographic card, Kishi, his arts |
| III | `scales` | `scale-world` / `scale-table` / `scale-diorama` | the three scales, the Veil Dive |
| IV | `city` | one per district | auto-tour of the road north; click any stop on the route bar |
| V | `maw` | `maw` | Jaw and the fight |
| VI | `waitlist` | `finale` | the lantern: waitlist email field, the vision line, early footage in a dialog |
| VII | `contact` | `contact` | contact email field ("Send a raven"), fine print |

The district tour runs Lantern Row → Weighhouse Market → Assize Quay → the Underline → the Great Span
→ Cinder Close → Cathedral Plaza → the Cathedral (`STOPS` in `main.js`). The hard-light bridge
builds itself at the Great Span stop. Camera keyframes live in `KF` in `world.js`; to add a scene,
add a `<section class="scene">` with `data-cam`, `data-corr` and `data-title`, and its keyframe.

`assets/js/main.js` owns the page state in `window.CA`; `world.js` reads it every frame:

| State | Set by | What the city does |
|---|---|---|
| `camKey` | the scene, district or scale tab | the camera flies to that keyframe |
| `corr` | `data-corr` / each district | corruption roots grow out from the Cathedral |
| `span` | the Great Span stop | the hard-light deck builds plank by plank |
| `veil` | the Veil Dive button | the whole city turns to blueprint |
| `boss`, `hit`, `withdrawn` | the Maw scene and its fight | the wound opens, flashes on hits, closes when Jaw withdraws |
| `reduceMotion` | the Reduce motion toggle (off by default) | dissolves instead of flights |

Wheel input is debounced per gesture: a trackpad flick and its inertia tail move one scene, as does
one mouse notch. Firefox's line-mode deltas are normalised. A scene whose content is taller than the
screen (small phones) scrolls inside itself first, then pages.

The fight is a small taste of the tutorial encounter: Kishi's real arts (Rending Slash 15,
Oathbreaker's Cry 22, Abyssal Cyclone 32), a 35% parry that sets up a ×1.5 riposte, and Jaw
withdrawing at 35% health instead of dying.

Sound is synthesised with WebAudio and stays off until the visitor presses **Sound**.

`/contact/` (`contact/index.html`) redirects to `/#contact` and shows the address for visitors
without JavaScript, so `cardalive.xyz/contact` is a shareable link.

## Image quality

- The post chain (bloom, tone mapping) renders into its own targets, so the canvas `antialias`
  flag would do nothing; the composer's targets are multisampled instead (4x, 2x on small screens).
- Windows, cobbles, box edges, blueprint grids and the conduit rings are procedural. Each is
  filtered with `fwidth`: crisp up close, faded to its average once it shrinks toward a pixel.
  Without that they moire and sparkle in the far and top-down views.
- Lamps and embers fade instead of flickering when they are smaller than a pixel or two.

## Fallbacks

- No WebGL, or the CDN never loads: `body.no-webgl` paints a dusk gradient and
  `assets/img/skyline.svg`. Everything else, including the fight, still works.
- Motion is **on by default**, even for `prefers-reduced-motion: reduce` (including Windows with
  *Animation effects* off). Those visitors get a **Reduce motion** button in the nav, remembered in
  `localStorage` (`ca-motion`). Reduced, the camera dissolves through dark and cuts instead of
  flying; no grain, lightning or drifting embers, and the trailer teaser shows a still frame.
- Slow GPUs: the renderer drops its pixel ratio after sustained slow frames. Small screens get a
  sparser city and fewer embers.

## Preview and screenshots

```
python -m http.server 8765
```

Then open `http://127.0.0.1:8765/`. Deep links work by scene id (`/#maw`). Debug query parameters:

| Parameter | Effect |
|---|---|
| `?still` | skip the summoning screen and the stagger, stop the tour, no lightning |
| `?cam=<key>` | open on a scene id, a district (`span`, `cathedral`, ...) or a scale (`scale-diorama`) |
| `&veil=1` | with `cam=scale-*`, start in the Veil Dive |
| `?timescale=0.1` | slow the camera flights down to inspect them |
| `?nowebgl` | preview the no-WebGL fallback |

`assets/img/og.jpg` (share image) is a 1200×630 capture of `?still&cam=hero`.

## Footage

The hero carries the 30 s trailer: `cardalive-trailer-loop.mp4` (640×360, no audio, ~1 MB) loops
muted in the corner while the hero is on screen, and opens `cardalive-trailer.mp4` (1080p, ~14 MB)
with sound in a dialog. `cardalive-trailer.jpg` is the poster. On phones the teaser sits under the
buttons as a thumbnail; on short screens it is a play mark and a label, and the loop does not load.
Re-encode from the master render:

```
ffmpeg -i ad.mp4 -c:v libx264 -preset slow -crf 22 -maxrate 5M -bufsize 10M -pix_fmt yuv420p        -c:a aac -b:a 160k -movflags +faststart cardalive-trailer.mp4
ffmpeg -i ad.mp4 -vf scale=640:-2 -c:v libx264 -preset slow -crf 27 -maxrate 900k -bufsize 1800k        -pix_fmt yuv420p -an -movflags +faststart cardalive-trailer-loop.mp4
```

`assets/video/where-we-are-now.mp4` is the early tabletop build recorded in-headset. Videos must be
**H.264** — the Quest records HEVC, which Chrome, Firefox and Android will not play:

```
ffmpeg -i raw.mp4 -vf scale=-2:720 -c:v libx264 -profile:v high -pix_fmt yuv420p \
       -preset slow -crf 24 -c:a aac -b:a 128k -movflags +faststart out.mp4
```

Apart from the trailer, in-engine captures of the city are **not** on the site: several city source
packs in the game repo are still marked `LICENSE_REVIEW_REQUIRED` (`CardAlive/Environments/ATTRIBUTION.md`).
Clear those before publishing more. The trailer's two in-engine shots (0:15–0:20, Kishi in the alley
and the city diorama) went live on 2026-10-13 on the owner's call while those packs were still under
review. If a pack turns out to forbid it, replace the trailer with a cut without them.

## Waitlist and contact

Both scenes ask for one thing, the visitor's email. There is no backend: the two forms
(`form[data-raven]`) post JSON to [FormSubmit](https://formsubmit.co)'s AJAX endpoint, which emails
each address to `cardalive@protonmail.com` (the form `action`). Subjects read
`CardAlive waitlist: <email>` or `CardAlive contact: <email>`, Reply-To is the visitor, and a
`source` field says which scene it came from. No account, no keys.

- **First use:** FormSubmit sends an *Activate Form* email to the inbox on the first submission.
  Until someone clicks it, submissions are held (up to 30 days) and arrive once it is clicked; the
  page treats that "needs activation" reply as success.
- **Spam:** a hidden `_honey` field; anything that fills it is dropped.
- **Hide the address:** after activation FormSubmit offers a random alias. Put it in place of the
  address in both `action` URLs in `index.html`.
- **Testing:** submitting locally sends a real email. To test the page without that, stub
  `window.fetch` for `formsubmit.co` (the forms only call `fetch`).
- Header and hero waitlist buttons fly to scene VI and focus the field (`data-focus`).

## Structure

```
index.html              markup, chapters, import map
assets/css/style.css    the whole look
assets/js/main.js       scenes, input, tour, card tilt, fight, email forms, sound
assets/js/world.js      the city (three.js module)
assets/img/             logo, favicon, share image, fallback skyline
assets/video/           footage + poster frames
CNAME                   cardalive.xyz — deleting it drops the custom domain
```
