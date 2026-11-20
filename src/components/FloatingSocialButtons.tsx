
import { playButtonClickSound } from '../lib/sound';

export const SUGGESTION_CUSTOM_ICON_SRC =
  '/assets/aistudio/2f3821fe-f339-4ffd-84ea-fa1eedd5c8b0_54d97b59.png';

export const YOUTUBE_CUSTOM_ICON_SRC =
  '/assets/aistudio/9616ce5f-0727-4be2-b2d5-3b0cb9219667_8faa4d56.png';

export const YOUTUBE_CHANNEL_URL =
  'https://youtube.com/@playauras?si=ilsh6c_XOeMAOd4A';

interface FloatingSocialButtonsProps {
  onOpenSuggestion: () => void;
}

export function FloatingSocialButtons({
  onOpenSuggestion,
}: FloatingSocialButtonsProps) {
  const handleSuggestionClick = () => {
    playButtonClickSound();
    onOpenSuggestion();
  };

  return (
    <div
      aria-label="Community actions"
      className="flex flex-col items-center gap-1 shrink-0"
    >
      <button
        type="button"
        onClick={handleSuggestionClick}
        aria-label="Suggest a game"
        title="Suggest a game"
        className="inline-flex items-center justify-center rounded-xl p-0.5 min-w-[48px] min-h-[48px] hover:scale-105 active:scale-95 transition-transform duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8AD8B5]"
      >
        <img
          src={SUGGESTION_CUSTOM_ICON_SRC}
          alt="Suggest a game"
          width={1293}
          height={1217}
          decoding="async"
          className="w-12 h-12 sm:w-[54px] sm:h-[54px] object-contain drop-shadow-[0_4px_8px_rgba(30,91,138,0.18)] select-none"
        />
      </button>

      <a
        href={YOUTUBE_CHANNEL_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Visit Play Aura on YouTube"
        title="Visit Play Aura on YouTube"
        className="inline-flex items-center justify-center rounded-xl p-0.5 min-w-[48px] min-h-[44px] hover:scale-105 active:scale-95 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8AC5F0]"
      >
        <img
          src={YOUTUBE_CUSTOM_ICON_SRC}
          alt="Visit Play Aura on YouTube"
          width={1536}
          height={1024}
          decoding="async"
          className="w-[60px] h-[40px] sm:w-[69px] sm:h-[46px] object-contain drop-shadow-[0_4px_8px_rgba(30,91,138,0.18)] select-none"
        />
      </a>
    </div>
  );
}
