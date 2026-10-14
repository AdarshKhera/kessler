/**
 * Name families used to find Indian objects that are not in CelesTrak's "active" list:
 * retired satellites plus launch-vehicle stages and fragments still in orbit. Matches are then
 * kept only if the owner table says India owns them, so look-alike foreign names are dropped.
 */
export const INDIA_QUERIES: readonly string[] = [
  'PSLV', 'GSLV', 'LVM3', 'GSAT', 'INSAT', 'IRS', 'CARTOSAT', 'RISAT', 'RESOURCESAT', 'OCEANSAT', 'KALPANA', 'IRNSS',
]

export const INDIA_OWNER = 'IND'
