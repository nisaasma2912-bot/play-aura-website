import type { ActiveView } from '../types/game';
import { FloatingSocialButtons } from './FloatingSocialButtons';

export type { ActiveView };

const LOGO_SRC = '/assets/aistudio/5bc4cd61-25ef-4236-a8bc-50f736f5221a_ba0fcba2.png';

interface HeaderProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  onOpenSuggestion: () => void;
}

export function Header({ activeView, onNavigate, onOpenSuggestion }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/92 backdrop-blur-md border-b border-[#CBE7FA]/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-3 sm:gap-8">
        {/* Zone 1: Play Aura Transparent Controller Logo & Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 sm:gap-3 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8AD8B5] rounded-2xl pr-1 sm:pr-2 py-1 cursor-pointer"
        >
          <img
            src={LOGO_SRC}
            alt="Play Aura logo"
            width={1536}
            height={1024}
            decoding="async"
            className="h-10 sm:h-12 md:h-14 w-auto object-contain shrink-0 select-none"
          />
          {activeView === 'home' ? (
            <h1 className="font-display text-lg sm:text-2xl font-bold tracking-tight text-[#2B3445]">
              Play Aura
            </h1>
          ) : (
            <span className="font-display text-lg sm:text-2xl font-bold tracking-tight text-[#2B3445]">
              Play Aura
            </span>
          )}
        </button>

        {/* Zone 2: Side-by-side Suggestion & YouTube icons */}
        {activeView !== 'admin' && (
          <div className="flex items-center shrink-0">
            <FloatingSocialButtons onOpenSuggestion={onOpenSuggestion} />
          </div>
        )}
      </div>
    </header>
  );
}
