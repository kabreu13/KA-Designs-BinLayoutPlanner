import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { ChevronDown, ChevronLeft, ChevronRight, House, Package2, PanelRight } from 'lucide-react';
import { BinCatalog } from '../components/BinCatalog';
import { Canvas } from '../components/Canvas';
import { SummaryPanel } from '../components/SummaryPanel';
import { BinSizePreview } from '../components/BinSizePreview';
import { useLayout } from '../context/LayoutContext';
import type { DragItem } from '../utils/dragMath';
import styles from './Workspace.module.css';

type PanelSide = 'left' | 'right';
type MobileTab = 'catalog' | 'summary';

export function Workspace() {
  const { bins } = useLayout();
  const [isCatalogOpen, setIsCatalogOpen] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  const [activeBinId, setActiveBinId] = useState<string | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );
  const [isLandscape, setIsLandscape] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(orientation: landscape)').matches : false
  );
  const [mobileTab, setMobileTab] = useState<MobileTab>('catalog');
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [layoutResizeKey, setLayoutResizeKey] = useState(0);
  const [mobileBottomInsetPx, setMobileBottomInsetPx] = useState(100);
  const mobilePanelRef = useRef<HTMLDivElement | null>(null);
  const handleSkipToActions = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('quick-actions-focus'));
    const target = document.querySelector('[data-quick-actions-start]') as HTMLElement | null;
    if (target) {
      target.focus();
      return;
    }
    const fallback = document.querySelector('[data-testid="quick-actions-toggle"]') as HTMLElement | null;
    fallback?.focus();
  }, []);
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
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(orientation: landscape)');
    const syncOrientation = () => setIsLandscape(media.matches);
    syncOrientation();
    media.addEventListener('change', syncOrientation);
    return () => media.removeEventListener('change', syncOrientation);
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

  const mobilePanelMaxHeight = isLandscape ? '44vh' : '52vh';

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
      <a
        href="#canvas-drop-zone"
        className={styles.skipLink}
      >
        Skip to canvas
      </a>
      <a
        href="#quick-actions"
        onClick={handleSkipToActions}
        className={clsx(styles.skipLink, styles.skipLinkActions)}
      >
        Skip to quick actions
      </a>
      <div className={styles.workspaceViewport}>
        {isMobileLayout ? (
          <div className={styles.mobileRoot}>
            <Canvas
              isMobileLayout
              mobileBottomInsetPx={mobileBottomInsetPx}
              layoutResizeKey={layoutResizeKey}
            />
            <div
              ref={mobilePanelRef}
              className={styles.mobilePanelDock}
            >
              <div className={styles.mobilePanelCard}>
                <div role="tablist" aria-label="Mobile panels" className={styles.mobileTabList}>
                  <button
                    type="button"
                    data-testid="mobile-tab-catalog"
                    id="mobile-tab-catalog"
                    onClick={() => openMobilePanel('catalog')}
                    role="tab"
                    aria-selected={mobileTab === 'catalog'}
                    aria-controls="mobile-panel-content"
                    tabIndex={mobileTab === 'catalog' ? 0 : -1}
                    className={clsx(
                      styles.mobileTabButton,
                      mobileTab === 'catalog' && isMobilePanelOpen
                        ? styles.mobileTabButtonActive
                        : styles.mobileTabButtonIdle
                    )}
                  >
                    <span className={styles.mobileTabLabel}>
                      <Package2 className={styles.iconMd} />
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
                    className={clsx(
                      styles.mobileTabButton,
                      mobileTab === 'summary' && isMobilePanelOpen
                        ? styles.mobileTabButtonActive
                        : styles.mobileTabButtonIdle
                    )}
                  >
                    <span className={styles.mobileTabLabel}>
                      <PanelRight className={styles.iconMd} />
                      Summary
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="mobile-panel-toggle"
                    aria-expanded={isMobilePanelOpen}
                    aria-controls="mobile-panel-content"
                    onClick={() => setIsMobilePanelOpen((open) => !open)}
                    className={styles.mobileCanvasButton}
                  >
                    <House className={styles.iconMd} />
                    Canvas
                    <ChevronDown
                      className={clsx(
                        styles.iconMd,
                        styles.mobileChevron,
                        isMobilePanelOpen && styles.iconRotated
                      )}
                    />
                  </button>
                </div>
                <div
                  className={styles.mobilePanelBody}
                  style={{ maxHeight: isMobilePanelOpen ? mobilePanelMaxHeight : '0px' }}
                >
                  <div
                    id="mobile-panel-content"
                    role="tabpanel"
                    aria-labelledby={mobileTab === 'catalog' ? 'mobile-tab-catalog' : 'mobile-tab-summary'}
                    aria-hidden={!isMobilePanelOpen}
                    tabIndex={isMobilePanelOpen ? 0 : -1}
                    className={styles.mobilePanelContent}
                    style={{ height: mobilePanelMaxHeight }}
                  >
                    {mobileTab === 'catalog' ? <BinCatalog mobile /> : <SummaryPanel mobile />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.desktopRoot}>
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
          <div className={styles.dragOverlayCard}>
            <div className={styles.dragOverlayBody}>
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

  return (
    <div
      data-testid={`side-panel-${side}`}
      className={clsx(
        styles.sidePanel,
        isOpen ? styles.sidePanelOpen : styles.sidePanelClosed,
        !isOpen && side === 'left' && styles.sidePanelCollapsedLeft,
        !isOpen && side === 'right' && styles.sidePanelCollapsedRight
      )}
    >
      <div className={styles.sidePanelViewport}>
        <div
          id={panelId}
          className={clsx(styles.sidePanelContent, isOpen ? styles.sidePanelContentOpen : styles.sidePanelContentClosed)}
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
        className={clsx(styles.sidePanelToggle, side === 'left' ? styles.sidePanelToggleLeft : styles.sidePanelToggleRight)}
      >
        <Icon className={styles.iconMd} />
      </button>
    </div>
  );
}
