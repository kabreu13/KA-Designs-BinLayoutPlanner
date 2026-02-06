import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { ChevronDown, ChevronLeft, ChevronRight, Package2, PanelRight } from 'lucide-react';
import { BinCatalog } from '../components/BinCatalog';
import { Canvas } from '../components/Canvas';
import { SummaryPanel } from '../components/SummaryPanel';
import { BinSizePreview } from '../components/BinSizePreview';
import { useLayout } from '../context/LayoutContext';
import type { DragItem } from '../utils/dragMath';

type PanelSide = 'left' | 'right';
type MobileTab = 'catalog' | 'summary';

const panelWidthClass = 'w-[320px]';
const collapsedWidthClass = 'w-[40px]';

export function Workspace() {
  const { bins } = useLayout();
  const [isCatalogOpen, setIsCatalogOpen] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  const [activeBinId, setActiveBinId] = useState<string | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );
  const [mobileTab, setMobileTab] = useState<MobileTab>('catalog');
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [layoutResizeKey, setLayoutResizeKey] = useState(0);
  const [mobileBottomInsetPx, setMobileBottomInsetPx] = useState(100);
  const mobilePanelRef = useRef<HTMLDivElement | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );
  const activeBin = activeBinId ? bins.find((bin) => bin.id === activeBinId) ?? null : null;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 767px)');
    const syncLayout = () => {
      const nextMobile = media.matches;
      setIsMobileLayout(nextMobile);
      if (!nextMobile) {
        setIsMobilePanelOpen(false);
      }
    };
    syncLayout();
    media.addEventListener('change', syncLayout);
    return () => media.removeEventListener('change', syncLayout);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setLayoutResizeKey((key) => key + 1);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setLayoutResizeKey((key) => key + 1);
  }, [isCatalogOpen, isSummaryOpen, isMobilePanelOpen, isMobileLayout]);

  const updateMobileInset = useCallback(() => {
    const rect = mobilePanelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMobileBottomInsetPx(Math.ceil(rect.height) + 12);
  }, []);

  useEffect(() => {
    if (!isMobileLayout) return;
    updateMobileInset();
  }, [isMobileLayout, isMobilePanelOpen, mobileTab, layoutResizeKey, updateMobileInset]);

  useEffect(() => {
    if (!isMobileLayout) return;
    const node = mobilePanelRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => updateMobileInset());
    observer.observe(node);
    return () => observer.disconnect();
  }, [isMobileLayout, updateMobileInset]);

  const openMobilePanel = (tab: MobileTab) => {
    if (mobileTab === tab) {
      setIsMobilePanelOpen((open) => !open);
      return;
    }
    setMobileTab(tab);
    setIsMobilePanelOpen(true);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => {
        const drag = event.active.data.current as DragItem | undefined;
        if (!drag || drag.type !== 'bin') {
          setActiveBinId(null);
          return;
        }
        setActiveBinId(drag.binId);
      }}
      onDragEnd={() => setActiveBinId(null)}
      onDragCancel={() => setActiveBinId(null)}
    >
      <div className="h-[calc(100vh-65px)] supports-[height:100dvh]:h-[calc(100dvh-65px)]">
        {isMobileLayout ? (
          <div className="relative h-full min-h-0 overflow-hidden bg-[#F6F7F8]">
            <Canvas
              isMobileLayout
              mobileBottomInsetPx={mobileBottomInsetPx}
              layoutResizeKey={layoutResizeKey}
            />
            <div
              ref={mobilePanelRef}
              className="absolute inset-x-0 bottom-0 z-40 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
            >
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-lg">
                <div role="tablist" aria-label="Mobile panels" className="grid grid-cols-[1fr_1fr_auto] items-center gap-1 p-1.5">
                  <button
                    type="button"
                    data-testid="mobile-tab-catalog"
                    id="mobile-tab-catalog"
                    onClick={() => openMobilePanel('catalog')}
                    role="tab"
                    aria-selected={mobileTab === 'catalog'}
                    aria-controls="mobile-panel-content"
                    tabIndex={mobileTab === 'catalog' ? 0 : -1}
                    className={`min-h-11 rounded-xl px-3 text-sm font-medium transition-colors ${
                      mobileTab === 'catalog' && isMobilePanelOpen
                        ? 'bg-[#14476B]/10 text-[#14476B]'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Package2 className="h-4 w-4" />
                      Catalog
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="mobile-tab-summary"
                    id="mobile-tab-summary"
                    onClick={() => openMobilePanel('summary')}
                    role="tab"
                    aria-selected={mobileTab === 'summary'}
                    aria-controls="mobile-panel-content"
                    tabIndex={mobileTab === 'summary' ? 0 : -1}
                    className={`min-h-11 rounded-xl px-3 text-sm font-medium transition-colors ${
                      mobileTab === 'summary' && isMobilePanelOpen
                        ? 'bg-[#14476B]/10 text-[#14476B]'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <PanelRight className="h-4 w-4" />
                      Summary
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="mobile-panel-toggle"
                    aria-expanded={isMobilePanelOpen}
                    aria-controls="mobile-panel-content"
                    onClick={() => setIsMobilePanelOpen((open) => !open)}
                    className="h-11 w-11 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${isMobilePanelOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                <div
                  className={`transition-[max-height] duration-200 ease-out overflow-hidden ${
                    isMobilePanelOpen ? 'max-h-[52vh]' : 'max-h-0'
                  }`}
                >
                  <div
                    id="mobile-panel-content"
                    role="tabpanel"
                    aria-labelledby={mobileTab === 'catalog' ? 'mobile-tab-catalog' : 'mobile-tab-summary'}
                    aria-hidden={!isMobilePanelOpen}
                    tabIndex={isMobilePanelOpen ? 0 : -1}
                    className="h-[52vh] border-t border-slate-200"
                  >
                    {mobileTab === 'catalog' ? <BinCatalog mobile /> : <SummaryPanel mobile />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full overflow-hidden bg-[#F6F7F8]">
            <SidePanel
              side="left"
              isOpen={isCatalogOpen}
              onToggle={() => setIsCatalogOpen((open) => !open)}
              label="Bin catalog"
            >
              <BinCatalog />
            </SidePanel>
            <Canvas layoutResizeKey={layoutResizeKey} />
            <SidePanel
              side="right"
              isOpen={isSummaryOpen}
              onToggle={() => setIsSummaryOpen((open) => !open)}
              label="Summary panel"
            >
              <SummaryPanel />
            </SidePanel>
          </div>
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeBin && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="p-4 flex items-center justify-center">
              <BinSizePreview width={activeBin.width} length={activeBin.length} size="catalog" />
            </div>
          </div>
        )}
      </DragOverlay>
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
