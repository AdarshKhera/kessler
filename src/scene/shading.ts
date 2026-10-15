import * as THREE from 'three'
import { RING_INNER, RING_OUTER, type Atmosphere } from '../data/planetMaps'

type U<T> = THREE.IUniform<T>
export const vec3Uniform = (): U<THREE.Vector3> => ({ value: new THREE.Vector3(0, 0, 1) })
export const texUniform = (): U<THREE.Texture | null> => ({ value: null })

const scratch = new THREE.Matrix4()
const tmp = new THREE.Vector3()

/** Keeps `out` equal to the world direction `dir` expressed in the camera's view space, refreshed as the object draws. */
export function trackSunView(obj: THREE.Object3D, dir: THREE.Vector3, out: U<THREE.Vector3>): void {
  const previous = obj.onBeforeRender
  obj.onBeforeRender = function (this: THREE.Object3D, ...args: Parameters<typeof previous>) {
    out.value.copy(dir).transformDirection(args[2].matrixWorldInverse)
    previous.apply(this, args)
  }
}

/** Keeps `sun` and `cam` equal to the sun direction and camera position in the object's own frame. */
export function trackLocal(obj: THREE.Object3D, dir: THREE.Vector3, sun: U<THREE.Vector3>, cam?: U<THREE.Vector3>): void {
  const previous = obj.onBeforeRender
  obj.onBeforeRender = function (this: THREE.Object3D, ...args: Parameters<typeof previous>) {
    scratch.copy(obj.matrixWorld).invert()
    sun.value.copy(dir).transformDirection(scratch)
    if (cam) cam.value.copy(tmp.copy(args[2].position).applyMatrix4(scratch)).normalize()
    previous.apply(this, args)
  }
}

/** Earth: ocean-only sun glint (from the specular map) and city lights that show only on the night side. */
export function patchEarth(material: THREE.MeshStandardMaterial, sunView: U<THREE.Vector3>, specMap: U<THREE.Texture | null>): void {
  material.customProgramCacheKey = () => 'earth-surface'
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSunView = sunView
    shader.uniforms.uSpecMap = specMap
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunView;\nuniform sampler2D uSpecMap;')
      .replace(
        '#include <roughnessmap_fragment>',
        `#ifdef USE_MAP
          float roughnessFactor = mix(0.92, 0.4, texture2D(uSpecMap, vMapUv).r);
        #else
          float roughnessFactor = roughness;
        #endif`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= smoothstep(0.1, -0.25, dot(nonPerturbedNormal, uSunView));')
  }
}

