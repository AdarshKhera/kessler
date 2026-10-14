import * as THREE from 'three'

export function createStars(count = 1800, radius = 600): THREE.Points {
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1
    const t = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const r = radius
    pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: '#9fc7ff', size: 1.1, sizeAttenuation: false, transparent: true, opacity: 0.45, depthWrite: false }),
  )
}
