import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export type StageMode = 'earth' | 'solar'

export interface SolarRig {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls
}

export interface Stage {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls
  readonly solar: SolarRig
  readonly canvas: HTMLCanvasElement
  readonly mode: StageMode
  setMode(mode: StageMode): void
  /** Called every frame before the solar scene renders, so the caller can step it. */
  onSolarFrame: ((dt: number) => void) | null
  render(): void
  flyTo(direction: THREE.Vector3, radius?: number): void
  zoomBy(factor: number): void
  resetView(): void
  size(): { width: number; height: number }
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setClearColor('#01040a')
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 2000)
  camera.position.set(-6, 10, 26)

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.07
  controls.minDistance = 8.5
  controls.maxDistance = 140
  controls.rotateSpeed = 0.6
  controls.zoomSpeed = 0.7
  controls.enablePan = false
  controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches
  controls.autoRotateSpeed = 0.35
  controls.addEventListener('start', () => {
    controls.autoRotate = false
  })

  const solarScene = new THREE.Scene()
  const solarCamera = new THREE.PerspectiveCamera(40, 1, 1e-7, 4000)
  solarCamera.position.set(0.35, 0.45, 0.82).setLength(3)
  const solarControls = new OrbitControls(solarCamera, canvas)
  solarControls.enableDamping = true
  solarControls.dampingFactor = 0.08
  solarControls.rotateSpeed = 0.7
  solarControls.zoomSpeed = 1.15
  solarControls.enablePan = false
  solarControls.minDistance = 1e-5
  solarControls.maxDistance = 400
  solarControls.enabled = false

  const composer = new EffectComposer(renderer)
  const renderPass = new RenderPass(scene, camera)
  composer.addPass(renderPass)
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.45, 0.32)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const resize = () => {
    const parent = canvas.parentElement!
    const w = parent.clientWidth
    const h = parent.clientHeight
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    solarCamera.aspect = w / h
    solarCamera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(canvas.parentElement!)
  resize()

  let fly: { fromDir: THREE.Vector3; turn: THREE.Quaternion; r0: number; r1: number; t0: number } | null = null
  const identity = new THREE.Quaternion()
  const flyTo = (direction: THREE.Vector3, radius?: number) => {
    if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() === 0) return
    const r0 = camera.position.length()
    const fromDir = camera.position.clone().normalize()
    const turn = new THREE.Quaternion().setFromUnitVectors(fromDir, direction.clone().normalize())
    fly = { fromDir, turn, r0, r1: radius ?? THREE.MathUtils.clamp(r0, 14, 34), t0: performance.now() }
    controls.autoRotate = false
  }

  let mode: StageMode = 'earth'
  let last = performance.now()
  const stage: Stage = {
    scene,
    camera,
    controls,
    solar: { scene: solarScene, camera: solarCamera, controls: solarControls },
    canvas,
    get mode() {
      return mode
    },
    onSolarFrame: null,
    setMode(next) {
      mode = next
      controls.enabled = next === 'earth'
      solarControls.enabled = next === 'solar'
      renderPass.scene = next === 'earth' ? scene : solarScene
      renderPass.camera = next === 'earth' ? camera : solarCamera
    },
    flyTo,
    zoomBy: (factor) => {
      if (mode === 'solar') {
        solarCamera.position.setLength(THREE.MathUtils.clamp(solarCamera.position.length() * factor, solarControls.minDistance, solarControls.maxDistance))
        return
      }
      const r = THREE.MathUtils.clamp(camera.position.length() * factor, controls.minDistance, controls.maxDistance)
      flyTo(camera.position.clone().normalize(), r)
    },
    resetView: () => flyTo(new THREE.Vector3(-6, 10, 26).normalize(), 28.5),
    size: () => ({ width: canvas.clientWidth, height: canvas.clientHeight }),
    render() {
      const now = performance.now()
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (mode === 'solar') {
        stage.onSolarFrame?.(dt)
        const d = solarCamera.position.length()
        solarCamera.near = Math.max(1e-9, d * 0.0004)
        solarCamera.far = 4000
        solarCamera.updateProjectionMatrix()
        solarControls.update()
        composer.render()
        return
      }
      if (fly) {
        const k = Math.min(1, (performance.now() - fly.t0) / 900)
        const e = 1 - Math.pow(1 - k, 3)
        const q = identity.clone().slerp(fly.turn, e)
        camera.position.copy(fly.fromDir).applyQuaternion(q).multiplyScalar(THREE.MathUtils.lerp(fly.r0, fly.r1, e))
        if (k >= 1) fly = null
      }
      controls.update()
      composer.render()
    },
  }
  return stage
}
