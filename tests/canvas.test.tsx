/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { LayoutProvider, useLayout } from '../src/context/LayoutContext';
import { Canvas } from '../src/components/Canvas';
import { SummaryPanel } from '../src/components/SummaryPanel';

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverMock {
    observe() {
      // no-op for jsdom unit tests
    }
    unobserve() {
      // no-op for jsdom unit tests
    }
    disconnect() {
      // no-op for jsdom unit tests
    }
  }
  (globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock;
}

function CanvasHarness() {
  const { placements, addPlacement } = useLayout();
  return (
    <div>
      <button onClick={() => addPlacement('bin-2x2', 0, 0)}>add-2x2</button>
      <button onClick={() => addPlacement('bin-2x2', 2, 0)}>add-2x2-second</button>
      <button onClick={() => addPlacement('bin-4x2', 2, 0)}>add-4x2</button>
      <div data-testid="placements-json">{JSON.stringify(placements)}</div>
      <div data-testid="placement-count">{placements.length}</div>
    </div>
  );
}

function renderCanvas({ includeSummary = false }: { includeSummary?: boolean } = {}) {
  return render(
    <LayoutProvider>
      <DndContext>
        <Canvas />
      </DndContext>
      {includeSummary && <SummaryPanel />}
      <CanvasHarness />
    </LayoutProvider>
  );
}

describe('Canvas', () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState({}, '', '/');
  });

  it('shows default color text under the size label', () => {
    renderCanvas();
    fireEvent.click(screen.getByText('add-2x2'));
    const placedBin = screen.getByTestId('placed-bin');
    expect(within(placedBin).getByText('White')).toBeTruthy();
  });

  it('paint mode recolors bins and can be toggled off', () => {
    renderCanvas();
    fireEvent.click(screen.getByText('add-2x2'));
    fireEvent.click(screen.getByTestId('paint-mode-toggle'));
    fireEvent.change(screen.getByTestId('paint-color-select'), { target: { value: '#dc2626' } });
    fireEvent.click(screen.getByTestId('placed-bin'));

    const placements = JSON.parse(screen.getByTestId('placements-json').textContent ?? '[]') as Array<{ color?: string }>;
    expect(placements[0]?.color).toBe('#dc2626');
    expect(screen.queryByTestId('placement-editor')).toBeNull();

    fireEvent.click(screen.getByTestId('paint-mode-toggle'));
    fireEvent.click(screen.getByTestId('placed-bin'));
    expect(screen.getByTestId('placement-editor')).toBeTruthy();
  });

  it('clear layout button removes all placements', () => {
    renderCanvas();
    fireEvent.click(screen.getByText('add-2x2'));
    fireEvent.click(screen.getByText('add-4x2'));
    expect(screen.getByTestId('placement-count').textContent).toBe('2');

    fireEvent.click(screen.getByTestId('clear-layout-button'));
    expect(screen.getByTestId('placement-count').textContent).toBe('0');
  });

  it('exits paint mode when clicking empty canvas space', () => {
    renderCanvas();
    fireEvent.click(screen.getByText('add-2x2'));
    fireEvent.click(screen.getByTestId('paint-mode-toggle'));
    expect(screen.getByTestId('paint-color-select')).toBeTruthy();

    fireEvent.pointerDown(screen.getByTestId('canvas-drop-area'));
    expect(screen.queryByTestId('paint-color-select')).toBeNull();

    fireEvent.click(screen.getByTestId('placed-bin'));
    expect(screen.getByTestId('placement-editor')).toBeTruthy();
  });

  it('exits paint mode when clicking any non-bin area', () => {
    renderCanvas();
    fireEvent.click(screen.getByText('add-2x2'));
    fireEvent.click(screen.getByTestId('paint-mode-toggle'));
    expect(screen.getByTestId('paint-color-select')).toBeTruthy();

    fireEvent.pointerDown(screen.getByText('History'));
    expect(screen.queryByTestId('paint-color-select')).toBeNull();
  });

  it('opens editor from placed item card and edits grouped bins together', () => {
    renderCanvas({ includeSummary: true });
    fireEvent.click(screen.getByText('add-2x2'));
    fireEvent.click(screen.getByText('add-2x2-second'));

    fireEvent.click(screen.getByTestId('placed-item-group'));
    expect(screen.getByTestId('placement-editor')).toBeTruthy();

    fireEvent.change(screen.getByTestId('placement-color'), { target: { value: '#dc2626' } });
    const placements = JSON.parse(screen.getByTestId('placements-json').textContent ?? '[]') as Array<{ color?: string }>;
    expect(placements[0]?.color).toBe('#dc2626');
    expect(placements[1]?.color).toBe('#dc2626');
  });

  it('opens editor to the left of cursor near viewport right edge', () => {
    renderCanvas();
    fireEvent.click(screen.getByText('add-2x2'));

    const clientX = window.innerWidth - 2;
    fireEvent.click(screen.getByTestId('placed-bin'), { clientX, clientY: 120 });

    const editor = screen.getByTestId('placement-editor');
    const editorLeft = Number.parseFloat(editor.style.left.replace('px', ''));
    expect(editorLeft).toBeLessThan(clientX);
  });

  it('deletes a bin from the editor popup', () => {
    renderCanvas();
    fireEvent.click(screen.getByText('add-2x2'));
    expect(screen.getByTestId('placement-count').textContent).toBe('1');

    fireEvent.click(screen.getByTestId('placed-bin'));
    fireEvent.click(screen.getByTestId('delete-bin-button'));
    expect(screen.getByTestId('placement-count').textContent).toBe('0');
  });

  it('shows a how-to block and starts the guided tour', () => {
    renderCanvas();
    expect(screen.getByTestId('canvas-how-to')).toBeTruthy();
    fireEvent.click(screen.getByText('Take Tour'));
    expect(screen.queryByTestId('canvas-how-to')).toBeNull();
    expect(screen.getByTestId('tour-popover')).toBeTruthy();
    expect(screen.getByText('1. Pick A Bin')).toBeTruthy();
  });

  it('collapses the how-to box when Hide is clicked', () => {
    renderCanvas();
    expect(screen.getByTestId('canvas-how-to')).toBeTruthy();
    fireEvent.click(screen.getByText('Hide'));
    expect(screen.queryByTestId('canvas-how-to')).toBeNull();
    expect(screen.getByTestId('canvas-how-to-collapsed')).toBeTruthy();

    fireEvent.click(screen.getByText('Show'));
    expect(screen.getByTestId('canvas-how-to')).toBeTruthy();
  });
});
