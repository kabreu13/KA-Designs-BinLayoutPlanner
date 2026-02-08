import { useMemo, useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { cva } from 'class-variance-authority';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Button } from './ui/Button';
import { Trash2, AlertCircle, ChevronDown, ChevronUp, CheckCircle, ShoppingCart } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';
import { DEFAULT_BIN_COLOR, getColorLabel, normalizeHexColor } from '../utils/colors';
import { BinSizePreview } from './BinSizePreview';
import { buildEtsyCartUrl } from '../lib/etsy';
import styles from './SummaryPanel.module.css';

const panelRootClassName = cva(styles.panelRoot, {
  variants: {
    mobile: {
      true: styles.panelRootMobile,
      false: styles.panelRootDesktop
    }
  }
});

const sectionHeaderClassName = cva(styles.header, {
  variants: {
    mobile: {
      true: styles.headerMobile,
      false: styles.headerDesktop
    }
  }
});

const drawerGridClassName = cva(styles.drawerGrid, {
  variants: {
    mobile: {
      true: styles.drawerGridMobile,
      false: styles.drawerGridDesktop
    }
  }
});

const fieldInputClassName = cva(styles.fieldInput, {
  variants: {
    mobile: {
      true: styles.fieldInputMobile,
      false: styles.fieldInputDesktop
    }
  }
});

const listClassName = cva(styles.list, {
  variants: {
    mobile: {
      true: styles.listMobile,
      false: styles.listDesktop
    }
  }
});

const deleteButtonClassName = cva(styles.deleteButton, {
  variants: {
    mobile: {
      true: styles.deleteButtonMobile,
      false: styles.deleteButtonDesktop
    }
  }
});

const footerClassName = cva(styles.footer, {
  variants: {
    mobile: {
      true: styles.footerMobile,
      false: styles.footerDesktop
    }
  }
});

const actionsGridClassName = cva(styles.actionsGrid, {
  variants: {
    mobile: {
      true: styles.actionsGridMobile,
      false: styles.actionsGridDesktop
    }
  }
});

const actionButtonClassName = cva(styles.actionButton, {
  variants: {
    mobile: {
      true: styles.actionButtonMobile,
      false: styles.actionButtonDesktop
    }
  }
});

const etsyButtonClassName = cva(styles.etsyButton, {
  variants: {
    mobile: {
      true: styles.etsyButtonMobile,
      false: styles.etsyButtonDesktop
    }
  }
});

const statusClassName = cva(styles.status, {
  variants: {
    kind: {
      info: styles.statusInfo,
      error: styles.statusError
    }
  }
});

