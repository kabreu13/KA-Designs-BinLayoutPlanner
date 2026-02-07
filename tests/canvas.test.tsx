/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { LayoutProvider, useLayout } from '../src/context/LayoutContext';
import { Canvas } from '../src/components/Canvas';
import { SummaryPanel } from '../src/components/SummaryPanel';
import { OPEN_HOW_TO_EVENT } from '../src/lib/uiEvents';

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

const dismissHowTo = () => {
  const closeButton = screen.queryByRole('button', { name: 'Close how to' });
  if (closeButton) {
    fireEvent.click(closeButton);
  }
};

describe('Canvas', () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState({}, '', '/');
  });

  it('exposes default color in placed bin accessible label', () => {
    renderCanvas();
    fireEvent.click(screen.getByText('add-2x2'));
    const placedBin = screen.getByTestId('placed-bin');
    expect(placedBin.getAttribute('aria-label')).toContain('White');
  });

  it('paint mode recolors bins and can be toggled off', () => {
    renderCanvas();
    dismissHowTo();
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
    dismissHowTo();
    fireEvent.click(screen.getByText('add-2x2'));
    fireEvent.click(screen.getByText('add-4x2'));
    expect(screen.getByTestId('placement-count').textContent).toBe('2');

    fireEvent.click(screen.getByTestId('clear-layout-button'));
    expect(screen.getByTestId('placement-count').textContent).toBe('0');
  });

  it('exits paint mode when clicking empty canvas space', () => {
    renderCanvas();
    dismissHowTo();
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
    dismissHowTo();
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

  it('opens how-to modal from header trigger and starts the guided tour', () => {
    renderCanvas();
    fireEvent(window, new Event(OPEN_HOW_TO_EVENT));
    expect(screen.getByTestId('how-to-modal')).toBeTruthy();
    expect(screen.getByText(/Export PDF or Copy Share Link/i)).toBeTruthy();
    expect(screen.getByText(/Open Etsy Cart/i)).toBeTruthy();
    fireEvent.click(screen.getByText('Take Tour'));
    expect(screen.queryByTestId('how-to-modal')).toBeNull();
    expect(screen.getByTestId('tour-popover')).toBeTruthy();
    expect(screen.getByText('1. Pick A Bin')).toBeTruthy();
  });

  it('closes the how-to modal from the close icon', () => {
    renderCanvas();
    fireEvent(window, new Event(OPEN_HOW_TO_EVENT));
    expect(screen.getByTestId('how-to-modal')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close how to' }));
    expect(screen.queryByTestId('how-to-modal')).toBeNull();
  });
});
