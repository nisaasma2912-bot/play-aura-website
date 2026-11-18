import { Play } from 'lucide-react';
import type { GameRecord } from '../types/game';
import { GameThumbnail } from './GameThumbnail';

interface GameCardProps {
  game: GameRecord;
  index: number;
  onPlay: (game: GameRecord) => void;
}

const ACCENT_CYCLE = [
  {
    cardBorder: 'border-[#D8F3E5] hover:border-[#8AD8B5]',
    playBg: 'bg-[#BFEAD6] hover:bg-[#A9E0C6] text-[#1D6B52]',
    fallbackBg: 'from-[#D8F3E5] to-[#DDF0FC]',
  },
  {
    cardBorder: 'border-[#EAE5FA] hover:border-[#B5A5EA]',
    playBg: 'bg-[#DFD7F8] hover:bg-[#CFC4F5] text-[#4B3D8F]',
    fallbackBg: 'from-[#EAE5FA] to-[#FFFDF6]',
  },
  {
    cardBorder: 'border-[#DDF0FC] hover:border-[#8AC5F0]',
    playBg: 'bg-[#CBE7FA] hover:bg-[#B4DCFA] text-[#1E5B8A]',
    fallbackBg: 'from-[#DDF0FC] to-[#D8F3E5]',
  },
];

export function GameCard({ game, index, onPlay }: GameCardProps) {
  const theme = ACCENT_CYCLE[index % ACCENT_CYCLE.length];

  return (
    <article
      onClick={() => onPlay(game)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlay(game);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Play ${game.title}`}
      className={`group rounded-[28px] bg-white border-2 ${theme.cardBorder} p-4 flex flex-col gap-3.5 bubble-shadow hover:bubble-shadow-hover hover:-translate-y-1 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#CBE7FA]`}
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-[4/3] rounded-[20px] overflow-hidden bg-[#FAF5E8]">
        <GameThumbnail
          src={game.thumbnailUrl}
          alt={`${game.title} game thumbnail`}
          title={game.title}
          fallbackBg={theme.fallbackBg}
          loading={index < 6 ? 'eager' : 'lazy'}
          imgClassName="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>

      {/* Title + Play CTA */}
      <div className="flex flex-col flex-1 justify-between gap-3 px-1">
        <h2 className="font-display text-xl font-bold text-[#2B3445] leading-snug line-clamp-1">
          {game.title}
        </h2>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlay(game);
          }}
          className={`bubble-button w-full rounded-full py-2.5 px-5 font-bold text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${theme.playBg}`}
        >
          <Play className="w-4 h-4 fill-current" aria-hidden="true" />
          <span>Play Now</span>
        </button>
      </div>
    </article>
  );
}
