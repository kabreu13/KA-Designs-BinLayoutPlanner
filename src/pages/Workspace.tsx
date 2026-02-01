import { useState } from 'react';
import type { ReactNode } from 'react';
import { DndContext, PointerSensor, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BinCatalog } from '../components/BinCatalog';
import { Canvas } from '../components/Canvas';
import { SummaryPanel } from '../components/SummaryPanel';

type PanelSide = 'left' | 'right';

const panelWidthClass = 'w-[320px]';
const collapsedWidthClass = 'w-[40px]';

export function Workspace() {
  const [isCatalogOpen, setIsCatalogOpen] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 0 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  );

  return (
    <DndContext sensors={sensors}>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#F6F7F8]">
        <SidePanel
          side="left"
          isOpen={isCatalogOpen}
          onToggle={() => setIsCatalogOpen((open) => !open)}
          label="Bin catalog"
        >
          <BinCatalog />
        </SidePanel>
        <Canvas />
        <SidePanel
          side="right"
          isOpen={isSummaryOpen}
          onToggle={() => setIsSummaryOpen((open) => !open)}
          label="Summary panel"
        >
          <SummaryPanel />
        </SidePanel>
      </div>
    </DndContext>
  );
}

function SidePanel({
  side,
  isOpen,
  onToggle,
  label,
  children
}: {
  side: PanelSide;
  isOpen: boolean;
  onToggle: () => void;
  label: string;
  children: ReactNode;
}) {
  const borderClass =
    !isOpen && side === 'left'
      ? 'border-r border-slate-900/[0.06]'
      : !isOpen && side === 'right'
        ? 'border-l border-slate-900/[0.06]'
        : '';
  const icon =
    side === 'left'
      ? isOpen
        ? ChevronLeft
        : ChevronRight
      : isOpen
        ? ChevronRight
        : ChevronLeft;
  const Icon = icon;
  const panelId = side === 'left' ? 'bin-catalog-panel' : 'summary-panel';

  const togglePositionClass =
    side === 'left' ? 'right-0 translate-x-full' : 'left-0 -translate-x-full';

  return (
    <div
      data-testid={`side-panel-${side}`}
      className={`relative h-full bg-white transition-[width] duration-200 ease-out ${
        isOpen ? panelWidthClass : collapsedWidthClass
      } ${borderClass}`}
    >
      <div className="h-full overflow-hidden">
        <div
          id={panelId}
          className={`h-full transition-opacity duration-150 ${
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {children}
        </div>
      </div>
      <button
        type="button"
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${label}`}
        title={`${isOpen ? 'Collapse' : 'Expand'} ${label}`}
        onClick={onToggle}
        className={`absolute top-1/2 -translate-y-1/2 ${togglePositionClass} z-10 h-16 w-7 rounded-full bg-white shadow-sm border border-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center`}
      >
        <Icon className="h-4 w-4" />
      </button>
    </div>
  );
}
