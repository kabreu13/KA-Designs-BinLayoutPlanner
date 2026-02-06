/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayoutProvider, useLayout } from '../src/context/LayoutContext';
import { SummaryPanel } from '../src/components/SummaryPanel';

function SummaryHarness({
  placements
}: {
  placements: Array<{ id: string; binId: string; x: number; y: number; color?: string; width?: number; length?: number }>;
}) {
  const { importState } = useLayout();
  return (
    <button
      onClick={() =>
        importState({
          layoutTitle: 'Test Layout',
          drawerWidth: 24,
          drawerLength: 18,
          placements
        })
      }
    >
      seed-summary
    </button>
  );
}

describe('SummaryPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState({}, '', '/');
  });

  it('separates groups by color when sizes match', () => {
    render(
      <LayoutProvider>
        <SummaryHarness
          placements={[
            { id: 'p1', binId: 'bin-4x4', x: 0, y: 0, color: '#ffffff' },
            { id: 'p2', binId: 'bin-4x4', x: 4, y: 0, color: '#dc2626' }
          ]}
        />
        <SummaryPanel />
      </LayoutProvider>
    );

    fireEvent.click(screen.getByText('seed-summary'));
    expect(screen.getAllByTestId('placed-item-group')).toHaveLength(2);
    expect(screen.getByText('REG-BIN-4x4-White')).toBeTruthy();
    expect(screen.getByText('REG-BIN-4x4-Red')).toBeTruthy();
  });

  it('renders non-square preview shapes and labels color/amount', () => {
    render(
      <LayoutProvider>
        <SummaryHarness placements={[{ id: 'p1', binId: 'bin-8x2', x: 0, y: 0, color: '#6d28d9' }]} />
        <SummaryPanel />
      </LayoutProvider>
    );

    fireEvent.click(screen.getByText('seed-summary'));
    const preview = screen
      .getAllByTestId('placed-item-preview')
      .find((node) => node.getAttribute('data-size') === '8x2');
    if (!preview) throw new Error('Missing 8x2 preview');
    const previewBody = screen
      .getAllByTestId('placed-item-preview-body')
      .find((node) => node.parentElement === preview);
    if (!previewBody) throw new Error('Missing 8x2 preview body');

    const width = Number.parseInt(previewBody.style.width.replace('px', ''), 10);
    const height = Number.parseInt(previewBody.style.height.replace('px', ''), 10);
    expect(width).toBeGreaterThan(height);
    expect(screen.getByText('REG-BIN-2x8-Custom-#6d28d9')).toBeTruthy();
    expect(screen.getByText('Color: Custom · Amount: 1')).toBeTruthy();
  });

  it('groups colors with different hex formats together', () => {
    render(
      <LayoutProvider>
        <SummaryHarness
          placements={[
            { id: 'p1', binId: 'bin-4x4', x: 0, y: 0, color: '#FFFFFF' },
            { id: 'p2', binId: 'bin-4x4', x: 4, y: 0, color: 'ffffff' }
          ]}
        />
        <SummaryPanel />
      </LayoutProvider>
    );

    fireEvent.click(screen.getByText('seed-summary'));
    expect(screen.getAllByTestId('placed-item-group')).toHaveLength(1);
    expect(screen.getByText('Color: White · Amount: 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Delete\s+\d+\s+bins?/i })).toBeTruthy();
  });
});
