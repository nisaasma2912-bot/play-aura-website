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
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 min-h-[80px] sm:min-h-[88px] flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          aria-label="Play Aura home"
          className="flex items-center justify-start gap-2.5 sm:gap-3 text-left whitespace-nowrap shrink-0 rounded-2xl py-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8AD8B5]"
        >
          <img
            src={LOGO_SRC}
            alt="Play Aura controller logo"
            width={1536}
            height={1024}
            decoding="async"
            fetchPriority="high"
            className="block w-[76px] h-[52px] sm:w-[100px] sm:h-[66px] object-contain object-center shrink-0 select-none"
          />
          {activeView === 'home' ? (
            <h1 className="font-display text-lg sm:text-2xl font-bold tracking-tight leading-none text-[#2B3445]">
              Play Aura
            </h1>
          ) : (
            <span className="font-display text-lg sm:text-2xl font-bold tracking-tight leading-none text-[#2B3445]">
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
