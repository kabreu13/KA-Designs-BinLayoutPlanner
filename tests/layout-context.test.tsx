/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayoutProvider, useLayout } from '../src/context/LayoutContext';

const arePlacementsConnected = (nodes: Array<{ x: number; y: number; width: number; length: number }>) => {
  if (nodes.length === 0) return true;
  const adjacent = (a: typeof nodes[number], b: typeof nodes[number]) => {
    const aRight = a.x + a.width;
    const aBottom = a.y + a.length;
    const bRight = b.x + b.width;
    const bBottom = b.y + b.length;
    const horizontalTouch = (aRight === b.x || bRight === a.x) && a.y < bBottom && aBottom > b.y;
    const verticalTouch = (aBottom === b.y || bBottom === a.y) && a.x < bRight && aRight > b.x;
    return horizontalTouch || verticalTouch;
  };

  const visited = new Set<number>();
  const stack = [0];
  while (stack.length > 0) {
    const index = stack.pop() ?? 0;
    if (visited.has(index)) continue;
    visited.add(index);
    nodes.forEach((node, j) => {
      if (!visited.has(j) && adjacent(nodes[index], node)) {
        stack.push(j);
      }
    });
  }

  return visited.size === nodes.length;
};

function Harness() {
  const {
    placements,
    addPlacement,
    movePlacement,
    updatePlacement,
    undo,
    redo,
    canUndo,
    canRedo,
    setDrawerSize,
    importState,
    exportState,
    removePlacement,
    clearPlacements,
    suggestLayout
  } = useLayout();
  const [lastStatus, setLastStatus] = React.useState<string>('none');
  const [lastSuggest, setLastSuggest] = React.useState<{ status: string; moved: number } | null>(null);

  return (
    <div>
      <div data-testid="count">{placements.length}</div>
      <div data-testid="can-undo">{String(canUndo)}</div>
      <div data-testid="can-redo">{String(canRedo)}</div>
      <div data-testid="drawer">{`${exportState().drawerWidth}x${exportState().drawerLength}`}</div>
      <div data-testid="last-status">{lastStatus}</div>
      <div data-testid="last-suggest">{lastSuggest?.status ?? 'none'}</div>
      <div data-testid="last-suggest-moved">{lastSuggest?.moved ?? 0}</div>
      <div data-testid="placements">{JSON.stringify(placements)}</div>
      <button onClick={() => addPlacement('bin-2x2', 0, 0)}>add</button>
      <button
        onClick={() => {
          const result = addPlacement('bin-2x2', 0, 0);
          setLastStatus(result.status);
        }}
      >
        add-2x2-00
      </button>
      <button
        onClick={() => {
          const result = addPlacement('bin-2x2', 2, 0);
          setLastStatus(result.status);
        }}
      >
        add-2x2-20
      </button>
      <button
        onClick={() => {
          const result = addPlacement('bin-2x2', 0, 0);
          setLastStatus(result.status);
        }}
      >
        add-2x2-00-dup
      </button>
      <button
        onClick={() => {
          const result = addPlacement('bin-2x2', 0, 0);
          setLastStatus(result.status);
        }}
      >
        add-2x2-for-autofit
      </button>
      <button
        onClick={() => {
          if (placements[0]) {
            const result = movePlacement(placements[0].id, 1, 1);
            setLastStatus(result.status);
          }
        }}
      >
        move
      </button>
      <button
        onClick={() => {
          if (placements[1]) {
            const result = movePlacement(placements[1].id, 0, 0);
            setLastStatus(result.status);
          }
        }}
      >
        move-second-to-00
      </button>
      <button
        onClick={() => {
          const result = addPlacement('missing-bin', 0, 0);
          setLastStatus(result.status);
        }}
      >
        add-missing
      </button>
      <button
        onClick={() => {
          const result = movePlacement('missing-placement', 0, 0);
          setLastStatus(result.status);
        }}
      >
        move-missing
      </button>
      <button
        onClick={() => {
          if (placements[0]) {
            removePlacement(placements[0].id);
          }
        }}
      >
        remove
      </button>
      <button
        onClick={() => {
          if (placements[0]) {
            updatePlacement(placements[0].id, { label: 'Top bin' });
          }
        }}
      >
        label-first
      </button>
      <button
        onClick={() => {
          if (placements[0]) {
            updatePlacement(placements[0].id, { color: '#ff0000' });
          }
        }}
      >
        color-first
      </button>
      <button
        onClick={() => {
          if (placements[0]) {
            updatePlacement(placements[0].id, { width: 4 });
          }
        }}
      >
        resize-first-width
      </button>
      <button
        onClick={() => {
          if (placements[0]) {
            updatePlacement(placements[0].id, { width: 8 });
          }
        }}
      >
        resize-first-width-8
      </button>
      <button
        onClick={() => {
          if (placements[0]) {
            updatePlacement(placements[0].id, { width: 10 });
          }
        }}
      >
        resize-first-width-10
      </button>
      <button
        onClick={() => {
          if (placements[0]) {
            updatePlacement(placements[0].id, { length: 4 });
          }
        }}
      >
        resize-first-length
      </button>
      <button
        onClick={() => {
          const result = suggestLayout('pack');
          setLastSuggest(result);
        }}
      >
        suggest-layout
      </button>
      <button
        onClick={() => {
          const result = suggestLayout('random');
          setLastSuggest(result);
        }}
      >
        suggest-layout-random
      </button>
      <button onClick={undo}>undo</button>
      <button onClick={redo}>redo</button>
      <button onClick={() => setDrawerSize(30, 20)}>resize</button>
      <button onClick={() => setDrawerSize(4, 4)}>resize-4x4</button>
      <button onClick={() => setDrawerSize(2, 2)}>resize-2x2</button>
      <button onClick={() => setDrawerSize(-5, 20)}>resize-invalid</button>
      <button onClick={clearPlacements}>clear-all</button>
      <button
        onClick={() =>
          importState({
            drawerWidth: 24,
            drawerLength: 18,
            placements: []
          })
        }
      >
        import-ok
      </button>
      <button
        onClick={() =>
          importState({
            drawerWidth: 24,
            drawerLength: 0,
            placements: []
          })
        }
      >
        import-bad
      </button>
      <button
        onClick={() =>
          importState({
            drawerWidth: 0,
            drawerLength: 0,
            placements: 'nope' as unknown as []
          })
        }
      >
        import-bad-shape
      </button>
      <button
        onClick={() =>
          importState({
            drawerWidth: 2,
            drawerLength: 2,
            placements: [
              { id: 'p1', binId: 'bin-2x2', x: 0, y: 0 },
              { id: 'p2', binId: 'bin-2x2', x: 0, y: 0 }
            ]
          })
        }
      >
        import-overlap
      </button>
      <button
        onClick={() =>
          importState({
            drawerWidth: 4,
            drawerLength: 4,
            placements: [
              { id: 'p1', binId: 'bin-2x2', x: 0, y: 0 },
              { id: 'p2', binId: 'bin-2x2', x: 0, y: 0 }
            ]
          })
        }
      >
        import-overlap-4x4
      </button>
      <button
        onClick={() =>
          importState({
            drawerWidth: 4,
            drawerLength: 4,
            placements: [{ id: 'p1', binId: 'bin-2x2', x: -1, y: 3 }]
          })
        }
      >
        import-out-of-bounds
      </button>
      <button
        onClick={() =>
          importState({
            drawerWidth: 8,
            drawerLength: 8,
            placements: [
              { id: 'p1', binId: 'bin-2x2', x: 0, y: 0 },
              { id: 'p2', binId: 'bin-2x2', x: 6, y: 0 },
              { id: 'p3', binId: 'bin-2x2', x: 0, y: 6 }
            ]
          })
        }
      >
        import-separated
      </button>
      <button
        onClick={() =>
          importState({
            drawerWidth: 8,
            drawerLength: 8,
            placements: [{ id: 'p1', binId: 'bin-2x2', x: 0, y: 0 }]
          })
        }
      >
        import-no-color
      </button>
    </div>
  );
}

