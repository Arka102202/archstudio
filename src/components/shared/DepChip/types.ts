export interface DepChipProps {
  label:    string
  colorVar: string           // CSS var prefix, e.g. "--dep-web"
  onRemove?: () => void      // if provided: chip is "added" — shows ×
  onAdd?:    () => void      // if provided: chip is "not added" — shows "+ add", clickable
}
