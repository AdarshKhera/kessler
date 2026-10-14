/** 1 scene unit = 1000 km. ECI/ECF (z north) maps to three.js (y up). */
export const sceneUnitsPerKm = 0.001
export const EARTH_RADIUS_KM = 6378.137
export const EARTH_RADIUS = EARTH_RADIUS_KM * sceneUnitsPerKm

export function eciToScene(x: number, y: number, z: number, out: Float32Array, offset: number): void {
  out[offset] = x * sceneUnitsPerKm
  out[offset + 1] = z * sceneUnitsPerKm
  out[offset + 2] = -y * sceneUnitsPerKm
}
