export type Palette = { from: string; to: string };

// Broad, high-contrast pairs around the color wheel
export const PALETTES: Palette[] = [
  { from: '#FF6A00', to: '#0A5AFF' }, // orange -> blue
  { from: '#FF3B30', to: '#34C759' }, // red -> green
  { from: '#FF2D55', to: '#5856D6' }, // pink -> indigo
  { from: '#FF9500', to: '#5AC8FA' }, // orange -> light blue
  { from: '#FFCC00', to: '#007AFF' }, // yellow -> blue
  { from: '#FF7A1A', to: '#2D6BFF' }, // orange -> cobalt
  { from: '#FF8A3D', to: '#4C7DFF' }, // soft orange -> cornflower
  { from: '#34C759', to: '#AF52DE' }, // green -> purple
  { from: '#0BD3D3', to: '#F43F5E' }, // teal -> rose
  { from: '#22C55E', to: '#2563EB' }, // emerald -> blue
  { from: '#E11D48', to: '#06B6D4' }, // rose -> cyan
  { from: '#F97316', to: '#8B5CF6' }, // orange -> violet
];

export function paletteFromSeed(seed?: string | number): Palette {
  const s = `${seed ?? ''}`;
  let acc = 0;
  for (let i = 0; i < s.length; i++) acc = (acc * 131 + s.charCodeAt(i)) >>> 0;
  const pick = PALETTES[acc % PALETTES.length];
  return pick || PALETTES[0];
}

export type VisualStyle = 'liquid' | 'radial' | 'arc';
export function styleFromSeed(seed?: string | number): VisualStyle {
  const s = `${seed ?? ''}`;
  let acc = 0;
  for (let i = 0; i < s.length; i++) acc = (acc * 167 + s.charCodeAt(i)) >>> 0;
  const pick = acc % 3;
  return pick === 0 ? 'liquid' : pick === 1 ? 'radial' : 'arc';
}
