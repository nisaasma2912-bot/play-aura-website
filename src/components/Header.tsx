import type { ActiveView } from '../types/game';
import { FloatingSocialButtons } from './FloatingSocialButtons';

export type { ActiveView };

const LOGO_SRC = '/assets/aistudio/5bc4cd61-25ef-4236-a8bc-50f736f5221a_ba0fcba2.png';

interface HeaderProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  onOpenSuggestion: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
}

export function Header({
  activeView,
  onNavigate,
  onOpenSuggestion,
  onOpenNotifications,
  unreadNotificationsCount,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-[#CBE7FA]/80">
      <div className="max-w-7xl mx-auto w-full px-1 sm:px-8 min-h-[60px] sm:min-h-[88px] flex items-center justify-between gap-0.5 sm:gap-4">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          aria-label="Play Aura home"
          className="flex min-w-0 items-center justify-start gap-1 sm:gap-3 text-left whitespace-nowrap shrink rounded-2xl py-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8AD8B5]"
        >
          <img
            src={LOGO_SRC}
            alt="Play Aura controller logo"
            decoding="async"
            fetchPriority="high"
            className="block h-8 sm:h-[66px] w-auto max-w-[48px] sm:max-w-[124px] object-contain object-center shrink-0 select-none"
          />
          {activeView === 'home' ? (
            <h1 className="font-display text-xs sm:text-2xl font-bold tracking-tight leading-none text-[#2B3445]">
              Play Aura
            </h1>
          ) : (
            <span className="font-display text-sm sm:text-2xl font-bold tracking-tight leading-none text-[#2B3445]">
              Play Aura
            </span>
          )}
        </button>

        {activeView !== 'admin' && (
          <div className="flex items-center justify-end shrink-0">
            <FloatingSocialButtons
              onOpenSuggestion={onOpenSuggestion}
              onOpenNotifications={onOpenNotifications}
              unreadNotificationsCount={unreadNotificationsCount}
            />
          </div>
        )}
      </div>
    </header>
  );
}