export function SummaryPanel({ mobile = false }: { mobile?: boolean }) {
  const {
    placements,
    bins,
    layoutTitle,
    drawerWidth,
    drawerLength,
    setDrawerSize,
    removePlacements,
    openPlacementEditor,
    spaceUsedPercent,
    exportState
  } = useLayout();

  const drawerArea = drawerWidth * drawerLength;
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [isDrawerSettingsOpen, setIsDrawerSettingsOpen] = useState(true);
  const [drawerInputError, setDrawerInputError] = useState<{ width?: string; length?: string }>({});
  const [resizeWarning, setResizeWarning] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);
  const [drawerLengthDraft, setDrawerLengthDraft] = useState(String(drawerLength));
  const [drawerWidthDraft, setDrawerWidthDraft] = useState(String(drawerWidth));
  const hasMountedRef = useRef(false);
  const drawerLengthInputRef = useRef<HTMLInputElement | null>(null);
  const drawerWidthInputRef = useRef<HTMLInputElement | null>(null);

  const MIN_DRAWER_DIMENSION = 0.25;
  const MAX_DRAWER_DIMENSION = 200;
  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => setStatus(null), 2500);
    return () => window.clearTimeout(id);
  }, [status]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    setSavedHint(true);
    const id = window.setTimeout(() => setSavedHint(false), 1800);
    return () => window.clearTimeout(id);
  }, [layoutTitle, drawerWidth, drawerLength, placements]);

  useEffect(() => {
    if (!resizeWarning) return;
    const id = window.setTimeout(() => setResizeWarning(null), 4000);
    return () => window.clearTimeout(id);
  }, [resizeWarning]);

  useEffect(() => {
    if (!mobile) {
      setIsDrawerSettingsOpen(true);
    }
  }, [mobile]);

  useEffect(() => {
    if (typeof document !== 'undefined' && document.activeElement === drawerLengthInputRef.current) return;
    setDrawerLengthDraft(String(drawerLength));
  }, [drawerLength]);

  useEffect(() => {
    if (typeof document !== 'undefined' && document.activeElement === drawerWidthInputRef.current) return;
    setDrawerWidthDraft(String(drawerWidth));
  }, [drawerWidth]);

  const uniquePlacements = useMemo(() => {
    const seen = new Map<string, typeof placements[number]>();
    placements.forEach((placement) => {
      if (!seen.has(placement.id)) {
        seen.set(placement.id, placement);
      }
    });
    return Array.from(seen.values());
  }, [placements]);

  const placementGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        placements: typeof placements;
        width: number;
        length: number;
        color: string;
      }
    >();

    uniquePlacements.forEach((placement) => {
      const bin = bins.find((b) => b.id === placement.binId);
      const width = placement.width ?? bin?.width;
      const length = placement.length ?? bin?.length;
      if (width == null || length == null) return;
      const color = normalizeHexColor(placement.color ?? DEFAULT_BIN_COLOR);
      const key = `${width}x${length}-${color}`;
      const existing = groups.get(key);
      if (existing) {
        existing.placements.push(placement);
      } else {
        groups.set(key, {
          placements: [placement],
          width,
          length,
          color
        });
      }
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        label: `${group.width}x${group.length} Bin`
      }))
      .sort((a, b) => b.placements.length - a.placements.length);
  }, [uniquePlacements, bins]);

  const hasEmptyPlacements = placementGroups.length === 0;

  const invalidCount = useMemo(() => {
    const invalid = new Set<string>();
    const sized = uniquePlacements
      .map((placement) => {
        const bin = bins.find((b) => b.id === placement.binId);
        const width = placement.width ?? bin?.width;
        const length = placement.length ?? bin?.length;
        if (width == null || length == null) return null;
        return { placement, width, length };
      })
      .filter(Boolean) as Array<{ placement: typeof placements[number]; width: number; length: number }>;

    sized.forEach(({ placement, width, length }) => {
      if (
        placement.x < 0 ||
        placement.y < 0 ||
        placement.x + width > drawerWidth ||
        placement.y + length > drawerLength
      ) {
        invalid.add(placement.id);
      }
    });

    for (let i = 0; i < sized.length; i += 1) {
      for (let j = i + 1; j < sized.length; j += 1) {
        const a = sized[i];
        const b = sized[j];
        const overlap =
          a.placement.x < b.placement.x + b.width &&
          a.placement.x + a.width > b.placement.x &&
          a.placement.y < b.placement.y + b.length &&
          a.placement.y + a.length > b.placement.y;
        if (overlap) {
          invalid.add(a.placement.id);
          invalid.add(b.placement.id);
        }
      }
    }

    return invalid.size;
  }, [uniquePlacements, bins, drawerWidth, drawerLength]);

  const wouldInvalidateDrawerSize = (nextWidth: number, nextLength: number) => {
    return placements.some((placement) => {
      const bin = bins.find((b) => b.id === placement.binId);
      const width = placement.width ?? bin?.width;
      const length = placement.length ?? bin?.length;
      if (width == null || length == null) return false;
      return placement.x + width > nextWidth || placement.y + length > nextLength;
    });
  };

  const applyDrawerSize = (nextWidth: number, nextLength: number) => {
    if (placements.length > 0 && wouldInvalidateDrawerSize(nextWidth, nextLength)) {
      const warning = 'Resize would clip bins. Move or remove bins first.';
      setResizeWarning(warning);
      setStatus({ kind: 'error', text: warning });
      return false;
    }
    setDrawerSize(nextWidth, nextLength);
    setResizeWarning(null);
    return true;
  };

  const validateDrawerInput = (raw: string, axis: 'width' | 'length') => {
    if (raw.trim() === '') {
      setDrawerInputError((prev) => ({ ...prev, [axis]: 'Enter a value.' }));
      return null;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      setDrawerInputError((prev) => ({ ...prev, [axis]: 'Enter a number.' }));
      return null;
    }
    if (value < MIN_DRAWER_DIMENSION || value > MAX_DRAWER_DIMENSION) {
      setDrawerInputError((prev) => ({
        ...prev,
        [axis]: `Must be between ${MIN_DRAWER_DIMENSION} and ${MAX_DRAWER_DIMENSION} in.`
      }));
      return null;
    }
    setDrawerInputError((prev) => ({ ...prev, [axis]: undefined }));
    return value;
  };

  const commitDrawerLength = () => {
    const nextLength = validateDrawerInput(drawerLengthDraft, 'length');
    if (nextLength == null) return;
    const applied = applyDrawerSize(drawerWidth, nextLength);
    if (!applied) {
      setDrawerLengthDraft(String(drawerLength));
      return;
    }
    setDrawerLengthDraft(String(nextLength));
  };

  const commitDrawerWidth = () => {
    const nextWidth = validateDrawerInput(drawerWidthDraft, 'width');
    if (nextWidth == null) return;
    const applied = applyDrawerSize(nextWidth, drawerLength);
    if (!applied) {
      setDrawerWidthDraft(String(drawerWidth));
      return;
    }
    setDrawerWidthDraft(String(nextWidth));
  };

  const etsyCartItems = useMemo(
    () =>
      placementGroups.map((group) => ({
        sku: buildPlacedItemSku(group.width, group.length, group.color),
        quantity: group.placements.length
      })),
    [placementGroups]
  );

  const exportPdf = async () => {
    const { exportLayoutToPdf } = await import('../lib/exporters');
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data?: ShareData) => boolean;
    };

    if (import.meta.env.DEV && typeof window !== 'undefined' && (window as Window & { __forceExportPdfError?: boolean }).__forceExportPdfError) {
      setStatus({ kind: 'error', text: 'Failed to export PDF' });
      return;
    }

    if (mobile && nav.share) {
      try {
        const pdfBlob = await exportLayoutToPdf(drawerWidth, drawerLength, placements, bins, layoutTitle, {
          mode: 'blob'
        });
        if (pdfBlob instanceof Blob) {
          const file = new File([pdfBlob], 'bin-layout.pdf', { type: 'application/pdf' });
          const sharePayload: ShareData = {
            title: layoutTitle || 'Bin Layout',
            text: 'Bin layout export',
            files: [file]
          };
          if (!nav.canShare || nav.canShare(sharePayload)) {
            await nav.share(sharePayload);
            setStatus({ kind: 'info', text: 'Share sheet opened' });
            return;
          }
        }
      } catch {
        // Continue with fallback download.
      }
    }

    try {
      await exportLayoutToPdf(drawerWidth, drawerLength, placements, bins, layoutTitle);
      if (mobile) {
        setStatus({ kind: 'info', text: 'PDF downloaded' });
      }
    } catch {
      setStatus({ kind: 'error', text: 'Failed to export PDF' });
    }
  };

  const copyShareLink = async () => {
    try {
      const state = exportState();
      const encoded = encodeURIComponent(btoa(JSON.stringify(state)));
      const link = `${window.location.origin}${window.location.pathname}?layout=${encoded}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const ta = document.createElement('textarea');
        ta.value = link;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setStatus({ kind: 'info', text: 'Share link copied' });
    } catch {
      setStatus({ kind: 'error', text: 'Failed to copy share link' });
    }
  };

  const openCatalogTab = () => {
    if (!mobile || typeof document === 'undefined') return;
    const tab = document.querySelector('[data-testid="mobile-tab-catalog"]') as HTMLButtonElement | null;
    tab?.click();
  };

  const openCatalogPanel = () => {
    if (mobile || typeof document === 'undefined') return;
    const expandButton = document.querySelector(
      'button[aria-label="Expand Bin catalog"]'
    ) as HTMLButtonElement | null;
    expandButton?.click();
    const panel = document.getElementById('bin-catalog-panel');
    panel?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCatalog = () => {
    if (mobile) {
      openCatalogTab();
      return;
    }
    openCatalogPanel();
  };

  return (
    <div className={panelRootClassName({ mobile })}>
      <div className={sectionHeaderClassName({ mobile })}>
        {mobile && hasEmptyPlacements && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenCatalog}
            className={styles.catalogCta}
          >
            Add bins from Catalog
          </Button>
        )}
        {mobile ? (
          <button
            type="button"
            data-testid="drawer-settings-toggle"
            aria-expanded={isDrawerSettingsOpen}
            onClick={() => setIsDrawerSettingsOpen((open) => !open)}
            className={styles.drawerToggle}
          >
            <h2 className={styles.sectionTitle}>Drawer Settings</h2>
            {isDrawerSettingsOpen ? (
              <ChevronUp className={styles.toggleIcon} />
            ) : (
              <ChevronDown className={styles.toggleIcon} />
            )}
          </button>
        ) : (
          <h2 className={styles.sectionTitle}>
            Drawer Settings
          </h2>
        )}

        {(!mobile || isDrawerSettingsOpen) && (
          <div className={styles.settingsSection}>
            <div className={drawerGridClassName({ mobile })}>
              <div>
                <label className={styles.fieldLabel}>Length (in)</label>
                <input
                  ref={drawerLengthInputRef}
                  type="number"
                  min={MIN_DRAWER_DIMENSION}
                  step={0.25}
                  aria-label="Drawer length"
                  data-testid="drawer-length-input"
                  value={drawerLengthDraft}
                  aria-invalid={Boolean(drawerInputError.length)}
                  aria-describedby={drawerInputError.length ? 'drawer-length-error' : undefined}
                  onChange={(e) => {
                    setDrawerLengthDraft(e.target.value);
                    setDrawerInputError((prev) => ({ ...prev, length: undefined }));
                  }}
                  onBlur={commitDrawerLength}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    commitDrawerLength();
                    e.currentTarget.blur();
                  }}
                  className={fieldInputClassName({ mobile })}
                />
                {drawerInputError.length && (
                  <p id="drawer-length-error" className={styles.fieldError}>
                    {drawerInputError.length}
                  </p>
                )}
              </div>
              <div>
                <label className={styles.fieldLabel}>Width (in)</label>
                <input
                  ref={drawerWidthInputRef}
                  type="number"
                  min={MIN_DRAWER_DIMENSION}
                  step={0.25}
                  aria-label="Drawer width"
                  data-testid="drawer-width-input"
                  value={drawerWidthDraft}
                  aria-invalid={Boolean(drawerInputError.width)}
                  aria-describedby={drawerInputError.width ? 'drawer-width-error' : undefined}
                  onChange={(e) => {
                    setDrawerWidthDraft(e.target.value);
                    setDrawerInputError((prev) => ({ ...prev, width: undefined }));
                  }}
                  onBlur={commitDrawerWidth}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    commitDrawerWidth();
                    e.currentTarget.blur();
                  }}
                  className={fieldInputClassName({ mobile })}
                />
                {drawerInputError.width && (
                  <p id="drawer-width-error" className={styles.fieldError}>
                    {drawerInputError.width}
                  </p>
                )}
              </div>
            </div>

            <div className={styles.statsSection}>
              <div className={styles.statsRow}>
                <span className={styles.statsLabel}>Space Used</span>
                <span className={styles.statsValue}>{spaceUsedPercent.toFixed(0)}%</span>
              </div>
              <div className={styles.progressTrack} data-testid="space-used-bar">
                <div
                  className={styles.progressFill}
                  data-testid="space-used-bar-fill"
                  style={{ width: `${spaceUsedPercent}%` }}
                />
              </div>
              <p className={styles.statsMeta}>
                <AlertCircle className={styles.iconSm} />
                {uniquePlacements.length} bins placed · Drawer area {drawerArea.toFixed(0)} in²
              </p>
              <p
                className={clsx(
                  styles.statsHealth,
                  invalidCount === 0 ? styles.statsHealthGood : styles.statsHealthWarn
                )}
              >
                <AlertCircle className={styles.iconSm} />
                {invalidCount === 0
                  ? 'All bins safely placed.'
                  : `${invalidCount} bin${invalidCount === 1 ? '' : 's'} need attention.`}
              </p>
              {resizeWarning && (
                <div
                  role="alert"
                  className={styles.resizeWarning}
                >
                  <AlertCircle className={styles.iconSm} />
                  {resizeWarning}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={clsx(listClassName({ mobile }), mobile && styles.listHideScrollbar)}>
        <h3 className={styles.placedTitle}>
          Placed Items
        </h3>
        <div className={styles.groups}>
          {hasEmptyPlacements && (
            <div className={styles.emptyState}>
              <p>No bins placed yet.</p>
              {!mobile && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenCatalog}
                  className={styles.desktopCatalogButton}
                >
                  Add bins from Catalog
                </Button>
              )}
            </div>
          )}
          {placementGroups.map((group) => {
            return (
              <div
                key={`${group.label}-${group.width}-${group.length}-${group.color}`}
                className={styles.groupRow}
              >
                <button
                  type="button"
                  data-testid="placed-item-group"
                  aria-label={`Edit ${group.label} group`}
                  className={styles.groupButton}
                  onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const keyboardActivated = event.detail === 0;
                    const x = keyboardActivated ? rect.right : event.clientX;
                    const y = keyboardActivated ? rect.top + rect.height / 2 : event.clientY;
                    openPlacementEditor(
                      group.placements.map((placement) => placement.id),
                      x,
                      y
                    );
                  }}
                >
                  <div className={styles.groupPreviewWrap}>
                    <BinSizePreview
                      dataTestId="placed-item-preview"
                      width={group.width}
                      length={group.length}
                      color={group.color}
                      size="compact"
                    />
                  </div>
                  <div>
                    <p className={styles.groupSku}>
                      {buildPlacedItemSku(group.width, group.length, group.color)}
                    </p>
                    <p className={styles.groupMeta}>
                      Color: {getColorLabel(group.color)} · Amount: {group.placements.length}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  data-testid="placed-item-delete-button"
                  aria-label={`Delete ${group.placements.length} bin${group.placements.length === 1 ? '' : 's'}`}
                  title="Delete group"
                  className={deleteButtonClassName({ mobile })}
                  onClick={(event) => {
                    event.stopPropagation();
                    removePlacements(group.placements.map((placement) => placement.id));
                    setStatus({
                      kind: 'info',
                      text: `Removed ${group.placements.length} bin${group.placements.length === 1 ? '' : 's'}`
                    });
                  }}
                >
                  <Trash2 className={styles.deleteIcon} />
                  <span className={styles.deleteLabel}>
                    Delete All
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className={footerClassName({ mobile })}>
        {savedHint && (
          <div className={styles.savedHint}>
            <CheckCircle className={styles.iconSm} />
            Saved
          </div>
        )}
        <div className={actionsGridClassName({ mobile })}>
          <Button
            variant="secondary"
            size="sm"
            className={actionButtonClassName({ mobile })}
            onClick={exportPdf}
          >
            {mobile ? 'Share PDF' : 'Export PDF'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className={actionButtonClassName({ mobile })}
            onClick={copyShareLink}
          >
            Copy Share Link
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className={etsyButtonClassName({ mobile })}
            onClick={() => {
              const cart = buildEtsyCartUrl(etsyCartItems);
              if (cart.missingListingId) {
                setStatus({ kind: 'error', text: 'Set ETSY_LISTING_ID in src/config/etsy.ts' });
                return;
              }
              if (cart.missingSkus.length > 0) {
                setStatus({
                  kind: 'error',
                  text:
                    cart.missingSkus.length === 1
                      ? `Missing Etsy variation mapping for ${cart.missingSkus[0]}`
                      : `Missing Etsy variation mappings for ${cart.missingSkus.length} SKUs`
                });
                return;
              }
              if (!cart.url) {
                setStatus({ kind: 'error', text: 'No items to build Etsy cart link' });
                return;
              }
              window.open(cart.url, '_blank', 'noopener,noreferrer');
              setStatus({ kind: 'info', text: 'Opened Etsy cart link' });
            }}
            disabled={etsyCartItems.length === 0}
            leftIcon={<ShoppingCart className={styles.etsyIcon} />}
          >
            Open Etsy Cart
          </Button>
        </div>

        {status && (
          <div
            role={status.kind === 'error' ? 'alert' : 'status'}
            aria-live={status.kind === 'error' ? 'assertive' : 'polite'}
            className={statusClassName({ kind: status.kind })}
          >
            {status.text}
          </div>
        )}
      </div>
    </div>
  );
}

function buildPlacedItemSku(width: number, length: number, color: string) {
  const normalized = normalizeHexColor(color);
  const colorLabel = getColorLabel(normalized);
  if (colorLabel === 'Custom') {
    return `REG-BIN-${length}x${width}-Custom-${normalized}`;
  }
  return `REG-BIN-${length}x${width}-${colorLabel.replace(/\s+/g, '')}`;
}
