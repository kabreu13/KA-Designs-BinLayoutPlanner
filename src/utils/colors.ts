export const DEFAULT_BIN_COLOR = '#ffffff';
export const CUSTOM_COLOR_VALUE = '__custom__';

export const PRESET_COLORS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#000000' },
  { label: 'Gray', value: '#808080' },
  { label: 'Dark Green', value: '#14532d' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Pink', value: '#ec4899' }
] as const;

export function normalizeHexColor(color: string) {
  const normalized = color.trim().toLowerCase();
  if (normalized.startsWith('#')) return normalized;
  return `#${normalized}`;
}

export function getColorSelection(color?: string) {
  if (!color) return DEFAULT_BIN_COLOR;
  const normalized = normalizeHexColor(color);
  return PRESET_COLORS.some((option) => option.value === normalized) ? normalized : CUSTOM_COLOR_VALUE;
}

export function getColorLabel(color?: string) {
  if (!color) return 'White';
  const normalized = normalizeHexColor(color);
  const preset = PRESET_COLORS.find((option) => option.value === normalized);
  return preset ? preset.label : 'Custom';
}

export function getContrastText(color: string) {
  const hex = normalizeHexColor(color).replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5 ? '#f8fafc' : '#0f172a';
}
