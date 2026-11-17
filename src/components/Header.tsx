import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export type ActiveView = 'home' | 'admin';

interface HeaderProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
}

export function Header({ activeView, onNavigate }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (view: ActiveView) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/92 backdrop-blur-md border-b border-[#CBE7FA]/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Play Aura Logo & Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="flex items-center gap-2.5 sm:gap-3 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8AD8B5] rounded-2xl pr-2 py-1 cursor-pointer"
        >
          <img
            src="/assets/aistudio/d83468c5-4a06-4940-911e-11eb721a66fc_ddc43c92.png"
            alt="Play Aura logo"
            className="h-10 sm:h-11 md:h-12 w-auto object-contain rounded-xl shrink-0"
          />
          <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#2B3445]">
            Play Aura
          </span>
        </button>

        {/* Zone 2: Clean Single-Line Navigation */}
        <nav className="hidden md:flex items-center gap-7 text-[15px] font-semibold text-[#5A657A]" aria-label="Primary">
          <button
            type="button"
            onClick={() => handleNav('home')}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors cursor-pointer border-b-2 ${
              activeView === 'home'
                ? 'text-[#1D6B52] border-[#8AD8B5]'
                : 'border-transparent hover:text-[#2B3445] hover:border-[#CBE7FA]'
            }`}
          >
            Games
          </button>
        </nav>

        {/* Mobile Menu Toggle */}
        <div className="flex items-center gap-2 shrink-0 md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[#FAF5E8] text-[#2B3445] hover:bg-[#DDF0FC] transition-colors cursor-pointer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Compact Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#EAE3CE] bg-[#FFFDF6] px-4 py-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleNav('home')}
            className={`w-full text-left px-4 py-2.5 rounded-2xl text-sm font-bold transition-colors ${
              activeView === 'home' ? 'bg-[#D8F3E5] text-[#1D6B52]' : 'text-[#2B3445] hover:bg-[#FAF5E8]'
            }`}
          >
            Games
          </button>
        </div>
      )}
    </header>
  );
}
