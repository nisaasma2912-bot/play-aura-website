import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Gamepad2, Loader2, RefreshCw, SearchX } from 'lucide-react';
import { AdSenseSlot } from './components/AdSenseSlot';
import { AdminPortal } from './components/AdminPortal';
import { Footer } from './components/Footer';
import { GameCard } from './components/GameCard';
import { GamePlayerOverlay } from './components/GamePlayerOverlay';
import { GameSuggestionModal } from './components/GameSuggestionModal';
import { Header, type ActiveView } from './components/Header';
import { InfoPage } from './components/InfoPages';
import { SearchBar } from './components/SearchBar';
import {
  fetchPublishedSupabaseGames,
  getCurrentAdminAuthState,
  isSupabaseConfigured,
  supabase,
} from './lib/supabase';
import type { AdminUserSession, GameRecord } from './types/game';

const SITE_ORIGIN = 'https://play-aura-website.pages.dev';

const ROUTE_PATHS: Record<ActiveView, string> = {
  home: '/',
  admin: '/admin',
  'privacy-policy': '/privacy-policy',
  terms: '/terms',
  contact: '/contact',
  about: '/about',
  disclaimer: '/disclaimer',
};

const ROUTE_SEO: Record<ActiveView, { title: string; description: string }> = {
  home: {
    title: 'Play Aura — Cozy Pastel HTML5 Games',
    description:
      'Play Aura is a cheerful, child-friendly pastel HTML5 gaming playground. Click any game card to play instantly in your browser.',
  },
  admin: {
    title: 'Admin — Play Aura',
    description: 'Private administrator dashboard for managing Play Aura games and suggestions.',
  },
  'privacy-policy': {
    title: 'Privacy Policy — Play Aura',
    description:
      'Read how Play Aura handles hosting logs, browser storage, anonymous suggestion tokens, and privacy questions.',
  },
  terms: {
    title: 'Terms & Conditions — Play Aura',
    description:
      'Terms of use, third-party game ownership, suggestion guidelines, and moderation rules for Play Aura.',
  },
  contact: {
    title: 'Contact Us — Play Aura',
    description:
      'Get in touch with Play Aura via email for general questions, copyright notices, privacy inquiries, or feedback.',
  },
  about: {
    title: 'About Us — Play Aura',
    description:
      'Learn about Play Aura, an online browser gaming playground where visitors discover games and suggest new ideas.',
  },
  disclaimer: {
    title: 'Disclaimer — Play Aura',
    description:
      'Third-party game intellectual property, availability, and platform maintenance disclaimer for Play Aura.',
  },
};

export function getViewFromPathname(pathname: string): ActiveView {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  switch (normalized) {
    case '/admin':
      return 'admin';
    case '/privacy-policy':
      return 'privacy-policy';
    case '/terms':
      return 'terms';
    case '/contact':
      return 'contact';
    case '/about':
      return 'about';
    case '/disclaimer':
      return 'disclaimer';
    default:
      return 'home';
  }
}

