import { Bin } from '../context/LayoutContext';

const sizes: Array<[number, number]> = [
  [2, 2], [2, 4], [2, 6], [2, 8], [2, 10],
  [4, 2], [4, 4], [4, 6], [4, 8], [4, 10],
  [6, 2], [6, 4], [6, 6], [6, 8], [6, 10],
  [8, 2], [8, 4], [8, 6], [8, 8], [8, 10]
];

function categorize(width: number, length: number): Bin['category'] {
  const longest = Math.max(width, length);
  if (longest <= 4) return 'small';
  if (longest <= 6) return 'medium';
  return 'large';
}

export const BINS: Bin[] = sizes.map(([width, length]) => ({
  id: `bin-${width}x${length}`,
  name: `${width}x${length} Bin`,
  width,
  length,
  height: 2,
  category: categorize(width, length)
}));
