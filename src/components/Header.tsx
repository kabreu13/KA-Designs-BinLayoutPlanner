import { useLayout } from '../context/LayoutContext';
import { CircleHelp } from 'lucide-react';
import { OPEN_HOW_TO_EVENT } from '../lib/uiEvents';

export function Header() {
  const { layoutTitle, setLayoutTitle } = useLayout();
  const openHowTo = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(OPEN_HOW_TO_EVENT));
  };

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-900/[0.06] sticky top-0 z-50">
      <div className="px-3 py-2 sm:h-16 sm:px-6 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4">
        <div className="flex items-center gap-3 cursor-default group sm:col-start-1 min-w-0">
          <img
            src="/ka-logo.png"
            alt="KA Designs logo"
            className="h-7 sm:h-8 w-auto object-contain"
          />
          <span className="font-semibold text-base sm:text-lg tracking-tight text-[#0B0B0C] group-hover:text-[#14476B] transition-colors">
            Bin Layout Planner
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 sm:col-start-2">
          <input
            data-testid="layout-title-input"
            type="text"
            value={layoutTitle}
            onChange={(event) => setLayoutTitle(event.target.value)}
            placeholder="Layout Title"
            maxLength={80}
            className="w-full h-10 sm:h-9 bg-white border border-slate-900/[0.08] rounded-lg px-3 text-sm text-left sm:text-center text-[#0B0B0C] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#14476B]/15 focus:border-[#14476B] sm:w-[min(52vw,420px)]"
            aria-label="Layout title"
          />
        </div>

        <div className="sm:col-start-3 justify-self-end">
          <button
            type="button"
            data-testid="header-how-to-button"
            onClick={openHowTo}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#14476B] shadow-sm transition hover:border-[#14476B]/35 hover:bg-[#14476B]/5 focus:outline-none focus:ring-2 focus:ring-[#14476B]/25"
          >
            <CircleHelp className="h-4 w-4" />
            How To
          </button>
        </div>
      </div>
    </header>
  );
}
