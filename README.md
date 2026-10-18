<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="assets/brand/lockup-horizontal-dark-1920x640.png">
    <img src="assets/brand/lockup-horizontal-light-1920x640.png" alt="SamSUCKS" width="560">
  </picture>
</p>

<p align="center">
  <b>A Plex client for Samsung TVs that doesn't suck.</b><br>
  Smooth scrolling, hardware playback, zero dependencies.
</p>

<p align="center">
  <img src="assets/readme/home.png" alt="SamSUCKS home screen" width="880">
</p>

> **This is a fork** of [rfaile313/samsucks](https://github.com/rfaile313/samsucks).
> It adds:
>
> - **2019 TV support (Tizen 5.0).** Tested on a 2019 82" RU9000. Set `BUNDLE=1` in `.env`
>   (see [Install](#install)); the other Tizen 5.0 fixes are always on.
> - **Every server on your account at once.** Libraries from all servers appear in the
>   top nav, search covers all of them, and **Settings → Servers** turns each one on or off.
>   Home rows come from your first server.
> - **A filter bar in every library.** Press ▲ from the top row of posters: sort,
>   unwatched, genre, decade and content rating. Each library remembers its choices.
> - **Richer details pages.** Rotten Tomatoes (critics and audience), IMDb and TMDB
>   scores, and a **Cast & crew** row. Press OK on someone to see everything they're in.
> - **Background art behind library grids and person pages.**
>
> See [What this fork changes](#what-this-fork-changes) for the details.

The official Plex app on Samsung TVs is painfully slow. The same library flies on a
Fire TV or an Apple TV, so the TV isn't the problem; the app is.

On my 75" Samsung Q60B (2022, Tizen 6.5):

| | Official Plex app | SamSUCKS |
| --- | --- | --- |
| Opening the app | about a minute | about a second |
| Typing in search | every letter lags | instant |
| Search results | take forever | appear as you type |

The Plex server answers a search in 30–150 ms, so the server was never the bottleneck.

SamSUCKS is a from-scratch Plex client for Samsung's Tizen TVs, built for speed:

- **Smooth.** About 50 fps while scrolling, with a 17 ms median frame, measured on a 2022 Samsung Q60B.
- **Hardware playback.** It plays files directly through Samsung's video decoder.
  On a real 3,952-item library, 98.7% plays without any transcoding.
- **Quick to start.** Home appears in under a second, and video starts about a second after you press play.
- **Tiny.** Plain JavaScript, no framework, no npm, no build step.

## Install

You need:
- a Samsung smart TV (tested on a 2022 Q60B and a 2019 RU9000; 2019 or newer should work),
- a Mac or Linux computer on the same network as the TV,
- a Plex Media Server.

**1. Download SamSUCKS**

```sh
git clone https://github.com/jamiefisher/samsucks.git
cd samsucks
```

**2. Run setup**

```sh
./scripts/setup.sh
```

This installs Samsung's command-line tools (about 270 MB), finds your TV on the
network, and creates a signing certificate. If Developer Mode isn't turned on yet,
it stops and tells you exactly what to do, including your computer's IP address.
The steps are also below. Run it again afterwards, and it picks up where it left off.

**3. 2019 TVs only: turn on bundling**

2019 models run Tizen 5.0, whose browser can't load the app's JavaScript modules from
the TV's storage. Add this line to `.env`, and `deploy.sh` will combine them into one
script with [esbuild](https://esbuild.github.io/) (fetched automatically by `npx`, so
you need Node.js installed):

```sh
BUNDLE=1
```

**4. Install it on the TV**

```sh
./scripts/deploy.sh
```

SamSUCKS opens on the TV. Go to **[plex.tv/link](https://plex.tv/link)** on your phone
or computer and type the code it shows, or scan the QR code. That's it.

<details>
<summary><b>Turning on Developer Mode</b></summary>

1. Press **Home** on the remote and open **Apps**.
2. On the Apps screen, type **1 2 3 4 5** on the remote.
   - No number keys? Press the **123** button to bring up the on-screen keypad.
   - Nothing happened? Try again, typing a bit faster.
3. Switch **Developer mode** to **On**, and enter your computer's IP address
   (`./scripts/setup.sh` prints it).
4. Choose **OK**, then restart the TV: hold the **Power** button until it turns off and back on.

When it's on, the Apps screen shows **Develop mode** at the top.
</details>

### Opening it later

Press **Home** → **Apps** and scroll to the bottom, where your installed apps are.
To pin it to the home bar, highlight **SamSUCKS**, open its options (hold **OK**) and
choose **Add to Home**.

### Troubleshooting

| Problem | Fix |
| --- | --- |
| Typing 12345 does nothing | Make sure you're on the **Apps** screen. Use the on-screen keypad (**123** button) if your remote has no number keys, and type quickly. |
| Setup says "No Samsung TV found" | Turn the TV on and make sure it's on the same network (Wi-Fi or Ethernet) as your computer. |
| Setup says Developer Mode points at another IP | Re-enter your computer's IP in the Developer Mode popup, then restart the TV. |
| "Can't reach the TV" when deploying | Restart the TV, then run `./scripts/setup.sh` again. Your computer's IP may have changed. |
| The app disappeared | TV firmware updates can remove sideloaded apps. Run `./scripts/deploy.sh` again. |
| The sign-in code expired | Press **OK** on the sign-in screen for a new code. |

## Using it

| Remote | What it does |
| --- | --- |
| Arrows / OK | Move around / select |
| Play/Pause | Play whatever is focused, or pause and resume |
| Back | Go back (while watching, the first press hides the controls) |
| ▼ while watching | Audio and subtitle tracks |
| ◀ ▶ while watching | Seek; hold to go faster |
| ▲ from the top row of a library | Filter bar: ◀ ▶ to pick, OK to open, ▼ back to the posters |
| ▼ on a movie or show page | Seasons, episodes, then **Cast & crew**; OK on a person opens their page |
| Yellow | Change the sort order in a library |
| CH ▲ / CH ▼ | Jump by letter in a library |

What's in it: home rows (Continue Watching, On Deck, Recently Added…), full library
grids, search with the TV keyboard, movie and show pages with seasons and episodes,
resume and mark watched, audio and subtitle picker (including external `.srt` files),
up-next autoplay, and watch progress synced back to Plex. This fork adds every server
at once, library filters, ratings, cast and person pages.

## What this fork changes

<details>
<summary><b>Tizen 5.0 (2019 TVs)</b></summary>

| Problem on Tizen 5.0 (Chromium 63) | Fix |
| --- | --- |
| ES module `import`s from `file://` fail, so the app stopped at the splash screen | `BUNDLE=1` (or `deploy.sh --bundle`) bundles everything into one classic script, targeting Chrome 63 |
| The installer rejected the app | `config.xml` asks for `required_version="5.0"` instead of 6.5 |
| No `AbortController`, so request timeouts never fired and a dead server address hung for about 35 s | `request()` races each fetch against its own timer |
| `-webkit-mask-composite: source-in` also applied to the bottom mask layer, which hid all hero art | `source-in, source-over` |

Everything else runs unchanged on Tizen 5.0. Without bundling it would still be modules
plus `modulepreload`, exactly as upstream.
</details>

<details>
<summary><b>Multiple servers</b></summary>

- At sign-in the app connects to every server on the account. Upstream asked you to pick
  one. Servers that don't answer are skipped.
- Every item remembers which server it came from (`item._srv`), and `serverOf(item)` in
  `session.js` sends images, playback, progress and watched state to that server.
- The nav lists libraries from every server. When two servers have a library with the
  same name, each shows its server's name next to it.
- Home rows (Continue Watching, On Deck, Recently Added…) come from the first server,
  which is your own server if you have one. Search runs on every server and merges
  results of the same type into one row.
- All connection tiers (LAN HTTP, LAN HTTPS, remote, relay) are tried at once, but the
  fastest kind still wins. A shared server whose LAN addresses can't be reached connects
  in about 4 s instead of waiting out each tier in turn.
- **Settings → Servers** lists every server with On/Off; at least one always stays on.
- An install that already had one saved server finds the others on its next start.
</details>

<details>
<summary><b>Library filter bar</b></summary>

Press ▲ from the top row of any Movies or TV library. The chips are **Sort** (A–Z,
Recently added, Release date, Rating), **Unwatched**, **Genre**, **Decade** and **Rating**
(content rating), plus **Clear** when any filter is on. Genre, decade and rating values
come from that library on the server. Filters are saved per library, and CH ▲/▼ letter
jumps respect them.
</details>

<details>
<summary><b>Details pages, cast and people</b></summary>

- Scores come from Plex's `Rating[]` list on newer servers, or from `rating` /
  `audienceRating` on older ones. Each one gets its source's icon: Rotten Tomatoes
  tomato or splat (critics), popcorn upright or spilled (audience), IMDb, and TMDB.
  Which sources appear depends on the metadata Plex has for that title.
- **Cast & crew** lists actors (with character names) and directors as round photos.
- A person's page searches every library on that server with Plex's `actor=` /
  `director=` filter, and lists their titles newest first, one row per library.
  Other servers aren't searched, because each server numbers people differently.
</details>

## Why it's fast

Samsung TVs only run web apps, but there's nothing slow about the web engine
if you treat it like a game engine:

- Every animation is a GPU transform or fade. Nothing big is ever repainted.
- Lists reuse a fixed set of tiles instead of creating new ones as you scroll.
- The focus ring never moves. The content slides under it.
- A held-down key can never queue up work: input is applied at most once per frame.
- Plex resizes every image to exactly the pixels on screen before it's sent.
- Video goes straight to Samsung's hardware decoder. Only what the TV can't decode
  (mostly DTS audio) is converted by Plex, and the video itself is never re-encoded.

The biggest win was one line of CSS:

<p align="center">
  <img src="assets/readme/frame-trace.png" alt="Frame times for the same 12 button presses: the old renderer froze for about 2 seconds on every press and took 24.4 s; SamSUCKS finished in 3.7 s and never went above 66 ms" width="760">
</p>

A full-screen CSS gradient behind the UI took **almost two seconds** to repaint on the
TV's CPU. Now the background is a 2×2-pixel WebGL texture that the GPU stretches to
fill the screen: it looks the same and costs nothing. Want to see the difference?
**Settings → Demo: original slow renderer** brings the old one back, and
**Settings → Performance overlay** shows the frame rate.

## For developers

<details>
<summary><b>Dev loop: logs, remote control and benchmarks on the real TV</b></summary>

Chrome DevTools can't attach to a retail TV, so dev builds talk to a small server on
your computer instead. Put your computer's `host:port` in `.env` as `DEV_HOST`, then:

```sh
node tools/devserver.mjs          # receives logs and perf samples from the TV (build/tv.log)
./scripts/deploy.sh --dev         # dev build: performance overlay, logging, remote control

curl 'localhost:8790/send?keys=down,right,right,enter'       # press buttons
tools/tveval.sh 'document.title'                              # run JS on the TV, print the result
tools/tveval.sh '__bench(["right","right","left","left"], 250)'   # frame stats while replaying keys
tools/tveval.sh "__css('.hero-art{display:none}')"           # A/B test a CSS change live
```

With `DEV_SKIP_LOGIN=1` and `PLEX_SERVER_URL` in `.env`, dev builds skip sign-in and
use a server that allows unauthenticated local-network access.

The UI also runs in desktop Chrome: `./scripts/deploy.sh --build-only`, then serve
`build/app/` with any static server. It uses a `<video>` element instead of AVPlay there.
</details>

<details>
<summary><b>How the code is laid out</b></summary>

```
app/            the whole TV app; deploy.sh copies it to build/app and packages it
  js/screens/   home, library, detail, player, search, settings, login
  js/ui/        rows, grids, tiles, image loader, backdrop, perf overlay
  js/plex/      plex.tv sign-in and Plex Media Server API
  js/platform/  Tizen keys and device info, AVPlay / <video> player
scripts/        setup.sh (one-time) and deploy.sh (build + install)
tools/          dev server, TV eval, network remote
```

There's no bundler by default. The TV's browser (Chromium 69+ on Tizen 5.5+) runs ES modules
natively, and `deploy.sh` adds `<link rel="modulepreload">` tags so every module loads
in parallel (about 0.9 s cold start, versus 0.8 s for a minified bundle). On Tizen 5.0,
`BUNDLE=1` makes it one esbuild bundle instead (see [What this fork changes](#what-this-fork-changes)).
</details>

<details>
<summary><b>Performance notes</b> (measured on a 2022 Q60B, Tizen 6.5, Chromium 85)</summary>

| Background renderer | fps while navigating | worst frame |
| --- | --- | --- |
| Full-screen CSS `radial-gradient` | 11 | 1,928 ms |
| 2×2 2D canvas, stretched by CSS | 20 | 207 ms |
| 2×2 WebGL canvas, stretched by the compositor | 49–50 | 80 ms (17 ms median) |

Ruled out by A/B testing on the TV: hero image masks, the focus ring's shadow,
poster fade-ins, row opacity changes, and per-tile compositor layers. None made a
measurable difference.
</details>

<details>
<summary><b>Plex server quirks</b></summary>

- Plex Media Server 1.42 returns `400` for `start.m3u8` unless
  `/video/:/transcode/universal/decision` was called for the same session first.
- `X-Plex-Platform=Tizen` selects the server's built-in profile for the official app,
  which rejects these transcode requests, so SamSUCKS identifies itself as `Samsung`.
- Samsung TVs from 2018 on can't decode DTS. For those files Plex copies the video
  and converts only the audio, to AC3 5.1.
</details>

## Credits

Inspired by [plx-native](https://github.com/GLinnik21/plx-native), a native Plex client
for LG TVs. Fonts: [Inter](https://rsms.me/inter/) and
[Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed) (SIL Open Font
License). QR codes: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
by Kazuhiko Arase (MIT).

SamSUCKS was created by [rfaile313](https://github.com/rfaile313/samsucks); this fork
adds Tizen 5.0 support, multiple servers, library filters, ratings and cast.
SamSUCKS is an independent project, not affiliated with Plex or Samsung.

## License

Copyright © 2026 rfaile313. SamSUCKS is free software, released under the
[GNU General Public License v3.0](LICENSE): you can use, study, change and share it,
and anything you distribute that's built on it must stay open source under the same
license.
