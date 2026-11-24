import { playButtonClickSound } from '../lib/sound';

export const NOTIFICATION_BELL_CUSTOM_ICON_SRC =
  '/assets/aistudio/play-aura-notification-bell.png';
export const SUGGESTION_CUSTOM_ICON_SRC =
  '/assets/aistudio/2f3821fe-f339-4ffd-84ea-fa1eedd5c8b0_54d97b59.png';
export const YOUTUBE_CUSTOM_ICON_SRC =
  '/assets/aistudio/9616ce5f-0727-4be2-b2d5-3b0cb9219667_8faa4d56.png';
export const YOUTUBE_CHANNEL_URL = 'https://youtube.com/@playauras?si=ilsh6c_XOeMAOd4A';

interface FloatingSocialButtonsProps {
  onOpenSuggestion: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
}

export function FloatingSocialButtons({
  onOpenSuggestion,
  onOpenNotifications,
  unreadNotificationsCount,
}: FloatingSocialButtonsProps) {
  const handleSuggestionClick = () => {
    playButtonClickSound();
    onOpenSuggestion();
  };

  const handleNotificationsClick = () => {
    playButtonClickSound();
    onOpenNotifications();
  };

  const hasUnreadNotifications = unreadNotificationsCount > 0;
  const bellAriaLabel = hasUnreadNotifications ? 'Notifications (unread)' : 'Notifications';

  return (
    <div
      aria-label="Community actions"
      className="flex items-center gap-1.5 sm:gap-2.5 shrink-0"
    >
      {/* Notification Bell Button: transparent 3D golden bell + plain red unread dot */}
      <button
        type="button"
        onClick={handleNotificationsClick}
        aria-label={bellAriaLabel}
        title={bellAriaLabel}
        className="relative inline-flex items-center justify-center rounded-xl p-1 min-w-[44px] min-h-[44px] hover:scale-105 active:scale-95 transition-transform duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#8AD8B5]"
      >
        <img
          src={NOTIFICATION_BELL_CUSTOM_ICON_SRC}
          alt="Notifications"
          width={1311}
          height={1200}
          decoding="async"
          className="w-9 h-9 sm:w-10 sm:h-10 object-contain drop-shadow-[0_4px_8px_rgba(30,91,138,0.18)] select-none"
        />
        {hasUnreadNotifications && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#EF4444] ring-2 ring-white shadow-sm pointer-events-none"
          />
        )}
      </button>

      {/* Button A: Custom Glossy Suggestion Icon (no text label) */}
      <button
        type="button"
        onClick={handleSuggestionClick}
        aria-label="Suggest a game"
        title="Suggest a game"
        className="inline-flex items-center justify-center rounded-xl p-0.5 min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] hover:scale-105 active:scale-95 transition-transform duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#8AD8B5]"
      >
        <img
          src={SUGGESTION_CUSTOM_ICON_SRC}
          alt="Suggest a game"
          width={1293}
          height={1217}
          decoding="async"
          className="w-11 h-11 sm:w-[54px] sm:h-[54px] object-contain drop-shadow-[0_4px_8px_rgba(30,91,138,0.18)] select-none"
        />
      </button>

      {/* Button B: Custom Blue Glossy Play-button PNG -> YouTube Channel */}
      <a
        href={YOUTUBE_CHANNEL_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Visit Play Aura on YouTube"
        title="Visit Play Aura on YouTube"
        className="inline-flex items-center justify-center rounded-xl p-0.5 min-w-[44px] min-h-[44px] sm:min-w-[48px] hover:scale-105 active:scale-95 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#8AC5F0]"
      >
        <img
          src={YOUTUBE_CUSTOM_ICON_SRC}
          alt="Visit Play Aura on YouTube"
          width={1536}
          height={1024}
          decoding="async"
          className="w-[54px] h-[36px] sm:w-[69px] sm:h-[46px] object-contain drop-shadow-[0_4px_8px_rgba(30,91,138,0.18)] select-none"
        />
      </a>
    </div>
  );
}
