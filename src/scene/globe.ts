import * as THREE from 'three'
import { geoEquirectangular, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import land from 'world-atlas/land-110m.json'
import countries from 'world-atlas/countries-110m.json'
import { EARTH_RADIUS } from '../lib/frames'

const CYAN = new THREE.Color('#5ef2ff')
const sunUniform = { value: new THREE.Vector3(1, 0, 0) }

/** Geodetic degrees to scene xyz (ECF with z north mapped to y up). */
function ecfToScene(latDeg: number, lonDeg: number, r: number, out: number[]): void {
  const la = (latDeg * Math.PI) / 180
  const lo = (lonDeg * Math.PI) / 180
  out.push(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo))
}

/** White land on a transparent equirectangular canvas. Shared with the solar-system Earth texture. */
export function landCanvas(w = 1440, h = 720): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const projection = geoEquirectangular().scale(w / (2 * Math.PI)).translate([w / 2, h / 2])
  const topo = land as unknown as Topology
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  geoPath(projection, ctx)(feature(topo, topo.objects.land) as never)
  ctx.fill()
  return canvas
}

function landMask(): { w: number; h: number; data: Uint8ClampedArray } {
  const w = 1440
  const h = 720
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const projection = geoEquirectangular().scale(w / (2 * Math.PI)).translate([w / 2, h / 2])
  const topo = land as unknown as Topology
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  geoPath(projection, ctx)(feature(topo, topo.objects.land) as never)
  ctx.fill()
  return { w, h, data: ctx.getImageData(0, 0, w, h).data }
}

function landDots(): THREE.Points {
  const { w, h, data } = landMask()
  const pts: number[] = []
  const step = 1.5
  for (let lat = -84; lat <= 84; lat += step) {
    const lonStep = step / Math.max(0.2, Math.cos((lat * Math.PI) / 180))
    for (let lon = -180; lon < 180; lon += lonStep) {
      const x = Math.min(w - 1, Math.floor(((lon + 180) / 360) * w))
      const y = Math.min(h - 1, Math.floor(((90 - lat) / 180) * h))
      if (data[(y * w + x) * 4 + 3] > 128) ecfToScene(lat, lon, EARTH_RADIUS * 1.001, pts)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uSun: sunUniform, uColor: { value: CYAN }, uPx: { value: Math.min(devicePixelRatio, 2) } },
    vertexShader: /* glsl */ `
      uniform vec3 uSun; uniform float uPx;
      varying float vLit;
      void main() {
        vec3 n = normalize(mat3(modelMatrix) * position);
        vLit = smoothstep(-0.15, 0.25, dot(n, uSun));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uPx * clamp(26.0 / -mv.z, 1.2, 3.2);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vLit;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.15, d);
        gl_FragColor = vec4(uColor * (0.18 + 0.7 * vLit), a * (0.28 + 0.5 * vLit));
      }`,
  })
  return new THREE.Points(geo, mat)
}

function densify(coords: number[][], maxStepDeg: number, out: number[]): void {
  for (let i = 0; i < coords.length - 1; i++) {
    const [lo1, la1] = coords[i]
    const [lo2, la2] = coords[i + 1]
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(lo2 - lo1), Math.abs(la2 - la1)) / maxStepDeg))
    for (let k = 0; k < n; k++) {
      ecfToScene(la1 + ((la2 - la1) * k) / n, lo1 + ((lo2 - lo1) * k) / n, EARTH_RADIUS * 1.0008, out)
      ecfToScene(la1 + ((la2 - la1) * (k + 1)) / n, lo1 + ((lo2 - lo1) * (k + 1)) / n, EARTH_RADIUS * 1.0008, out)
    }
  }
}

function borders(): THREE.LineSegments {
  const topo = countries as unknown as Topology
  const m = mesh(topo, topo.objects.countries as never)
  const out: number[] = []
  for (const line of m.coordinates) densify(line as number[][], 1, out)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
  return new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
  )
}

function graticule(): THREE.LineSegments {
  const out: number[] = []
  for (let lat = -60; lat <= 60; lat += 30) densify(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]), 5, out)
  for (let lon = -180; lon < 180; lon += 30) densify(Array.from({ length: 37 }, (_, i) => [lon, -90 + i * 5]), 5, out)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
  return new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.07, depthWrite: false }),
  )
}

function body(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 0.996, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: { uSun: sunUniform },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun; varying vec3 vN; varying vec3 vV;
        void main() {
          vec3 n = normalize(vN);
          float lit = smoothstep(-0.2, 0.35, dot(n, uSun));
          vec3 base = mix(vec3(0.004, 0.014, 0.026), vec3(0.02, 0.075, 0.12), lit);
          vec3 vn = normalize((viewMatrix * vec4(n, 0.0)).xyz);
          float rim = pow(1.0 - max(dot(vn, vV), 0.0), 3.0);
          gl_FragColor = vec4(base + vec3(0.1, 0.5, 0.65) * rim * 0.4, 1.0);
        }`,
    }),
  )
}

function atmosphere(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.09, 96, 64),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV;
        void main() {
          float i = pow(max(0.62 - dot(-vN, vV), 0.0), 2.2);
          gl_FragColor = vec4(vec3(0.2, 0.75, 1.0) * i * 1.1, i * 0.7);
        }`,
    }),
  )
}

export interface Globe {
  /** Rotates with Earth. Attach ECF-fixed things (ground tracks) here. */
  readonly earth: THREE.Group
  readonly root: THREE.Group
  setSun(direction: THREE.Vector3): void
  setBordersVisible(v: boolean): void
}

export function createGlobe(): Globe {
  const root = new THREE.Group()
  const earth = new THREE.Group()
  const bordersLines = borders()
  earth.add(body(), landDots(), bordersLines, graticule())
  root.add(earth, atmosphere())
  return {
    earth,
    root,
    setSun: (d) => sunUniform.value.copy(d).normalize(),
    setBordersVisible: (v) => {
      bordersLines.visible = v
    },
  }
}
