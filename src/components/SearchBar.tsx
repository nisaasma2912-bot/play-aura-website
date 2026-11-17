import { Search, X } from 'lucide-react';

interface SearchBarProps {
  query: string;
  onQueryChange: (val: string) => void;
}

export function SearchBar({ query, onQueryChange }: SearchBarProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative w-full">
        <Search
          className="w-5 h-5 text-[#5A657A] absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search Play Aura games by name..."
          aria-label="Search games by name"
          className="w-full h-13 sm:h-14 pl-13 pr-12 rounded-full bg-white border-2 border-[#CBE7FA] text-[#2B3445] placeholder:text-[#78849B] text-sm sm:text-base font-semibold bubble-shadow focus:outline-none focus:border-[#8AD8B5] focus:ring-4 focus:ring-[#D8F3E5]/60 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#FAF5E8] hover:bg-[#EAE5FA] text-[#4B3D8F] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
