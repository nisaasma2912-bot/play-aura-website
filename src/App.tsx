import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Gamepad2, Loader2, RefreshCw, SearchX } from 'lucide-react';
import { AdSenseSlot } from './components/AdSenseSlot';
import { AdminPortal } from './components/AdminPortal';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { Footer } from './components/Footer';
import { GameCard } from './components/GameCard';
import { GamePlayerOverlay } from './components/GamePlayerOverlay';
import { GameSuggestionModal } from './components/GameSuggestionModal';
import { Header, type ActiveView } from './components/Header';
import { InfoPage } from './components/InfoPages';
import { SearchBar } from './components/SearchBar';
import { VisitorInboxModal } from './components/VisitorInboxModal';
import { trackGameClose, trackGameOpen } from './lib/analytics';
import {
  applyStoredConsentOnLoad,
  saveConsentChoice,
  type AnalyticsConsentChoice,
} from './lib/consent';
import {
  fetchPublishedSupabaseGames,
  fetchVisitorInbox,
  getCurrentAdminAuthState,
  isSupabaseConfigured,
  markVisitorRepliesRead,
  supabase,
} from './lib/supabase';
import type {
  AdminUserSession,
  GameRecord,
  VisitorConversationRecord,
} from './types/game';

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
    title: 'Free Online Games at Play Aura - Play Now!',
    description:
      'Play free browser games on Play Aura. Browse available games, launch them in your browser, and find game instructions and controls.',
  },
  admin: {
    title: 'Admin — Play Aura',
    description: 'Private administrator dashboard for managing Play Aura games and suggestions.',
  },
  'privacy-policy': {
    title: 'Privacy Policy — Play Aura',
    description:
      'Read how Play Aura handles analytics, cookies, hosting infrastructure, browser storage, anonymous suggestion tokens, and privacy inquiries.',
  },
  terms: {
    title: 'Terms & Conditions — Play Aura',
    description:
      'Terms of use, acceptable behavior, third-party game ownership, external links, and copyright contact details for Play Aura.',
  },
  contact: {
    title: 'Contact Us — Play Aura',
    description:
      'Get in touch with Play Aura via email for general questions, copyright notices, privacy inquiries, or feedback.',
  },
  about: {
    title: 'About Us — Play Aura',
    description:
      'Learn about Play Aura, an online browser gaming playground where visitors discover free games, read controls, and suggest new ideas.',
  },
  disclaimer: {
    title: 'Disclaimer — Play Aura',
    description:
      'Third-party game intellectual property, availability, and platform maintenance disclaimer for Play Aura.',
  },
};

function getGameSlugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/games\/([^/]+)\/?$/i);
  return match ? decodeURIComponent(match[1]) : null;
}

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
  const activeGameSessionRef = useRef<GameRecord | null>(null);

  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
  const [inboxModalOpen, setInboxModalOpen] = useState(false);
  const [inboxSupported, setInboxSupported] = useState(true);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [inboxConversations, setInboxConversations] = useState<VisitorConversationRecord[]>([]);
  const inboxRequestInFlightRef = useRef(false);

  const [consentChoice, setConsentChoice] = useState<AnalyticsConsentChoice | null>(null);
  const [cookieBannerOpen, setCookieBannerOpen] = useState(false);

  const [adminSession, setAdminSession] = useState<AdminUserSession | null>(null);
  const [checkingAdminSession, setCheckingAdminSession] = useState<boolean>(isSupabaseConfigured);

  const loadVisitorInbox = useCallback(async (showSpinner = false) => {
    if (!isSupabaseConfigured || inboxRequestInFlightRef.current) return;
    inboxRequestInFlightRef.current = true;
    if (showSpinner) {
      setInboxLoading(true);
    }
    setInboxError(null);
    try {
      const data = await fetchVisitorInbox();
      setInboxSupported(data.supported);
      setInboxUnreadCount(data.unreadCount);
      setInboxConversations(data.conversations);
    } catch (err) {
      if (showSpinner) {
        setInboxError(
          err instanceof Error ? err.message : 'Unable to load your notifications right now.'
        );
      }
    } finally {
      inboxRequestInFlightRef.current = false;
      if (showSpinner) {
        setInboxLoading(false);
      }
    }
  }, []);

  const handleMarkConversationRead = useCallback(async (suggestionId: string) => {
    setInboxConversations((prev) => {
      const target = prev.find((c) => c.id === suggestionId);
      if (!target || target.unreadReplyCount === 0) return prev;
      const nowIso = new Date().toISOString();
      return prev.map((c) =>
        c.id === suggestionId
          ? {
              ...c,
              unreadReplyCount: 0,
              replies: c.replies.map((r) =>
                r.senderType === 'admin' && !r.visitorReadAt
                  ? { ...r, visitorReadAt: nowIso }
                  : r
              ),
            }
          : c
      );
    });

    try {
      const result = await markVisitorRepliesRead(suggestionId);
      setInboxUnreadCount(result.unreadCount);
      if (result.readAt) {
        setInboxConversations((prev) =>
          prev.map((c) =>
            c.id === suggestionId
              ? {
                  ...c,
                  unreadReplyCount: 0,
                  replies: c.replies.map((r) =>
                    r.senderType === 'admin' && !r.visitorReadAt
                      ? { ...r, visitorReadAt: result.readAt }
                      : r
                  ),
                }
              : c
          )
        );
      }
    } catch {
      // Refresh authoritative count on error
      void loadVisitorInbox(false);
    }
  }, [loadVisitorInbox]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    const result = await markVisitorRepliesRead();
    setInboxUnreadCount(result.unreadCount);
    const stamp = result.readAt || new Date().toISOString();
    setInboxConversations((prev) =>
      prev.map((c) => ({
        ...c,
        unreadReplyCount: 0,
        replies: c.replies.map((r) =>
          r.senderType === 'admin' && !r.visitorReadAt ? { ...r, visitorReadAt: stamp } : r
        ),
      }))
    );
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || activeView === 'admin') return;

    void loadVisitorInbox(false);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void loadVisitorInbox(false);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const intervalMs = inboxModalOpen ? 6000 : 20000;
    const pollId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadVisitorInbox(false);
      }
    }, intervalMs);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.clearInterval(pollId);
    };
  }, [activeView, inboxModalOpen, loadVisitorInbox]);

  useEffect(() => {
    const stored = applyStoredConsentOnLoad();
    setConsentChoice(stored);
    if (stored === null) {
      setCookieBannerOpen(true);
    }
  }, []);

  const handleAcceptAnalytics = useCallback(() => {
    saveConsentChoice('accepted');
    setConsentChoice('accepted');
    setCookieBannerOpen(false);
  }, []);

  const handleDeclineAnalytics = useCallback(() => {
    saveConsentChoice('rejected');
    setConsentChoice('rejected');
    setCookieBannerOpen(false);
  }, []);

  const handleOpenGame = useCallback((game: GameRecord) => {
    if (activeGameSessionRef.current?.id === game.id) {
      return;
    }
    if (activeGameSessionRef.current && !activeGameSessionRef.current.id.startsWith('local-preview-')) {
      trackGameClose(activeGameSessionRef.current);
    }
    activeGameSessionRef.current = game;
    if (!game.id.startsWith('local-preview-')) {
      trackGameOpen(game);
    }
    setActiveGame(game);
    if (typeof window !== 'undefined') {
      if (!game.id.startsWith('local-preview-') && game.slug) {
        const gamePath = `/games/${encodeURIComponent(game.slug)}`;
        if (window.location.pathname !== gamePath) {
          window.history.pushState({ playAuraGame: game.slug }, '', gamePath);
        }
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const handleCloseGame = useCallback(() => {
    const closingGame = activeGameSessionRef.current;
    activeGameSessionRef.current = null;
    if (closingGame && !closingGame.id.startsWith('local-preview-')) {
      trackGameClose(closingGame);
    }
    setActiveGame(null);
    if (typeof window !== 'undefined' && getGameSlugFromPathname(window.location.pathname)) {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const navigateTo = useCallback(
    (view: ActiveView, replace = false) => {
      if (activeGameSessionRef.current) {
        handleCloseGame();
      }
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
    },
    [handleCloseGame]
  );

  useEffect(() => {
    const handlePopState = () => {
      const gameSlug = getGameSlugFromPathname(window.location.pathname);
      if (gameSlug) {
        const matchingGame = publishedGames.find((game) => game.slug === gameSlug);
        if (matchingGame) {
          handleOpenGame(matchingGame);
          return;
        }
      }
      if (activeGameSessionRef.current) {
        const closingGame = activeGameSessionRef.current;
        activeGameSessionRef.current = null;
        if (!closingGame.id.startsWith('local-preview-')) trackGameClose(closingGame);
        setActiveGame(null);
      }
      setActiveView(getViewFromPathname(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handleOpenGame, publishedGames]);

  useEffect(() => {
    const gameSlug = getGameSlugFromPathname(window.location.pathname);
    if (!gameSlug || loadingGames || !publishedGames.length || activeGame?.slug === gameSlug) return;
    const matchingGame = publishedGames.find((game) => game.slug === gameSlug);
    if (matchingGame) {
      activeGameSessionRef.current = matchingGame;
      setActiveGame(matchingGame);
      if (!matchingGame.id.startsWith('local-preview-')) trackGameOpen(matchingGame);
    }
  }, [publishedGames, loadingGames, activeGame]);

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
    const gameSeo = activeGame
      ? {
          title: `${activeGame.title} — Play Free Online | Play Aura`,
          description: activeGame.description?.trim()
            ? activeGame.description.trim().slice(0, 155)
            : `Play ${activeGame.title} online for free on Play Aura. View game instructions and controls, then start playing in your browser.`,
        }
      : null;
    const seo = gameSeo || ROUTE_SEO[activeView];
    const canonicalPath = activeGame?.slug
      ? `/games/${encodeURIComponent(activeGame.slug)}`
      : ROUTE_PATHS[activeView];
    const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
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
      canonicalLink.href = canonicalUrl;
    }

    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.content = seo.title;
    }

    const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.content = seo.description;
    }

    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.content = canonicalUrl;
    }

    const twitterTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    if (twitterTitle) {
      twitterTitle.content = seo.title;
    }

    const twitterDesc = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
    if (twitterDesc) {
      twitterDesc.content = seo.description;
    }

    const twitterUrl = document.querySelector<HTMLMetaElement>('meta[name="twitter:url"]');
    if (twitterUrl) {
      twitterUrl.content = canonicalUrl;
    }
  }, [activeView, activeGame]);

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

      {!activeGame && (
        <Header
          activeView={activeView}
          onNavigate={(view) => navigateTo(view)}
          onOpenSuggestion={() => setSuggestionModalOpen(true)}
          onOpenNotifications={() => {
            setInboxModalOpen(true);
            void loadVisitorInbox(true);
          }}
          unreadNotificationsCount={inboxUnreadCount}
        />
      )}

      <main className="relative z-10 flex-1">
        {/* Scrollable Normal-Flow Game Player Section */}
        {activeGame && (
          <GamePlayerOverlay
            game={activeGame}
            recommendations={publishedGames}
            onPlayRecommendation={handleOpenGame}
            onClose={handleCloseGame}
          />
        )}

        {/* Preserve Home / Info / Admin state while a game is open */}
        <div className={activeGame ? 'hidden' : undefined}>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredGames.map((game, idx) => (
                      <GameCard
                        key={game.id}
                        game={game}
                        index={idx}
                        onPlay={handleOpenGame}
                      />
                    ))}
                  </div>
                )}

                {/* Original, visitor-focused homepage information */}
                <section aria-labelledby="play-aura-guide" className="mt-10 sm:mt-14 rounded-[28px] border-2 border-[#CBE7FA] bg-white/95 p-5 sm:p-8 bubble-shadow space-y-6">
                  <div className="max-w-3xl space-y-2">
                    <h2 id="play-aura-guide" className="font-display text-2xl sm:text-3xl font-bold text-[#2B3445]">
                      Free Browser Games on Play Aura
                    </h2>
                    <p className="text-sm sm:text-base leading-relaxed text-[#5A657A]">
                      Play Aura brings browser games together in one place. Browse the available titles, choose a game, and launch it in the on-page player without installing a separate game app. The collection may change as games are added, updated, or removed.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="rounded-2xl bg-[#D8F3E5]/45 border border-[#BFEAD6] p-4 sm:p-5 space-y-2">
                      <h3 className="font-display text-lg font-bold text-[#1D6B52]">How to Play</h3>
                      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-[#5A657A]">
                        <li>Browse the game cards or search for a title.</li>
                        <li>Select Play Now to open the game player.</li>
                        <li>Use the game’s own controls; scroll below the player for instructions when they are available.</li>
                      </ol>
                    </div>
                    <div className="rounded-2xl bg-[#DDF0FC]/55 border border-[#CBE7FA] p-4 sm:p-5 space-y-2">
                      <h3 className="font-display text-lg font-bold text-[#1E5B8A]">Game Information</h3>
                      <p className="text-sm leading-relaxed text-[#5A657A]">
                        Game descriptions, objectives, tips, and keyboard, mouse, or touch controls are shown when supplied for a listing. Some games are created by third-party developers; their names and creative work remain the property of their respective owners.
                      </p>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-[#68758A]">
                    Game performance and controls can vary by browser, device, and the individual game. If a game does not load, use the player’s Back button and contact Play Aura through the Contact Us page.
                  </p>
                </section>

                {/* AdSense Area safely below the catalog (renders only when configured) */}
                <div className="mt-12">
                  <AdSenseSlot placement="home" />
                </div>
              </section>
            </>
          )}

          {isInfoView(activeView) && (
            <InfoPage
              view={activeView}
              onNavigate={(view) => navigateTo(view)}
              onOpenCookieSettings={() => setCookieBannerOpen(true)}
            />
          )}

          {activeView === 'admin' && (
            <AdminPortal
              session={adminSession}
              checkingSession={checkingAdminSession}
              onSessionChange={setAdminSession}
              onUnauthorizedRedirect={() => navigateTo('home', true)}
              onLibraryUpdated={() => void loadPublishedGames()}
              onPlayGame={handleOpenGame}
              onBackToGames={() => navigateTo('home')}
            />
          )}
        </div>
      </main>

      {/* Complete Professional Footer on Homepage & All 5 Information Pages */}
      {activeView !== 'admin' && (
        <Footer
          activeView={activeView}
          onNavigate={(view) => navigateTo(view)}
          onOpenCookieSettings={() => setCookieBannerOpen(true)}
        />
      )}

      {/* Game Suggestion Modal */}
      <GameSuggestionModal
        isOpen={suggestionModalOpen}
        onClose={() => setSuggestionModalOpen(false)}
        onSuggestionSubmitted={() => void loadVisitorInbox(false)}
      />

      {/* Visitor Notification Bell Inbox & Conversation Modal */}
      <VisitorInboxModal
        isOpen={inboxModalOpen}
        supported={inboxSupported}
        loading={inboxLoading}
        error={inboxError}
        unreadCount={inboxUnreadCount}
        conversations={inboxConversations}
        onClose={() => setInboxModalOpen(false)}
        onRefresh={() => loadVisitorInbox(true)}
        onOpenSuggestionModal={() => setSuggestionModalOpen(true)}
        onMarkConversationRead={handleMarkConversationRead}
        onMarkAllRead={handleMarkAllNotificationsRead}
      />

      {/* Non-blocking Cookie & Analytics Preferences Banner */}
      <CookieConsentBanner
        isVisible={cookieBannerOpen && activeView !== 'admin'}
        currentChoice={consentChoice}
        onAccept={handleAcceptAnalytics}
        onDecline={handleDeclineAnalytics}
        onDismiss={() => setCookieBannerOpen(false)}
        onOpenPrivacyPolicy={(view) => {
          setCookieBannerOpen(false);
          navigateTo(view);
        }}
      />
    </div>
  );
}