function isInfoView(view: ActiveView): view is Exclude<ActiveView, 'home' | 'admin'> {
  return (
    view === 'privacy-policy' ||
    view === 'terms' ||
    view === 'contact' ||
    view === 'about' ||
    view === 'disclaimer'
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>(() =>
    typeof window !== 'undefined' ? getViewFromPathname(window.location.pathname) : 'home'
  );
  const [publishedGames, setPublishedGames] = useState<GameRecord[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeGame, setActiveGame] = useState<GameRecord | null>(null);
  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
  const [adminSession, setAdminSession] = useState<AdminUserSession | null>(null);
  const [checkingAdminSession, setCheckingAdminSession] = useState<boolean>(isSupabaseConfigured);

  const navigateTo = useCallback((view: ActiveView, replace = false) => {
    setActiveView(view);
    if (typeof window === 'undefined') return;
    const targetPath = ROUTE_PATHS[view] || '/';
    const currentNormalized = window.location.pathname.replace(/\/+$/, '') || '/';
    if (currentNormalized !== targetPath) {
      if (replace) {
        window.history.replaceState({}, '', targetPath);
      } else {
        window.history.pushState({}, '', targetPath);
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveView(getViewFromPathname(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const loadPublishedGames = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setPublishedGames([]);
      setLoadError(null);
      return;
    }

    setLoadingGames(true);
    setLoadError(null);
    try {
      const fetched = await fetchPublishedSupabaseGames();
      setPublishedGames(fetched);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to load games right now. Please try again.'
      );
    } finally {
      setLoadingGames(false);
    }
  }, []);

  useEffect(() => {
    void loadPublishedGames();

    if (!isSupabaseConfigured || !supabase) {
      setCheckingAdminSession(false);
      return;
    }

    let active = true;

    const syncAdminAuth = async () => {
      try {
        const authState = await getCurrentAdminAuthState();
        if (!active) return;
        if (authState.status === 'authorized') {
          setAdminSession(authState.session);
        } else {
          setAdminSession(null);
          if (authState.status === 'unauthorized') {
            navigateTo('home', true);
          }
        }
      } finally {
        if (active) {
          setCheckingAdminSession(false);
        }
      }
    };

    void syncAdminAuth();

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setAdminSession(null);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void syncAdminAuth();
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadPublishedGames, navigateTo]);

  useEffect(() => {
    const seo = ROUTE_SEO[activeView];
    document.title = seo.title;

    const descMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (descMeta) {
      descMeta.content = seo.description;
    }

    const robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (robotsMeta) {
      robotsMeta.content = activeView === 'admin' ? 'noindex, nofollow' : 'index, follow';
    }

    const canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.href = `${SITE_ORIGIN}${ROUTE_PATHS[activeView]}`;
    }
  }, [activeView]);

  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return publishedGames;
    return publishedGames.filter((game) => game.title.toLowerCase().includes(q));
  }, [publishedGames, searchQuery]);

  return (
    <div className="relative min-h-screen flex flex-col bg-[#FFFDF6] text-[#2B3445]">
      {activeView !== 'admin' && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#8DE4FF]"
        >
          <img
            src="/assets/aistudio/40542a35-1e12-43b9-8f97-b48e5e80a59f_a6b16010.png"
            alt=""
            width={1672}
            height={941}
            decoding="async"
            fetchPriority="high"
            className="w-full h-full object-cover object-center select-none"
          />
        </div>
      )}

      <Header
        activeView={activeView}
        onNavigate={(view) => navigateTo(view)}
        onOpenSuggestion={() => setSuggestionModalOpen(true)}
      />

      <main className="relative z-10 flex-1">
        {activeView === 'home' && (
          <>
            {/* Search Box */}
            <section className="pt-8 sm:pt-12 pb-6 sm:pb-8 px-4 sm:px-6">
              <div className="max-w-5xl mx-auto">
                <SearchBar query={searchQuery} onQueryChange={setSearchQuery} />
              </div>
            </section>

            {/* Published Games Grid / Friendly Empty State */}
            <section
              aria-label="Published games"
              className="max-w-6xl mx-auto px-4 sm:px-6 pt-2 pb-12"
            >
              {loadingGames ? (
                <div className="max-w-md mx-auto rounded-[32px] bg-white/95 backdrop-blur-sm border-2 border-[#CBE7FA] p-10 text-center bubble-shadow space-y-3 my-6">
                  <Loader2
                    className="w-8 h-8 animate-spin text-[#1E5B8A] mx-auto"
                    aria-hidden="true"
                  />
                  <p className="font-display text-xl font-bold text-[#2B3445]">
                    Loading Play Aura games...
                  </p>
                </div>
              ) : loadError ? (
                <div
                  role="alert"
                  className="max-w-md mx-auto rounded-[32px] bg-white/95 backdrop-blur-sm border-2 border-[#EAE5FA] p-8 text-center bubble-shadow space-y-4 my-6"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#EAE5FA] text-[#4B3D8F] flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-[#2B3445]">
                    Could not load games
                  </h2>
                  <p className="text-sm text-[#5A657A]">{loadError}</p>
                  <button
                    type="button"
                    onClick={() => void loadPublishedGames()}
                    className="bubble-button inline-flex items-center gap-2 rounded-full bg-[#BFEAD6] hover:bg-[#A9E0C6] text-[#1D6B52] px-6 py-2.5 text-sm font-bold cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                    <span>Try Again</span>
                  </button>
                </div>
              ) : publishedGames.length === 0 ? (
                <div className="max-w-lg mx-auto rounded-[32px] bg-white/95 backdrop-blur-sm border-2 border-[#D8F3E5] p-8 sm:p-10 text-center bubble-shadow space-y-4 my-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#D8F3E5] via-[#DDF0FC] to-[#EAE5FA] text-[#1D6B52] flex items-center justify-center border border-[#BFEAD6]">
                    <Gamepad2 className="w-8 h-8" aria-hidden="true" />
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#2B3445] text-balance">
                    No games yet! New adventures are coming soon.
                  </h2>
                </div>
              ) : filteredGames.length === 0 ? (
                <div className="max-w-md mx-auto rounded-[32px] bg-white/95 backdrop-blur-sm border-2 border-[#EAE5FA] p-8 text-center bubble-shadow space-y-4 my-6">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#EAE5FA] text-[#4B3D8F] flex items-center justify-center">
                    <SearchX className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-[#2B3445]">
                    No matching games found
                  </h2>
                  <p className="text-sm text-[#5A657A]">
                    We couldn&apos;t find a game matching &ldquo;{searchQuery.trim()}&rdquo;. Try another name or clear your search.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="bubble-button rounded-full bg-[#BFEAD6] hover:bg-[#A9E0C6] text-[#1D6B52] px-6 py-2.5 text-sm font-bold cursor-pointer"
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredGames.map((game, idx) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      index={idx}
                      onPlay={setActiveGame}
                    />
                  ))}
                </div>
              )}

              {/* AdSense Area safely below the catalog (renders only when configured) */}
              <div className="mt-12">
                <AdSenseSlot placement="home" />
              </div>
            </section>
          </>
        )}

        {isInfoView(activeView) && (
          <InfoPage view={activeView} onNavigate={(view) => navigateTo(view)} />
        )}

        {activeView === 'admin' && (
          <AdminPortal
            session={adminSession}
            checkingSession={checkingAdminSession}
            onSessionChange={setAdminSession}
            onUnauthorizedRedirect={() => navigateTo('home', true)}
            onLibraryUpdated={() => void loadPublishedGames()}
            onPlayGame={setActiveGame}
            onBackToGames={() => navigateTo('home')}
          />
        )}
      </main>

      {/* Complete Professional Footer on Homepage & All 5 Information Pages */}
      {activeView !== 'admin' && (
        <Footer activeView={activeView} onNavigate={(view) => navigateTo(view)} />
      )}

      {/* Game Suggestion Modal */}
      <GameSuggestionModal
        isOpen={suggestionModalOpen}
        onClose={() => setSuggestionModalOpen(false)}
      />

      {/* Instant Same-Page Game Player Overlay */}
      {activeGame && (
        <GamePlayerOverlay
          game={activeGame}
          onClose={() => setActiveGame(null)}
        />
      )}
    </div>
  );
}
