export type DragItem =
  | { type: 'bin'; binId: string }
  | { type: 'placement'; placementId: string; binId: string };

export type Point = { x: number; y: number };

export const applyDelta = (origin: Point, delta: { x: number; y: number }): Point => ({
  x: origin.x + delta.x,
  y: origin.y + delta.y
});
