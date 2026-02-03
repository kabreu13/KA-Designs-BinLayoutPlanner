import { Button } from './ui/Button';
import { Download, User } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';

export function Header() {
  const { placements, bins, drawerWidth, drawerLength, layoutTitle, setLayoutTitle } = useLayout();

  const handleExportPdf = async () => {
    const { exportLayoutToPdf } = await import('../lib/exporters');
    return exportLayoutToPdf(drawerWidth, drawerLength, placements, bins, layoutTitle);
  };

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-900/[0.06] sticky top-0 z-50 px-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
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

      {/* Right: Actions */}
      <div className="flex items-center gap-3 justify-self-end">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Download className="h-4 w-4" />}
          onClick={handleExportPdf}
        >
          Export PDF
        </Button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <button
          title="Profile"
          className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
          <User className="h-4 w-4" />
        </button>
      </div>
    </header>
  ); 
}
