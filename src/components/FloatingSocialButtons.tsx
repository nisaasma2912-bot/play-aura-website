import { playButtonClickSound } from '../lib/sound';

export const NOTIFICATION_BELL_CUSTOM_ICON_SRC =
  '/assets/aistudio/play-aura-notification-bell.png';

export const SUGGESTION_CUSTOM_ICON_SRC =
  '/assets/aistudio/2f3821fe-f339-4ffd-84ea-fa1eedd5c8b0_54d97b59.png';

export const YOUTUBE_CUSTOM_ICON_SRC =
  '/assets/aistudio/9616ce5f-0727-4be2-b2d5-3b0cb9219667_8faa4d56.png';

export const YOUTUBE_CHANNEL_URL =
  'https://youtube.com/@playauras?si=ilsh6c_XOeMAOd4A';

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

  const bellAriaLabel = hasUnreadNotifications
    ? 'Notifications (unread)'
    : 'Notifications';

  const buttonClass =
    'relative inline-flex items-center justify-center w-7 h-7 sm:w-14 sm:h-14 shrink-0 rounded-lg sm:rounded-xl hover:scale-105 active:scale-95 transition-transform duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#8AD8B5]';

  const imageClass =
    'block w-7 h-7 sm:w-12 sm:h-12 object-contain object-center shrink-0 select-none';

  return (
    <div
      aria-label="Community actions"
      className="flex items-center justify-end gap-0 sm:gap-3 shrink-0"
    >
      {/* Notification Bell */}
      <button
        type="button"
        onClick={handleNotificationsClick}
        aria-label={bellAriaLabel}
        title={bellAriaLabel}
        className={buttonClass}
      >
        <img
          src={NOTIFICATION_BELL_CUSTOM_ICON_SRC}
          alt=""
          width={1080}
          height={1057}
          decoding="async"
          className="block w-6 h-6 sm:w-10 sm:h-10 object-contain object-center shrink-0 select-none"
        />

        {hasUnreadNotifications && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#EF4444] ring-2 ring-white shadow-sm pointer-events-none"
          />
        )}
      </button>

      {/* Game Suggestion */}
      <button
        type="button"
        onClick={handleSuggestionClick}
        aria-label="Suggest a game"
        title="Suggest a game"
        className={buttonClass}
      >
        <img
          src={SUGGESTION_CUSTOM_ICON_SRC}
          alt=""
          width={1293}
          height={1217}
          decoding="async"
          className={imageClass}
        />
      </button>

      {/* YouTube */}
      <a
        href={YOUTUBE_CHANNEL_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Visit Play Aura on YouTube"
        title="Visit Play Aura on YouTube"
        className={buttonClass}
      >
        <img
          src={YOUTUBE_CUSTOM_ICON_SRC}
          alt=""
          width={1536}
          height={1024}
          decoding="async"
          className="block w-6 h-6 sm:w-[52px] sm:h-[52px] object-contain object-center shrink-0 select-none"
        />
      </a>
    </div>
  );
}
