import * as THREE from 'three'
import { gstime, jday, sunPos } from 'satellite.js'
import './style.css'
import { backoffUntil, loadCatalog, type Catalog } from './data/load'
import { loadLaunches, type LaunchInfo } from './data/launches'
import { GROUPS, OPERATORS } from './data/registry'
import { createSolarMode } from './solarmode'
import { SUPPORT_URL } from './config'
import { LOADING_QUOTES } from './data/quotes'
import { loadOwners } from './data/owners'
import { fetchSatcat } from './data/satcat'
import { EARTH_RADIUS, EARTH_RADIUS_KM, eciToScene } from './lib/frames'
import { countryOf, countrySummary, listCountries, type CountryRow } from './lib/countries'
import { computeFacts } from './lib/facts'
import { fleetSummary } from './lib/fleet'
import { nearestTo } from './lib/neighbors'
import { orbitSummary } from './lib/orbit'
import { describePurpose } from './lib/purpose'
import { parseHash, toHash } from './lib/urlstate'
import { Engine } from './sim/engine'
import { FocusVisuals } from './scene/focus'
import { createGlobe } from './scene/globe'
import { createShells } from './scene/shells'
import { createStage } from './scene/stage'
import { createStars } from './scene/stars'
import { NO_FOCUS, Swarm } from './scene/swarm'
import { Card } from './ui/card'
import { Chrome } from './ui/chrome'
import { FocusBar } from './ui/focusbar'
import { glyph } from './ui/glyphs'
import { Dock, readLayers } from './ui/dock'
import { fmt, h } from './ui/dom'
import { Guide, type SourceStatus } from './ui/guide'
import { ModeSwitch } from './ui/modes'
import { Welcome, hasWelcomed } from './ui/welcome'
import { Search } from './ui/search'
import { SatTag } from './ui/tag'
import { toast } from './ui/toast'
import { initialState, type UiState } from './ui/state'
import { Tour, hasToured, type TourStep } from './ui/tour'

const MU = 398600.4418
const TRACK_REFRESH_MS = 15 * 60_000
const CONJ_WINDOW_MS = 3 * 3_600_000
const $ = (id: string) => document.getElementById(id)!

function bootScreen(): ((text: string, pct: number) => void) & { stop: () => void } {
  const root = $('boot')
  const line = h('div', { class: 'bootline' })
  const fill = h('i')
  const quote = h('p', { class: 'bootquote' })
  const order = [...LOADING_QUOTES].sort(() => Math.random() - 0.5)
  let n = 0
  const show = () => {
    quote.classList.remove('in')
    window.setTimeout(() => {
      quote.textContent = order[n++ % order.length]
      quote.classList.add('in')
    }, 350)
  }
  quote.textContent = order[n++]
  requestAnimationFrame(() => quote.classList.add('in'))
  const timer = window.setInterval(show, 5200)
  root.replaceChildren(
    h('div', { class: 'bootcard' },
      h('div', { class: 'bootmark' }, 'Kessler'),
      quote,
      h('div', { class: 'bootbar' }, fill),
      line,
      h('div', { class: 'bootby' }, 'by Adarsh Khera')),
  )
  const update = (text: string, pct: number) => {
    line.textContent = text
    fill.style.width = `${pct}%`
  }
  return Object.assign(update, { stop: () => window.clearInterval(timer) })
}

const groupName = (id: string) => GROUPS.find((g) => g.id === id)?.name ?? id
const BASE_TITLE = 'Kessler | Live satellites'

