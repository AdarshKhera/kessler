import type { Sat } from '../data/types'
import { orbitSummary, type OrbitSummary } from './orbit'

export interface Fact {
  readonly kicker: string
  readonly title: string
  readonly body: string
}

export interface FactContext {
  readonly debrisOperatorIndex?: number
  readonly starlinkOperatorIndex?: number
  readonly countries?: readonly { readonly name: string; readonly count: number }[]
  readonly nextLaunch?: { readonly name: string; readonly netMs: number }
}

const MOON_KM = 384_400
const LIGHT_KM_S = 299_792
const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d })

function untilText(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000))
  if (min < 90) return `${min} minutes`
  const h = Math.round(min / 60)
  return h < 48 ? `${h} hours` : `${Math.round(h / 24)} days`
}

/** Facts computed from the loaded catalogue, so they stay true as the data changes. */
export function computeFacts(sats: readonly Sat[], nowMs: number, ctx: FactContext = {}): Fact[] {
  const facts: Fact[] = []
  if (sats.length === 0) return facts
  const summaries: { sat: Sat; o: OrbitSummary }[] = sats.map((sat) => ({ sat, o: orbitSummary(sat.omm, nowMs) }))

  if (ctx.debrisOperatorIndex !== undefined) {
    const debris = sats.filter((s) => s.operatorIndex === ctx.debrisOperatorIndex).length
    if (debris > 0)
      facts.push({
        kicker: 'Debris',
        title: `${fmt(debris)} fragments from four events`,
        body: `Two collisions and two missile tests broke satellites into ${fmt(debris)} tracked pieces still in this view (${((debris / sats.length) * 100).toFixed(0)}% of everything shown). This is why it's called Kessler.`,
      })
  }

  if (ctx.starlinkOperatorIndex !== undefined) {
    const n = sats.filter((s) => s.operatorIndex === ctx.starlinkOperatorIndex).length
    if (n > 0)
      facts.push({
        kicker: 'Starlink',
        title: `${((n / sats.length) * 100).toFixed(0)}% of what you see is Starlink`,
        body: `${fmt(n)} Starlink satellites orbit at roughly 550 km, the biggest constellation ever flown.`,
      })
  }

  if (ctx.countries && ctx.countries.length >= 2) {
    const [first, ...rest] = ctx.countries
    const india = rest.find((c) => c.name === 'India')
    facts.push({
      kicker: 'Countries',
      title: `${first.name} owns ${((first.count / sats.length) * 100).toFixed(0)}% of everything here`,
      body: `${rest.slice(0, 3).map((c) => `${c.name} ${fmt(c.count)}`).join(', ')}${india && !rest.slice(0, 3).includes(india) ? `, India ${fmt(india.count)}` : ''}. Open the Countries tab to explore any of them.`,
    })
  }

  const iss = summaries.find((s) => s.sat.id === 25544)
  if (iss)
    facts.push({
      kicker: 'ISS',
      title: `${fmt(1440 / iss.o.periodMin, 1)} sunrises every day`,
      body: `The International Space Station circles Earth every ${fmt(iss.o.periodMin, 1)} minutes at about 7.7 km/s. Astronauts on board see a sunrise or a sunset about every 45 minutes.`,
    })

  const geo = summaries.filter((s) => s.o.regime === 'GEO').length
  if (geo > 0)
    facts.push({
      kicker: 'Geostationary',
      title: `${fmt(geo)} satellites that never move`,
      body: `At 35,786 km an orbit takes exactly one day, so each satellite hangs over one spot. A signal there and back takes about ${(((35_786 * 2) / LIGHT_KM_S)).toFixed(2)} seconds, which is the delay on a satellite call.`,
    })

  facts.push({
    kicker: 'GPS',
    title: 'Relativity fixes your phone',
    body: 'GPS satellites at 20,200 km run about 38 microseconds a day fast compared with clocks on the ground. Uncorrected, your position would drift about 11 km every day.',
  })

  const fastest = summaries.reduce((a, b) => (b.o.periodMin < a.o.periodMin ? b : a))
  facts.push({
    kicker: 'Speed',
    title: `${fastest.sat.name} laps Earth in ${fmt(fastest.o.periodMin, 0)} minutes`,
    body: `That is the quickest orbit in this view, skimming ${fmt(fastest.o.perigeeKm)} km up at around 7.8 km/s, fast enough to cross the Atlantic in about 12 minutes.`,
  })

  const farthest = summaries.reduce((a, b) => (b.o.apogeeKm > a.o.apogeeKm ? b : a))
  facts.push({
    kicker: 'Reach',
    title: `${farthest.sat.name} goes ${((farthest.o.apogeeKm / MOON_KM) * 100).toFixed(0)}% of the way to the Moon`,
    body: `Its orbit stretches out to ${fmt(farthest.o.apogeeKm)} km, the highest in this view.`,
  })

  const newest = Math.min(...summaries.map((s) => s.o.epochAgeHours))
  facts.push({
    kicker: 'Freshness',
    title: `Newest measurement is ${newest < 1 ? 'under an hour' : `${fmt(newest, 0)} hours`} old`,
    body: 'Radar and optical sensors re-measure each object every few days. The orbit is then predicted forward with SGP4, right in your browser.',
  })

  if (ctx.nextLaunch)
    facts.push({
      kicker: 'Next launch',
      title: `SpaceX flies in ${untilText(ctx.nextLaunch.netMs - nowMs)}`,
      body: `${ctx.nextLaunch.name}. Launch times come from Launch Library 2 and can slip.`,
    })

  return facts
}
