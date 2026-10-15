# Kessler

Created by Adarsh Khera.

**Live demo: https://adarshkhera.github.io/kessler/**

Live orbital asset manager. Real element sets from CelesTrak, propagated with SGP4 in your browser. No backend.

Hierarchy: operator > constellation > satellite > subsystem.

```bash
npm install
npm run dev        # http://localhost:5173 (CelesTrak throttles repeat pulls: run npm run snapshot once for an offline copy)
npm run snapshot   # optional offline fallback into public/data (polite, idempotent). Also builds the country owner table
npm test           # unit tests for the pure modules
npm run lint
npm run verify     # types + lint + tests + build, same as CI
npm run test:coverage
npm run build
```

## Stack, and why

| Piece | Choice | Why |
|---|---|---|
| Build | Vite + TypeScript (strict) | Fast dev loop, no framework tax, type safety on the orbit maths |
| 3D | three.js, custom GLSL shaders | One `Points` object for 19k satellites with dimming done on the GPU |
| Orbits | satellite.js (SGP4) in Web Workers | Positions are calculated, not streamed; the main thread never blocks |
| UI | Small hand-written TypeScript components | About 30 KB of UI code; fewer moving parts than a framework for this size |
| Data | CelesTrak, Launch Library 2 | Public, no keys, CORS-open |
| Quality | Vitest, ESLint, GitHub Actions | `npm run verify` = types + lint + tests + build |

No React on purpose: the app is a single canvas plus a handful of panels. The UI layer is isolated in `src/ui`, so it could be wrapped in React without touching the data, simulation or scene code.

## What you get

- Full-screen globe with ~16k tracked objects, positioned live in your browser.
- A focus bar always says what is filtered and has one Clear button. Once you filter or select, hover and picking stay inside that view.
- Left nav with two modes, collapsible to badges: Fleets (SpaceX, GPS, OneWeb and more, each with a mission-type glyph) and Countries (India, United States, China and about 30 more). Hover lights them on the globe, click isolates and opens a stats card. SpaceX shows shells and the next launches. India shows NavIC, Cartosat, GSAT and more, plus its retired satellites and launch-vehicle stages (about 180 tracked objects).
- Click any dot: what it is for (inferred from name, fleet and orbit, and labelled as such), label on the globe, orbit line, ground track, coverage, nearest objects, close-approach screen, modelled health.
- Search (`/` or ⌘K), time controls (pause, 10×, 60×, 300×, Live), a time menu to jump ±1 hour or day or to any date, zoom and layer dock.
- Phone friendly: the globe fits portrait screens, cards become bottom sheets with a drag handle and the 3D view shifts up so the subject stays visible.
- Shareable deep links: `#sat=25544` or `#fleet=gps`. The Copy link button on the card copies the current view.
- First-visit tour, then a Guide button with Facts, How to use, Data and Credits.
- Keyboard: `/` search, `Space` pause, `R` reset view, `+` `-` zoom, `?` guide, `Esc` close.
- Accessible by design: focus trapping in dialogs, live-region announcements, reduced-motion support.
- Privacy: no cookies, no analytics. Only display preferences and an orbit-data cache are stored locally.

## Solar system view

Switch **Earth | Solar System** at the top, or keep zooming out of Earth. Planet positions are calculated for the current moment from JPL's approximate Keplerian elements (validated in `tests/ephemeris.test.ts`), each body's spin axis uses its IAU pole direction, and everything is lit from the Sun's real direction, so Saturn's rings, Earth's night side and Uranus's sideways tilt are geometrically right. Planets stay visible when far and snap to true size up close. Zoom into Earth and the satellites appear around it at true scale. Click a world (name or body), use the Inner / Outer / All presets, or press ← → to visit the next one. Time buttons switch to days and years per second. Moon positions are exact for Earth's Moon and illustrative for the others.

## How it works

- `src/data/load.ts` pulls 20 CelesTrak GP groups (JSON/OMM), validates every row, caches in IndexedDB for 2 h, falls back to `public/data/*.json`. A 403/429 from CelesTrak starts a 2 h back-off so reloads never hammer them.
- `src/data/owners.ts` loads `public/data/owners.json` (NORAD id to SATCAT owner code, built by `npm run snapshot` from the CelesTrak SATCAT) so the Countries view works without downloading the 6 MB catalogue.
- `src/data/launches.ts` reads the SpaceX schedule from Launch Library 2 (two small calls, cached for an hour).
- `src/sim/sgp.worker.ts` runs `satellite.js` SGP4 for every object off the main thread. One worker ticks positions and velocities, a second screens close approaches for the selected object (coarse scan, then analytic time of closest approach).
- `src/sim/engine.ts` extrapolates linearly between ticks, so the render loop never calls SGP4.
- `src/scene/*` Earth is a land-mask dot globe with borders and day/night shading. All objects are one `THREE.Points` with focus dimming in the shader. Picking is CPU screen-space with an Earth-occlusion test.
- `src/ui/*` small hand-written components, no framework. Text from data always goes through text nodes.

