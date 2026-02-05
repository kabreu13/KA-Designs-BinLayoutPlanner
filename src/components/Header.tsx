import { useLayout } from '../context/LayoutContext';

export function Header() {
  const { layoutTitle, setLayoutTitle } = useLayout();

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-900/[0.06] sticky top-0 z-50">
      <div className="sm:hidden px-3 py-2 space-y-2">
        <div className="flex items-center gap-3 cursor-default group">
          <img
            src="/ka-logo.png"
            alt="KA Logo"
            className="h-7 w-auto object-contain"
          />
          <span className="font-semibold text-base tracking-tight text-[#0B0B0C] group-hover:text-[#14476B] transition-colors">
            BinPicker
          </span>
        </div>
        <input
          type="text"
          value={layoutTitle}
          onChange={(event) => setLayoutTitle(event.target.value)}
          placeholder="Layout Title"
          maxLength={80}
          className="w-full h-10 bg-white border border-slate-900/[0.08] rounded-lg px-3 text-sm text-left text-[#0B0B0C] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#14476B]/15 focus:border-[#14476B]"
          aria-label="Layout title"
        />
      </div>

      <div className="hidden sm:grid h-16 px-6 grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-3 cursor-default group">
          <img
            src="/ka-logo.png"
            alt="KA Logo"
            className="h-8 w-auto object-contain"
          />
          <span className="font-semibold text-lg tracking-tight text-[#0B0B0C] group-hover:text-[#14476B] transition-colors">
            BinPicker
          </span>
        </div>

        {/* Center: Layout title */}
        <div className="w-[min(52vw,420px)]">
          <input
            type="text"
            value={layoutTitle}
            onChange={(event) => setLayoutTitle(event.target.value)}
            placeholder="Layout Title"
            maxLength={80}
            className="w-full h-9 bg-white border border-slate-900/[0.08] rounded-lg px-3 text-sm text-center text-[#0B0B0C] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#14476B]/15 focus:border-[#14476B]"
            aria-label="Layout title"
          />
        </div>

        <div />
      </div>
    </header>
  );
}
