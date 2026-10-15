export type Agency = 'NASA' | 'ESA' | 'JAXA'

export interface Probe {
  readonly id: string
  readonly name: string
  readonly agency: Agency
  readonly launched: string
  readonly status: string
  readonly blurb: string
  readonly facts: readonly string[]
}

/** Words for each spacecraft. The paths themselves come from JPL Horizons (public/space/probes.json). */
export const PROBES: readonly Probe[] = [
  { id: 'voyager-1', name: 'Voyager 1', agency: 'NASA', launched: '1977', status: 'Active, in interstellar space',
    blurb: 'The most distant human-made object. It left the Sun’s bubble in 2012 and is still sending data.',
    facts: ['It carries a golden record of sounds and pictures from Earth.', 'Its radio signal takes about a day to reach us.'] },
  { id: 'voyager-2', name: 'Voyager 2', agency: 'NASA', launched: '1977', status: 'Active, in interstellar space',
    blurb: 'The only spacecraft to have visited Uranus and Neptune, and the second to leave the Sun’s bubble, in 2018.',
    facts: ['It flew past Jupiter, Saturn, Uranus and Neptune in 12 years.', 'Both Voyagers run on heat from decaying plutonium, which is slowly fading.'] },
  { id: 'pioneer-10', name: 'Pioneer 10', agency: 'NASA', launched: '1972', status: 'Silent since 2003',
    blurb: 'The first craft to cross the asteroid belt and to fly past Jupiter. Its last faint signal came in 2003.',
    facts: ['It carries a plaque showing where it came from.', 'It is coasting toward the star Aldebaran, which it will reach in about two million years.'] },
  { id: 'pioneer-11', name: 'Pioneer 11', agency: 'NASA', launched: '1973', status: 'Silent since 1995',
    blurb: 'The first spacecraft to fly past Saturn, in 1979. Contact was lost in 1995.',
    facts: ['It was the second craft to visit Jupiter.', 'Its position here is calculated from its last tracked path.'] },
  { id: 'new-horizons', name: 'New Horizons', agency: 'NASA', launched: '2006', status: 'Active, in the Kuiper Belt',
    blurb: 'Flew past Pluto in 2015 and the icy body Arrokoth in 2019. It is now exploring the outer solar system.',
    facts: ['It was the fastest craft ever launched when it left Earth.', 'It showed Pluto has mountains of water ice and a heart-shaped plain.'] },
  { id: 'parker', name: 'Parker Solar Probe', agency: 'NASA', launched: '2018', status: 'Active, circling the Sun',
    blurb: 'Dives through the Sun’s outer atmosphere, closer than any craft before, and is the fastest human-made object.',
    facts: ['At its closest it is about 6 million km from the Sun’s surface, moving near 190 km/s.', 'One orbit takes 88 days, the same as Mercury’s year.'] },
  { id: 'lucy', name: 'Lucy', agency: 'NASA', launched: '2021', status: 'Active, heading for the Trojan asteroids',
    blurb: 'The first mission to visit the Trojans, asteroids that share Jupiter’s orbit, thought to be leftovers from the birth of the planets.',
    facts: ['It has already flown past two main-belt asteroids, Dinkinesh and Donaldjohanson.', 'It will visit seven Trojans in all.'] },
  { id: 'psyche', name: 'Psyche', agency: 'NASA', launched: '2023', status: 'Active, cruising to its asteroid',
    blurb: 'Heading for 16 Psyche, a large asteroid that may be the exposed metal core of an early planet.',
    facts: ['It steers with solar-electric thrusters that push out glowing xenon gas.', 'It is due to arrive in 2029.'] },
  { id: 'osiris-apex', name: 'OSIRIS-APEX', agency: 'NASA', launched: '2016', status: 'Active, heading for Apophis',
    blurb: 'Formerly OSIRIS-REx, which brought home a sample of asteroid Bennu in 2023. Now on its way to study Apophis.',
    facts: ['It dropped the Bennu sample capsule over Utah in September 2023.', 'It will be at Apophis when that asteroid passes close to Earth in 2029.'] },
  { id: 'europa-clipper', name: 'Europa Clipper', agency: 'NASA', launched: '2024', status: 'Active, cruising to Jupiter',
    blurb: 'Going to Jupiter’s moon Europa to find out whether the ocean under its ice could support life.',
    facts: ['It is the largest spacecraft NASA has built for a planetary mission.', 'It swings past Earth in late 2026 for a speed boost, and reaches Jupiter in 2030.'] },
  { id: 'jwst', name: 'James Webb Space Telescope', agency: 'NASA', launched: '2021', status: 'Active, at the L2 point',
    blurb: 'The largest space telescope ever launched, seeing the infrared universe from a point 1.5 million km beyond Earth.',
    facts: ['Its sunshield is the size of a tennis court and keeps the mirrors near −230 °C.', 'It does not orbit Earth: it circles a point that moves with us around the Sun.'] },
  { id: 'stereo-a', name: 'STEREO-A', agency: 'NASA', launched: '2006', status: 'Active, circling the Sun',
    blurb: 'One of a pair launched to watch the Sun from two sides. It drifts around the Sun a little faster than Earth.',
    facts: ['Its twin, STEREO-B, went silent in 2014.', 'It can see the far side of the Sun, which Earth never faces.'] },
  { id: 'solar-orbiter', name: 'Solar Orbiter', agency: 'ESA', launched: '2020', status: 'Active, circling the Sun',
    blurb: 'A European mission, with NASA, that swings close to the Sun and is tilting its orbit to look at the poles.',
    facts: ['It uses Venus flybys to climb out of the plane the planets orbit in.', 'Its heat shield reaches over 500 °C while the instruments stay cool.'] },
  { id: 'bepicolombo', name: 'BepiColombo', agency: 'ESA', launched: '2018', status: 'Active, arriving at Mercury',
    blurb: 'A European and Japanese pair of orbiters nearing Mercury after years of flybys.',
    facts: ['It carries two orbiters, one from ESA and one from JAXA.', 'It is due to enter orbit around Mercury in November 2026.'] },
  { id: 'juice', name: 'JUICE', agency: 'ESA', launched: '2023', status: 'Active, cruising to Jupiter',
    blurb: 'A European mission to Jupiter’s icy moons, ending in orbit around Ganymede.',
    facts: ['It will be the first spacecraft to orbit a moon of another planet.', 'It reaches Jupiter in 2031.'] },
  { id: 'hera', name: 'Hera', agency: 'ESA', launched: '2024', status: 'Active, arriving at Didymos',
    blurb: 'A European follow-up to NASA’s DART, going to see the crater DART made when it hit the asteroid moon Dimorphos.',
    facts: ['DART changed Dimorphos’s orbit in 2022, the first time humans moved a celestial body.', 'It is due to arrive in late 2026.'] },
  { id: 'hayabusa2', name: 'Hayabusa2', agency: 'JAXA', launched: '2014', status: 'Active, on an extended mission',
    blurb: 'Brought back rock from asteroid Ryugu in 2020, and is now heading for two more small asteroids.',
    facts: ['It fired a copper bullet into Ryugu to dig out fresh material.', 'It will reach a tiny, fast-spinning asteroid called 1998 KY26 in 2031.'] },
]

export const probeById = (id: string): Probe | undefined => PROBES.find((p) => p.id === id)