## Testing

- **Unit (Vitest, 71 tests):** the logic layer in `src/lib` is about 96% covered: ephemeris against known planet positions, purpose inference, country and fleet summaries, URL state, the simulation clock.
- **Browser (Playwright, 6 tests):** load, search, fleet filter and Clear, solar system deep link, time menu, and the phone bottom sheet. They use the Chrome already on your machine (no browser download) and serve data from the bundled snapshot, so run `npm run snapshot` once first, then `npm run test:e2e`. They are not in CI because they need the data snapshot and a GPU-capable browser.
- The 3D scene itself is checked by eye; there are no pixel tests.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on manual dispatch. It needs Pages enabled for the repository. `npm run snapshot` bundles an offline copy of the data; CelesTrak may throttle repeat pulls, so the browser also fetches and caches live data itself. The share image is `public/og.png`, generated from `scripts/og.html`:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --window-size=1200,630 --screenshot=public/og.png file://$PWD/scripts/og.html
```

## Honest limits

- **Subsystem health is modelled, not telemetry.** Nobody publishes it. Values are seeded per NORAD id, nudged by real orbit signals (low perigee, drag, stale element set). The UI says "modelled".
- **Close approaches are a screening estimate.** Public TLEs are km-accurate at best. Real conjunction assessment needs operator ephemerides (Space-Track CDMs, SOCRATES).
- Co-orbiting pairs (relative speed under 0.2 km/s, e.g. ISS modules) are excluded from the screen.
- Operator is derived from CelesTrak group, not authoritative ownership. The selected object's SATCAT record (owner code, launch, status, radar cross-section) is fetched lazily.

## Resources

Data
- CelesTrak GP API and groups: https://celestrak.org/NORAD/elements/ (JSON via `gp.php?GROUP=...&FORMAT=json`, CORS open)
- CelesTrak SATCAT API: https://celestrak.org/satcat/records.php
- CelesTrak SOCRATES (published conjunction reports): https://celestrak.org/SOCRATES/
- CelesTrak GP data docs (data refreshes about every 2 h, repeat pulls inside that window get a 403): https://celestrak.org/NORAD/documentation/gp-data-formats.php
- Space-Track (CDMs, decay, account required): https://www.space-track.org
- UCS Satellite Database (operator, purpose, users, free CSV): https://www.ucsusa.org/resources/satellite-database
- ESA DISCOS (debris, launches, reentries): https://discosweb.esoc.esa.int
- ESA Space Environment Report: https://www.esa.int/Space_Safety/Space_Debris

Libraries
- satellite.js (SGP4, frames, sun position): https://github.com/shashwatak/satellite-js
- three.js: https://threejs.org
- world-atlas + topojson-client + d3-geo (land mask, borders)

Prior art and visual references
- stuffin.space: https://stuffin.space (WebGL, every tracked object)
- KeepTrack (open source, much deeper): https://github.com/thkruz/keeptrack.space
- Starlink map / satellitemap.space
- Cesium + CZML satellite examples: https://cesium.com/learn/ion-sdk/

Ideas not built yet
- Real conjunction feed: SOCRATES scrape via a tiny proxy or a scheduled snapshot
- Pass predictor from the viewer's location (look angles via `ecfToLookAngles`)
- Starlink shell and plane colouring by inclination and RAAN
- Collision-debris time scrubber: replay Fengyun-1C 2007 breakup from epoch
- Reentry watch: perigee under 250 km plus drag trend
- Camera position and time in the share link (selection, fleet, country and solar body are already there)

## Credits and licences

Created by Adarsh Khera. Independent personal project, not affiliated with or endorsed by SpaceX, CelesTrak, NASA or any operator shown.

Open source used: three.js (MIT), satellite.js (MIT), d3-geo, topojson-client and world-atlas (ISC), Natural Earth data (public domain), Vite (MIT), TypeScript (Apache-2.0).
Planet imagery: textures from [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0, derived from NASA data) and NASA/USGS public-domain mosaics of Pluto and the small moons via Wikimedia Commons. Files are in `public/textures/planets`; moons without a public map borrow the Moon's surface, tinted.
Data: CelesTrak by Dr. T.S. Kelso (element data originates from the US Space Force tracking network), Launch Library 2 by The Space Devs.
Inspired by stuffin.space and KeepTrack. Named after the Kessler syndrome, proposed by NASA scientist Donald Kessler.

## Support

If you enjoy it, there is a Buy me a coffee link in the footer. Set your own page in `src/config.ts` (`SUPPORT_URL`).
