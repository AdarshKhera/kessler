export interface UiState {
  readonly selected: number
  readonly hover: number
  readonly partner: number
  /** operator index of the focused fleet, or -1 */
  readonly fleet: number
  /** operator index being hovered in the chip row, or -1 */
  readonly fleetHover: number
  /** SATCAT owner code of the focused country (lower case), or '' */
  readonly country: string
  readonly countryHover: string
}

export const initialState: UiState = { selected: -1, hover: -1, partner: -1, fleet: -1, fleetHover: -1, country: '', countryHover: '' }