describe('LayoutProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState({}, '', '/');
  });

  it('adds, moves, undoes, and redoes placements', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );

    fireEvent.click(screen.getByText('add'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('can-undo').textContent).toBe('true');

    fireEvent.click(screen.getByText('move'));
    fireEvent.click(screen.getByText('undo'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('can-redo').textContent).toBe('true');

    fireEvent.click(screen.getByText('redo'));
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('updates drawer size and imports valid state', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );

    fireEvent.click(screen.getByText('resize'));
    expect(screen.getByTestId('drawer').textContent).toBe('30x20');

    fireEvent.click(screen.getByText('import-ok'));
    expect(screen.getByTestId('drawer').textContent).toBe('24x18');
  });

  it('ignores invalid drawer sizes at the source', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );

    fireEvent.click(screen.getByText('resize'));
    expect(screen.getByTestId('drawer').textContent).toBe('30x20');

    fireEvent.click(screen.getByText('resize-invalid'));
    expect(screen.getByTestId('drawer').textContent).toBe('30x20');
  });

  it('autofits when adding onto an occupied area', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );

    fireEvent.click(screen.getByText('resize-4x4'));
    fireEvent.click(screen.getByText('add-2x2-00'));
    fireEvent.click(screen.getByText('add-2x2-00-dup'));
    expect(screen.getByTestId('last-status').textContent).toBe('autofit');
  });

  it('blocks placement when drawer is full', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );

    fireEvent.click(screen.getByText('resize-2x2'));
    fireEvent.click(screen.getByText('add-2x2-for-autofit'));
    fireEvent.click(screen.getByText('add-2x2-00-dup'));
    expect(screen.getByTestId('last-status').textContent).toBe('blocked');
  });

  it('rejects invalid import state', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );

    fireEvent.click(screen.getByText('import-bad'));
    expect(screen.getByTestId('drawer').textContent).toBe('24x18');

    fireEvent.click(screen.getByText('import-bad-shape'));
    expect(screen.getByTestId('drawer').textContent).toBe('24x18');
  });

  it('loads from localStorage on mount', () => {
    localStorage.setItem(
      'bin-layout-state',
      JSON.stringify({
        drawerWidth: 10,
        drawerLength: 12,
        placements: [{ id: 'p1', binId: 'bin-2x2', x: 1, y: 1 }]
      })
    );

    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );

    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('drawer').textContent).toBe('10x12');
  });

  it('loads from share link query param on mount', () => {
    const encoded = encodeURIComponent(
      btoa(
        JSON.stringify({
          drawerWidth: 8,
          drawerLength: 9,
          placements: [{ id: 'p1', binId: 'bin-2x2', x: 1, y: 1 }]
        })
      )
    );
    history.replaceState({}, '', `/?layout=${encoded}`);

    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );

    expect(screen.getByTestId('drawer').textContent).toBe('8x9');
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('ignores share link payloads with missing fields', () => {
    const encoded = encodeURIComponent(btoa(JSON.stringify({ drawerWidth: 8, drawerLength: 9 })));
    history.replaceState({}, '', `/?layout=${encoded}`);
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    expect(screen.getByTestId('drawer').textContent).toBe('24x18');
  });

  it('handles invalid share link param gracefully', () => {
    history.replaceState({}, '', '/?layout=not-base64');
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    expect(screen.getByTestId('drawer').textContent).toBe('24x18');
  });

  it('handles invalid localStorage JSON gracefully', () => {
    localStorage.setItem('bin-layout-state', '{bad json');
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    expect(screen.getByTestId('drawer').textContent).toBe('24x18');
  });

  it('returns blocked for missing bin or placement', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('add-missing'));
    expect(screen.getByTestId('last-status').textContent).toBe('blocked');
    fireEvent.click(screen.getByText('move-missing'));
    expect(screen.getByTestId('last-status').textContent).toBe('blocked');
  });

  it('removePlacement updates count', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('add'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    fireEvent.click(screen.getByText('remove'));
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('clearPlacements removes all placements', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByText('add'));
    expect(screen.getByTestId('count').textContent).toBe('2');
    fireEvent.click(screen.getByText('clear-all'));
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('undo/redo no-ops when history is empty', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('undo'));
    fireEvent.click(screen.getByText('redo'));
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('keyboard shortcuts ignore non-meta presses', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('add'));
    fireEvent.keyDown(window, { key: 'z', shiftKey: false, metaKey: false, ctrlKey: false });
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('keyboard shortcuts undo and redo when history is available', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('add'));
    fireEvent.keyDown(window, { key: 'z', shiftKey: false, metaKey: true, ctrlKey: false });
    expect(screen.getByTestId('count').textContent).toBe('0');
    fireEvent.keyDown(window, { key: 'z', shiftKey: true, metaKey: true, ctrlKey: false });
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('autofits when moving into an occupied spot', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('resize-4x4'));
    fireEvent.click(screen.getByText('add-2x2-00'));
    fireEvent.click(screen.getByText('add-2x2-20'));
    fireEvent.click(screen.getByText('move-second-to-00'));
    expect(screen.getByTestId('last-status').textContent).toBe('autofit');
  });

  it('blocked move returns when no space is available', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('import-overlap'));
    fireEvent.click(screen.getByText('move-second-to-00'));
    expect(screen.getByTestId('last-status').textContent).toBe('blocked');
  });

  it('imports out-of-bounds placements without crashing', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('import-out-of-bounds'));
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('updatePlacement updates label and color', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByText('label-first'));
    fireEvent.click(screen.getByText('color-first'));
    const placements = JSON.parse(screen.getByTestId('placements').textContent ?? '[]') as { label?: string; color?: string }[];
    expect(placements[0]?.label).toBe('Top bin');
    expect(placements[0]?.color).toBe('#ff0000');
  });

  it('addPlacement defaults color to white', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('add'));
    const placements = JSON.parse(screen.getByTestId('placements').textContent ?? '[]') as { color?: string }[];
    expect(placements[0]?.color).toBe('#ffffff');
  });

  it('importState applies white default color when missing', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('import-no-color'));
    const placements = JSON.parse(screen.getByTestId('placements').textContent ?? '[]') as { color?: string }[];
    expect(placements[0]?.color).toBe('#ffffff');
  });

  it('updatePlacement resizes bins', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByText('resize-first-width'));
    fireEvent.click(screen.getByText('resize-first-length'));
    const placements = JSON.parse(screen.getByTestId('placements').textContent ?? '[]') as { width?: number; length?: number }[];
    expect(placements[0]?.width).toBe(4);
    expect(placements[0]?.length).toBe(4);
  });

  it('updatePlacement allows out-of-bounds sizes up to 8', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('resize-4x4'));
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByText('resize-first-width-8'));
    const placements = JSON.parse(screen.getByTestId('placements').textContent ?? '[]') as { width?: number }[];
    expect(placements[0]?.width).toBe(8);
  });

  it('updatePlacement blocks sizes outside the allowed range', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByText('resize-first-width-10'));
    const placements = JSON.parse(screen.getByTestId('placements').textContent ?? '[]') as { width?: number }[];
    expect(placements[0]?.width).toBe(2);
  });

  it('suggestLayout no-ops on empty layouts', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('suggest-layout'));
    expect(screen.getByTestId('last-suggest').textContent).toBe('applied');
    expect(screen.getByTestId('last-suggest-moved').textContent).toBe('0');
  });

  it('suggestLayout resolves overlaps when space exists', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('import-overlap-4x4'));
    fireEvent.click(screen.getByText('suggest-layout'));
    expect(screen.getByTestId('last-suggest').textContent).toBe('applied');
    expect(Number(screen.getByTestId('last-suggest-moved').textContent)).toBeGreaterThan(0);
    const placements = JSON.parse(screen.getByTestId('placements').textContent ?? '[]') as { x: number; y: number }[];
    const unique = new Set(placements.map((p) => `${p.x},${p.y}`));
    expect(unique.size).toBe(placements.length);
  });

  it('suggestLayout pack keeps bins connected', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('import-separated'));
    fireEvent.click(screen.getByText('suggest-layout'));
    const placements = JSON.parse(screen.getByTestId('placements').textContent ?? '[]') as { x: number; y: number }[];
    const nodes = placements.map((placement) => ({ x: placement.x, y: placement.y, width: 2, length: 2 }));
    expect(arePlacementsConnected(nodes)).toBe(true);
  });

  it('suggestLayout random mode keeps bins connected', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('import-separated'));
    fireEvent.click(screen.getByText('suggest-layout-random'));
    expect(screen.getByTestId('last-suggest').textContent).toBe('applied');
    const placements = JSON.parse(screen.getByTestId('placements').textContent ?? '[]') as { x: number; y: number }[];
    const nodes = placements.map((placement) => ({ x: placement.x, y: placement.y, width: 2, length: 2 }));
    expect(arePlacementsConnected(nodes)).toBe(true);
  });

  it('suggestLayout blocks when bins cannot fit', () => {
    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );
    fireEvent.click(screen.getByText('import-overlap'));
    fireEvent.click(screen.getByText('suggest-layout'));
    expect(screen.getByTestId('last-suggest').textContent).toBe('blocked');
    expect(screen.getByTestId('last-suggest-moved').textContent).toBe('0');
  });

  it('logs warnings and errors in dev mode', () => {
    const env = import.meta.env as unknown as Record<string, unknown>;
    const originalMode = env.MODE;
    const originalDev = env.DEV;
    env.MODE = 'development';
    env.DEV = true;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    localStorage.setItem('bin-layout-state', '{bad json');
    const encoded = encodeURIComponent(
      btoa(
        JSON.stringify({
          drawerWidth: 4,
          drawerLength: 4,
          placements: [
            { id: 'p1', binId: 'bin-2x2', x: 0, y: 0 },
            { id: 'p2', binId: 'bin-2x2', x: 0, y: 0 }
          ]
        })
      )
    );
    history.replaceState({}, '', `/?layout=${encoded}`);

    render(
      <LayoutProvider>
        <Harness />
      </LayoutProvider>
    );

    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
    env.MODE = originalMode;
    env.DEV = originalDev;
  });
});