/** Saturn's globe: the rings throw a soft shadow across it. Sphere position is in the (unspun) ring frame about Y. */
export function patchRingShadow(material: THREE.MeshStandardMaterial, sunLocal: U<THREE.Vector3>, ringMap: U<THREE.Texture | null>): void {
  material.customProgramCacheKey = () => 'ring-shadow'
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSunLocal = sunLocal
    shader.uniforms.uRingMap = ringMap
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocalPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalPos = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vLocalPos;
        uniform vec3 uSunLocal;
        uniform sampler2D uRingMap;
        float ringShadow(vec3 p) {
          float t = -p.y / (abs(uSunLocal.y) < 1e-4 ? 1e-4 : uSunLocal.y);
          vec3 h = p + uSunLocal * t;
          float u = clamp((length(h.xz) - ${RING_INNER.toFixed(5)}) / ${(RING_OUTER - RING_INNER).toFixed(5)}, 0.0, 1.0);
          float a = texture2D(uRingMap, vec2(u, 0.5)).a;
          float inside = step(0.0, t) * step(0.001, u) * step(u, 0.999);
          return 1.0 - 0.94 * a * inside;
        }`,
      )
      .replace('#include <aomap_fragment>', 'float rs = ringShadow(normalize(vLocalPos));\nreflectedLight.directDiffuse *= rs;\nreflectedLight.directSpecular *= rs;\n#include <aomap_fragment>')
  }
}

/** The ring itself, lit from the sun, shadowed by the planet, and dimmer (but glowing where thin) seen from the unlit side. */
export function ringMaterial(map: U<THREE.Texture | null>, sunLocal: U<THREE.Vector3>, camLocal: U<THREE.Vector3>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: { uMap: map, uSunLocal: sunLocal, uCamLocal: camLocal },
    vertexShader: `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uSunLocal;
      uniform vec3 uCamLocal;
      varying vec2 vPos;
      void main() {
        float u = clamp((length(vPos) - ${RING_INNER.toFixed(5)}) / ${(RING_OUTER - RING_INNER).toFixed(5)}, 0.0, 1.0);
        vec4 tex = texture2D(uMap, vec2(u, 0.5));
        vec3 q = vec3(vPos, 0.0);
        float b = dot(q, uSunLocal);
        float d = sqrt(max(dot(q, q) - b * b, 0.0));
        float shadow = b < 0.0 ? smoothstep(0.985, 1.025, d) : 1.0;
        bool sameSide = uSunLocal.z * uCamLocal.z >= 0.0;
        float lit = sameSide ? 1.0 : mix(0.14, 0.6, 1.0 - tex.a);
        float incidence = mix(0.3, 1.0, smoothstep(0.0, 0.3, abs(uSunLocal.z)));
        gl_FragColor = vec4(tex.rgb * 1.08 * lit * incidence * mix(0.04, 1.0, shadow), tex.a);
      }`,
  })
}

const SHELL_VERTEX = `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`

const SHELL_FRAGMENT = (glow: boolean) => `
  uniform vec3 uColor;
  uniform vec3 uSunView;
  uniform float uStrength;
  uniform float uEdge;
  uniform float uTwilight;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 n = normalize(vN);
    float d = dot(n, normalize(vV));
    ${glow ? 'float k = pow(clamp(-d / uEdge, 0.0, 1.0), 2.2);' : 'float k = pow(1.0 - clamp(d, 0.0, 1.0), 2.4) * smoothstep(0.0, uEdge, d);'}
    float ndl = dot(n, uSunView);
    float lit = mix(0.015, 1.0, smoothstep(-0.3, 0.55, ndl));
    vec3 tint = mix(uColor, vec3(1.0, 0.5, 0.22), uTwilight * exp(-pow(ndl / 0.22, 2.0)));
    gl_FragColor = vec4(tint * k * lit * uStrength, 1.0);
  }`

/** Two additive shells: haze across the limb, and a soft halo beyond it. Both brighten on the sunlit side. */
export function atmosphereShells(a: Atmosphere, sunView: U<THREE.Vector3>, twilight: number): { rim: THREE.Mesh; glow: THREE.Mesh } {
  const color = new THREE.Color(a.color)
  const make = (scale: number, glow: boolean, strength: number): THREE.Mesh => {
    const edge = Math.sqrt(Math.max(1e-6, 1 - 1 / (scale * scale)))
    const material = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: glow ? THREE.BackSide : THREE.FrontSide,
      uniforms: { uColor: { value: color }, uSunView: sunView, uStrength: { value: strength }, uEdge: { value: edge }, uTwilight: { value: twilight } },
      vertexShader: SHELL_VERTEX,
      fragmentShader: SHELL_FRAGMENT(glow),
    })
    const mesh = new THREE.Mesh(shellGeometry(), material)
    mesh.scale.setScalar(scale)
    mesh.renderOrder = 2
    mesh.raycast = () => undefined // clicks pass through to the world beneath
    return mesh
  }
  return { rim: make(1 + a.height * 0.5, false, a.rim * 1.6), glow: make(1 + a.height, true, a.glow * 1.5) }
}

let shared: THREE.SphereGeometry | null = null
const shellGeometry = (): THREE.SphereGeometry => (shared ??= new THREE.SphereGeometry(1, 96, 64))