const ageText = (hours: number): string => (hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min` : hours < 48 ? `${Math.round(hours)} h` : `${Math.round(hours / 24)} d`)

/** Hours since the newest element set in the catalogue was measured. */
function newestAgeHours(sats: readonly { omm: { EPOCH: string } }[], nowMs: number): number {
  let newest = 0
  for (const s of sats) {
    const t = Date.parse(s.omm.EPOCH.endsWith('Z') ? s.omm.EPOCH : `${s.omm.EPOCH}Z`)
    if (t > newest) newest = t
  }
  return newest === 0 ? Infinity : (nowMs - newest) / 3_600_000
}

function statusOf(catalog: Catalog, ageHours: number): { label: string; tone: 'ok' | 'warn' } {
  const missing = catalog.failedGroups.length
  const fresh = Number.isFinite(ageHours) ? `orbits ${ageText(ageHours)} old` : 'orbit age unknown'
  return { label: missing ? `${fresh} · ${missing} fleet${missing > 1 ? 's' : ''} missing` : fresh, tone: missing || ageHours > 36 ? 'warn' : 'ok' }
}

function sourcesOf(catalog: Catalog, launches: LaunchInfo | null, newestHours: number, ownersMatched: number): SourceStatus[] {
  const c = catalog.sources
  const dominant = c.live >= c.cache && c.live >= c.snapshot ? 'live' : c.cache >= c.snapshot ? 'cache' : 'snapshot'
  const throttled = catalog.failedGroups.length ? ` ${catalog.failedGroups.map(groupName).join(', ')} unavailable right now (throttled by the source).` : ''
  return [
    {
      name: 'CelesTrak orbital elements',
      what: 'Where every dot is. Public tracking data from the US space surveillance network, grouped by fleet and refreshed about every 2 hours.',
      state: dominant,
      detail: `${c.live} groups live · ${c.cache} cached · ${c.snapshot} snapshot. Newest measurement ${newestHours < 1 ? 'under an hour' : `${fmt(newestHours)} h`} old.${throttled}`,
      href: 'https://celestrak.org/NORAD/elements/',
    },
    {
      name: 'CelesTrak SATCAT',
      what: 'Owner, launch date, status and radar size. Fetched for one object when you click it.',
      state: 'live',
      detail: 'On demand, one small request per satellite.',
      href: 'https://celestrak.org/satcat/',
    },
    {
      name: 'Country and owner table',
      what: 'Which country or operator owns each satellite, taken from the CelesTrak satellite catalogue and bundled with the site.',
      state: ownersMatched > 0 ? 'snapshot' : 'offline',
      detail: ownersMatched > 0 ? `${fmt(ownersMatched)} of the loaded objects matched. New launches may show as unknown until it is rebuilt.` : 'Not loaded, so the Countries view is unavailable.',
      href: 'https://celestrak.org/satcat/',
    },
    {
      name: 'Launch Library 2',
      what: 'SpaceX launch schedule and this year’s launch count, from The Space Devs community database.',
      state: launches ? (launches.source === 'live' ? 'live' : launches.source === 'cache' ? 'cache' : 'offline') : 'offline',
      detail: launches?.source === 'offline' ? 'Unreachable right now.' : 'Cached for an hour to respect the free tier.',
      href: 'https://thespacedevs.com/llapi',
    },
    {
      name: 'SGP4 orbit model',
      what: 'Turns element sets into positions. Runs in your browser through satellite.js, not streamed from a server.',
      state: 'local',
      detail: 'Positions refresh about twice a second and are smoothed in between.',
      href: 'https://github.com/shashwatak/satellite-js',
    },
    {
      name: 'Health bars',
      what: 'Illustrative only. Nobody publishes real subsystem telemetry, so these are modelled from orbit height, drag and element age.',
      state: 'local',
      detail: 'Do not treat as real status.',
    },
  ]
}

async function main(): Promise<void> {
  const boot = bootScreen()
  if (!document.createElement('canvas').getContext('webgl2')) {
    boot('Kessler needs WebGL 2. Try a recent Chrome, Safari, Edge or Firefox.', 0)
    return
  }
  // First paint: the globe renders immediately while orbit data streams in behind a see-through loader.
  const stage = createStage($('gl') as HTMLCanvasElement)
  const globe = createGlobe()
  const shells = createShells()
  stage.scene.add(createStars(), globe.root, shells)
  const previewSun = new THREE.Vector3()
  const previewScene = new Float32Array(3)
  let previewing = true
  const preview = () => {
    if (!previewing) return
    const now = new Date()
    globe.earth.rotation.y = gstime(now)
    const sun = sunPos(jday(now)).rsun
    eciToScene(sun.x, sun.y, sun.z, previewScene, 0)
    globe.setSun(previewSun.set(previewScene[0], previewScene[1], previewScene[2]))
    stage.render()
    requestAnimationFrame(preview)
  }
  requestAnimationFrame(preview)

  boot('Fetching orbits', 2)
  const launchesPromise = loadLaunches()
  const ownerTable = await loadOwners()
  const catalog = await loadCatalog((done, total, name) => boot(`Fetching orbits · ${name}`, (done / total) * 100), ownerTable)
  if (catalog.sats.length === 0) {
    previewing = false
    boot('No orbit data available. Run npm run snapshot for an offline copy.', 0)
    return
  }
  const sats = catalog.sats
  boot(`Calculating ${fmt(sats.length)} orbits`, 100)
  const engine = new Engine(sats)
  try {
    await engine.start()
  } finally {
    previewing = false
  }

  const swarm = new Swarm(sats, engine.positions)
  const focus = new FocusVisuals(globe.earth)
  stage.scene.add(swarm.points, focus.root)

  let state: UiState = initialState
  let launchInfo: LaunchInfo | null = null
  let neighborIdx: number[] = []
  let trackAt = 0
  let conjAt = 0
  let pointer = { x: 0, y: 0, dirty: false, inside: false }
  let ownerCodes: (string | undefined)[] = []
  let countryRows: CountryRow[] = []
  let countryIdx = new Map<string, number>()
  let pendingCountry = ''

  const opIndex = (id: string) => OPERATORS.findIndex((o) => o.id === id)
  const fleetCount = (op: number) => sats.reduce((n, s) => n + (s.operatorIndex === op ? 1 : 0), 0)
  const newestHours = () => Math.min(...sats.slice(0, 2000).map((s) => orbitSummary(s.omm, engine.clock.now()).epochAgeHours))
  const summaryOf = (i: number) => orbitSummary(sats[i].omm, engine.clock.now())
  const purposeOf = (i: number) => describePurpose({ name: sats[i].name, operatorId: OPERATORS[sats[i].operatorIndex].id, orbit: summaryOf(i) })

  /** Something is selected or filtered: hover must stay inside it instead of lighting up other fleets. */
  const isFiltered = () => state.selected >= 0 || state.fleet >= 0 || state.country !== ''
  let countryIds = new Float32Array(0)
  const pickAllow = (i: number): boolean => {
    if (state.selected >= 0) return sats[i].operatorIndex === sats[state.selected].operatorIndex
    if (state.fleet >= 0) return sats[i].operatorIndex === state.fleet
    if (state.country) return countryIds[i] === (countryIdx.get(state.country) ?? -2)
    return true
  }

  const applyFocus = () => {
    const filtered = isFiltered()
    const sat = state.selected >= 0 ? sats[state.selected] : !filtered && state.hover >= 0 ? sats[state.hover] : null
    const fleetOp = state.fleet >= 0 ? state.fleet : filtered ? -1 : state.fleetHover
    const dimmable = fleetOp >= 0 && fleetCount(fleetOp) > 0
    const countryCode = state.country || (filtered ? '' : state.countryHover)
    const countryFocus = !sat && countryCode ? (countryIdx.get(countryCode) ?? -1) : -1
    swarm.setFocus({
      ...NO_FOCUS,
      country: countryFocus,
      operator: sat ? sat.operatorIndex : countryFocus < 0 && dimmable ? fleetOp : -1,
      group: sat ? sat.groupIndex : -1,
      hover: state.hover,
      selected: state.selected,
    })
  }

  const set = (patch: Partial<UiState>) => {
    state = { ...state, ...patch }
    applyFocus()
    chrome.setFleet(state.fleet)
    chrome.setCountry(state.country)
  }

  const announce = (text: string) => {
    $('live').textContent = text
  }

  /** Keep the URL, tab title and screen-reader status in step with what is shown. */
  const syncView = () => {
    const sat = state.selected >= 0 ? sats[state.selected] : null
    const fleet = state.fleet >= 0 ? OPERATORS[state.fleet] : null
    const country = state.country ? countryOf(countryRows.find((c) => c.code.toLowerCase() === state.country)?.code) : null
    const hash = sat ? toHash({ sat: sat.id }) : fleet ? toHash({ fleet: fleet.id }) : state.country ? toHash({ country: state.country }) : ''
    if (location.hash !== hash) history.replaceState(null, '', `${location.pathname}${location.search}${hash}`)
    document.title = sat ? `${sat.name} | Kessler` : fleet ? `${fleet.name} | Kessler` : country ? `${country.name} | Kessler` : BASE_TITLE
    if (sat) focusBar.set({ kind: 'sat', label: `Inspecting ${sat.name}`, detail: purposeOf(state.selected).category, icon: glyph(sat.operatorIndex) })
    else if (fleet) focusBar.set({ kind: 'fleet', label: `Showing ${fleet.name}`, detail: `${fmt(fleetCount(state.fleet))} objects`, icon: glyph(state.fleet) })
    else if (country) focusBar.set({ kind: 'country', label: `Showing ${country.name}`, detail: `${fmt(countryRows.find((c) => c.code.toLowerCase() === state.country)?.count ?? 0)} objects`, icon: h('span', { class: 'flag' }, country.flag) })
    else focusBar.set({ kind: 'idle', label: '' })
    announce(sat ? `Selected ${sat.name}, ${OPERATORS[sat.operatorIndex].name}` : fleet ? `${fleet.name} fleet, ${fleetCount(state.fleet)} objects` : country ? `${country.name}, satellites by country` : '')
  }

  const focusBar = new FocusBar($('focusbar'), () => (solarMode.active ? solarMode.overview() : clearSelection()))

  const clearSelection = () => {
    tag.hide()
    focus.clear()
    engine.cancelConjunctions()
    neighborIdx = []
    card.hide()
    set({ selected: -1, fleet: -1, country: '', partner: -1, hover: -1 })
    syncView()
  }

  const selectSat = (index: number) => {
    if (index < 0) return clearSelection()
    if (index === state.selected) return
    set({ selected: index, fleet: -1, country: '', partner: -1 })
    neighborIdx = []
    trackAt = 0
    conjAt = engine.clock.now()
    focus.clear()
    focus.setColor(OPERATORS[sats[index].operatorIndex].color)
    tag.show(sats[index].name, sats[index].operatorIndex)
    card.showSat(sats[index], summaryOf(index), ownerCodes[index] ? countryOf(ownerCodes[index]) : null, purposeOf(index))
    syncView()
    engine.requestTrack(index)
    engine.requestConjunctions(index, 3)
    void fetchSatcat(sats[index].id).then((rec) => {
      if (state.selected === index) card.setSatcat(rec)
    })
    const p = engine.positions
    const x = p[index * 3]
    if (x === x) stage.flyTo(new THREE.Vector3(x, p[index * 3 + 1], p[index * 3 + 2]))
  }

  const openFleet = (op: number) => {
    if (op === state.fleet) return
    focus.clear()
    engine.cancelConjunctions()
    tag.hide()
    set({ selected: -1, fleet: op, country: '', partner: -1 })
    syncView()
    card.showFleet(op, fleetSummary(sats, op, engine.clock.now()), launchInfo, backoffUntil('starlink'))
  }

  const openCountry = (code: string) => {
    if (code === state.country) return
    const row = countryRows.find((c) => c.code.toLowerCase() === code)
    if (!row) return
    tag.hide()
    focus.clear()
    engine.cancelConjunctions()
    set({ selected: -1, fleet: -1, country: code, partner: -1 })
    syncView()
    card.showCountry(row, countrySummary(sats, ownerCodes, row.code, engine.clock.now()))
  }

  const toggleCountry = (code: string) => (code === state.country ? clearSelection() : openCountry(code))
  let sheetOpen = false
  const phone = matchMedia('(max-width: 980px)')
  const applyShift = () => stage.setShift(sheetOpen && phone.matches ? ($('card').classList.contains('expanded') ? 0.22 : 0.1) : 0)
  phone.addEventListener('change', applyShift)

  const toggleFleet = (op: number) => (op === state.fleet ? clearSelection() : openFleet(op))

  const card = new Card($('card'), sats, {
    close: () => (solarMode.active ? solarMode.overview() : clearSelection()),
    enterEarth: () => void solarMode.leave(),
    visibility: (open) => {
      sheetOpen = open
      applyShift()
    },
    selectSat,
    partner: (i) => set({ partner: i }),
    openFleet,
    share: async () => {
      try {
        await navigator.clipboard.writeText(location.href)
        toast('Link copied')
      } catch {
        toast('Copy the link from the address bar')
      }
    },
  })

  const tag = new SatTag($('app'))
  const chrome = new Chrome({ brand: $('brand'), top: $('top'), fleets: $('fleets'), time: $('time') }, sats, {
    openSearch: () => search.open(),
    openGuide: () => guide.open(),
    openData: () => guide.open('data'),
    toggleMode: () => void (solarMode.active ? solarMode.leave() : solarMode.enter()),
    fleet: toggleFleet,
    fleetHover: (op) => set({ fleetHover: op }),
    country: toggleCountry,
    countryHover: (code) => set({ countryHover: code }),
    clearFocus: clearSelection,
    setWarp: (w) => {
      engine.setPaused(false)
      engine.setWarp(w)
    },
    togglePause: () => engine.setPaused(!engine.clock.paused),
    live: () => engine.jumpToLive(),
    jumpTo: (ms) => engine.jumpTo(ms),
  }, sats.length, statusOf(catalog, newestAgeHours(sats, Date.now())))

  new Dock($('dock'), {
    zoom: stage.zoomBy,
    reset: () => (solarMode.active ? solarMode.overview() : stage.resetView()),
    layer: (key, on) => {
      if (key === 'rings') shells.visible = on
      else if (key === 'borders') globe.setBordersVisible(on)
      else stage.controls.autoRotate = on && !matchMedia('(prefers-reduced-motion: reduce)').matches
    },
  }, readLayers())

  const modeSwitch = new ModeSwitch($('modes'), (m) => void (m === 'solar' ? solarMode.enter() : solarMode.leave()))
  const solarMode = createSolarMode({ stage, swarm, engine, card, chrome, focusBar, modeSwitch, clearEarthView: clearSelection, restoreEarthView: () => syncView() })

  $('foot').addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-open]')
    if (target) guide.open(target.dataset.open as 'data' | 'credits')
  })

  const overlays = $('overlays')
  /** Satellite, fleet and country views live in the Earth scene: leave the solar system first. */
  const inEarth = (fn: () => void) => {
    if (solarMode.active) void solarMode.leave().then(fn)
    else fn()
  }
  const search = new Search(overlays, sats, {
    pickSat: (i) => inEarth(() => selectSat(i)),
    pickFleet: (op) => inEarth(() => openFleet(op)),
    pickCountry: (c) => inEarth(() => openCountry(c)),
    countries: () => countryRows,
  })
  const guide = new Guide(overlays, {
    facts: () => {
      const next = launchInfo?.upcoming.find((l) => l.netMs > Date.now())
      return computeFacts(sats, Date.now(), {
        debrisOperatorIndex: opIndex('debris'),
        starlinkOperatorIndex: opIndex('spacex'),
        countries: countryRows,
        nextLaunch: next ? { name: next.name.replace('Falcon 9 Block 5 | ', ''), netMs: next.netMs } : undefined,
      })
    },
    sources: () => sourcesOf(catalog, launchInfo, newestHours(), ownerCodes.filter(Boolean).length),
    replayTour: () => tour.start(),
  })

  const welcome = new Welcome(overlays, () => tour.start())
  const coffee = document.getElementById('coffee') as HTMLAnchorElement | null
  if (coffee) coffee.href = SUPPORT_URL

  const issIndex = sats.findIndex((s) => s.id === 25544)
  let tourPrev = { selected: -1, fleet: -1 }
  const steps: TourStep[] = [
    { title: 'Everything above you, live', body: `Each dot is a real satellite or piece of debris. ${fmt(sats.length)} of them, positioned from public tracking data.` },
    { title: 'Turn the Earth', body: 'Drag to rotate, scroll or pinch to zoom. The faint rings mark low, medium and geostationary orbit.' },
    { title: 'Fleets', body: 'Each colour is an operator. Hover to light it up on the globe, click for stats. Switch to Countries to see satellites by owner, India included.', target: '#fleets', enter: () => chrome.setCollapsed(false) },
    ...(issIndex >= 0
      ? [
          {
            title: 'Click any dot',
            body: 'This is the International Space Station, about 420 km up and moving at 7.7 km/s. Its path, neighbours and close passes are in the card.',
            target: '#card',
            enter: () => {
              tourPrev = { selected: state.selected, fleet: state.fleet }
              selectSat(issIndex)
            },
            leave: () => {
              if (state.selected !== issIndex) return // the user picked something else: leave it alone
              clearSelection()
              if (tourPrev.selected >= 0) selectSat(tourPrev.selected)
              else if (tourPrev.fleet >= 0) openFleet(tourPrev.fleet)
            },
          },
        ]
      : []),
    { title: 'Time is adjustable', body: 'Speed it up to watch orbits unfold, or pause. Live brings you back to now.', target: '#time' },
    { title: 'Find anything', body: 'Search by name or NORAD number. Press / from anywhere.', target: '#btn-search' },
    { title: 'Beyond Earth', body: 'Switch to Solar System to see every planet where it really is today, with Saturn’s rings and the big moons. Zooming all the way out of Earth does the same.', target: '#modes' },
    { title: 'Facts and sources', body: 'Fascinating numbers, a how-to, and exactly where the data comes from live behind this button.', target: '#btn-guide' },
  ]
  const tour = new Tour(overlays, steps, () => {
    chrome.guideBtn.classList.add('pulse')
    stage.controls.autoRotate = readLayers().rotate && !matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  engine.onTrack((r) => {
    if (r.index !== state.selected) return
    focus.setTrack(r.orbit, r.ground)
    trackAt = r.t
  })
  engine.onConjunctions((index, hits, scanned) => {
    if (index === state.selected) card.setConjunctions(hits, scanned, engine.clock.now())
  })
  void launchesPromise.then((info) => {
    launchInfo = info
    card.setLaunches(info)
    guide.refresh()
  })

  // pointer
  const canvas = stage.canvas
  let down = { x: 0, y: 0 }
  canvas.addEventListener('wheel', (e) => solarMode.wheelOutOfEarth(e), { passive: true })
  canvas.addEventListener('pointermove', (e) => {
    if (stage.mode !== 'earth') return
    pointer = { x: e.offsetX, y: e.offsetY, dirty: true, inside: true }
  })
  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false
    if (state.hover >= 0) set({ hover: -1 })
  })
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY }
  })
  canvas.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return
    if (stage.mode === 'solar') {
      solarMode.pickAt(e.offsetX, e.offsetY)
      return
    }
    const { width, height } = stage.size()
    const hit = swarm.pick(e.offsetX, e.offsetY, width, height, stage.camera, e.pointerType === 'touch' ? 22 : 12, pickAllow)
    if (hit >= 0) selectSat(hit)
    else if (state.selected >= 0 || state.fleet >= 0 || state.country !== '') clearSelection()
  })

  window.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey
    if (e.key === 'Escape') {
      if (welcome.isOpen) welcome.finish(false)
      else if (chrome.closeTimeMenu()) return
      else if (search.isOpen) search.close()
      else if (guide.isOpen) guide.close()
      else if (tour.isRunning) tour.finish()
      else if (solarMode.active) solarMode.overview()
      else clearSelection()
      return
    }
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      if (!guide.isOpen && !welcome.isOpen && !tour.isRunning) search.open()
      return
    }
    if (mod || e.altKey || search.isOpen || guide.isOpen || welcome.isOpen) return
    const t = e.target as HTMLElement
    if (t instanceof HTMLInputElement) return
    if (e.key === '/') {
      e.preventDefault()
      search.open()
    } else if (e.key === '?') guide.open()
    else if (e.key === 'r' || e.key === 'R') {
      if (solarMode.active) solarMode.overview()
      else stage.resetView()
    }
    else if (solarMode.active && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault()
      solarMode.step(e.key === 'ArrowRight' ? 1 : -1)
    } else if (e.key === '+' || e.key === '=') stage.zoomBy(0.8)
    else if (e.key === '-' || e.key === '_') stage.zoomBy(1.25)
    else if (e.key === ' ' && !t.closest('button, a, summary, [role="switch"]')) {
      e.preventDefault()
      engine.setPaused(!engine.clock.paused)
    }
  })

  // tooltip: two nodes created once, text rewritten only when needed
  const tip = $('tip')
  const tipName = tip.querySelector('b')!
  const tipMeta = tip.querySelector('span')!
  let tipFor = -1
  let tipAt = 0
  const showTip = () => {
    if (state.hover < 0 || !pointer.inside) {
      tip.hidden = true
      tipFor = -1
      return
    }
    const t = performance.now()
    if (state.hover !== tipFor || t - tipAt > 250) {
      const s = sats[state.hover]
      const p = engine.positions
      const alt = Math.hypot(p[state.hover * 3], p[state.hover * 3 + 1], p[state.hover * 3 + 2]) * 1000 - EARTH_RADIUS_KM
      tipName.textContent = s.name
      tipMeta.textContent = `${purposeOf(state.hover).category} · ${OPERATORS[s.operatorIndex].name} · ${Number.isFinite(alt) ? `${fmt(alt)} km` : 'no current position'}`
      tipFor = state.hover
      tipAt = t
    }
    tip.style.transform = `translate(${pointer.x + 16}px, ${pointer.y + 16}px)`
    tip.hidden = false
  }

  const sunVec = new THREE.Vector3()
  const tagVec = new THREE.Vector3()
  const sunScene = new Float32Array(3)
  let lastSlow = 0
  let lastSun = 0
  let hudAt = 0

  const frame = () => {
    const now = engine.step()
    swarm.touchPositions()
    globe.earth.rotation.y = gstime(new Date(now))
    if (performance.now() - lastSun > 1000) {
      lastSun = performance.now()
      const sun = sunPos(jday(new Date(now))).rsun
      eciToScene(sun.x, sun.y, sun.z, sunScene, 0)
      globe.setSun(sunVec.set(sunScene[0], sunScene[1], sunScene[2]))
    }

    const earthView = stage.mode === 'earth'
    if (earthView && pointer.dirty && pointer.inside) {
      pointer.dirty = false
      const { width, height } = stage.size()
      const hit = swarm.pick(pointer.x, pointer.y, width, height, stage.camera, 12, pickAllow)
      if (hit !== state.hover) set({ hover: hit })
      canvas.style.cursor = hit >= 0 ? 'pointer' : ''
    }
    if (earthView) showTip()
    else tip.hidden = true

    if (earthView && state.selected >= 0) {
      const i = state.selected
      if (performance.now() - lastSlow > 400) {
        lastSlow = performance.now()
        const p = engine.positions
        // objects within 1 km share an element set (e.g. ISS modules), not separate neighbours
        const near = nearestTo(p, i, 12).filter((n) => n.distance > 0.001).slice(0, 5)
        neighborIdx = near.map((n) => n.index)
        const r = Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]) * 1000
        if (!Number.isFinite(r)) card.noFix()
        else {
          const a = (MU * ((summaryOf(i).periodMin * 60) ** 2) / (4 * Math.PI ** 2)) ** (1 / 3)
          card.updateLive({ altitudeKm: r - EARTH_RADIUS_KM, speedKmS: Math.sqrt(Math.max(0, MU * (2 / r - 1 / a))), neighbors: near.map((n) => ({ index: n.index, distance: n.distance * 1000 })) })
        }
      }
      focus.update(engine.positions, i, neighborIdx, state.partner)
      const pp = engine.positions
      tagVec.set(pp[i * 3], pp[i * 3 + 1], pp[i * 3 + 2])
      const facing = tagVec.dot(stage.camera.position) > EARTH_RADIUS * EARTH_RADIUS
      tagVec.project(stage.camera)
      const size = stage.size()
      tag.place((tagVec.x * 0.5 + 0.5) * size.width, (1 - (tagVec.y * 0.5 + 0.5)) * size.height, facing && tagVec.z < 1)
      if (trackAt !== 0 && Math.abs(now - trackAt) > TRACK_REFRESH_MS) {
        trackAt = 0
        engine.requestTrack(i)
      }
      if (now < conjAt || now > conjAt + CONJ_WINDOW_MS - 20 * 60_000) {
        conjAt = now
        engine.requestConjunctions(i, 3)
      }
    }

    if (performance.now() - hudAt > 250) {
      hudAt = performance.now()
      chrome.update(now, engine.clock.warp, engine.clock.paused)
    }
    stage.render()
    requestAnimationFrame(frame)
  }

  const applyHash = (): boolean => {
    const view = parseHash(location.hash)
    if (view.sat !== undefined) {
      const idx = sats.findIndex((s) => s.id === view.sat)
      if (idx >= 0) return inEarth(() => selectSat(idx)), true
    } else if (view.body || view.solar) {
      if (solarMode.active) {
        if (view.body) solarMode.focusBody(view.body)
        else solarMode.overview()
        return true
      }
      void solarMode.enter(view.body).then(() => view.solar && solarMode.overview())
      return true
    } else if (view.fleet) {
      const op = opIndex(view.fleet)
      if (op >= 0) return inEarth(() => openFleet(op)), true
    } else if (view.country) {
      if (countryRows.length === 0) return (pendingCountry = view.country), true // owner table still loading
      if (countryRows.some((c) => c.code.toLowerCase() === view.country)) return inEarth(() => openCountry(view.country!)), true
    }
    return false
  }
  window.addEventListener('hashchange', () => {
    if (applyHash()) return
    if (location.hash === '') {
      if (solarMode.active) void solarMode.leave()
      else clearSelection()
    } else if (!solarMode.active) {
      syncView()
      toast('That view is not in the loaded data')
    }
  })

  void Promise.resolve(ownerTable).then((owners) => {
    ownerCodes = sats.map((s) => owners.get(s.id))
    countryRows = listCountries(ownerCodes, 8)
    countryIdx = new Map(countryRows.map((c, i) => [c.code.toLowerCase(), i]))
    const ids = new Float32Array(sats.length).fill(-1)
    countryIds = ids
    ownerCodes.forEach((o, i) => {
      const k = o ? countryIdx.get(o.toLowerCase()) : undefined
      if (k !== undefined) ids[i] = k
    })
    swarm.setCountries(ids)
    chrome.setCountries(countryRows)
    if (pendingCountry) {
      openCountry(pendingCountry)
      pendingCountry = ''
    }
    guide.refresh()
  })

  focusBar.set({ kind: 'idle', label: '' })
  window.setInterval(() => chrome.setStatus(statusOf(catalog, newestAgeHours(sats, Date.now()))), 60_000)
  applyFocus()
  boot.stop()
  document.body.classList.remove('loading')
  $('boot').classList.add('done')
  requestAnimationFrame(frame)
  engine.step() // fill positions so a deep link can aim the camera before the first frame
  const deepLinked = applyHash()
  if (!deepLinked && location.hash !== '') {
    syncView()
    toast('That view is not in the loaded data')
  }
  if (catalog.failedGroups.length)
    toast(`${catalog.failedGroups.map(groupName).join(', ')} orbit data is rate limited by CelesTrak right now. Everything else is live.`, 7000)
  if (!hasWelcomed() && !hasToured() && !deepLinked)
    window.setTimeout(() => {
      if (!search.isOpen && !guide.isOpen && state.selected < 0 && state.fleet < 0) welcome.open()
    }, 700)
  ;(window as unknown as { __kessler: unknown }).__kessler = { solarMode, sats, engine, selectSat, openFleet, stage, tour, guide, state: () => state }
}

main().catch((err) => {
  const root = document.getElementById('boot')
  if (root) root.replaceChildren(h('div', { class: 'bootline' }, `Startup failed: ${(err as Error).message}`))
})
