const COMPLETED_GAME_SESSIONS_KEY = 'playaura_completed_game_sessions_v1';
export const COMPLETED_GAME_SESSIONS_PER_AD = 5;

type AdPlacementInfo = {
  breakStatus?: string;
};

type AdPlacementConfig = {
  preloadAdBreaks?: 'on' | 'auto';
  sound?: 'on' | 'off';
  type?: 'browse';
  name?: string;
  adBreakDone?: (placementInfo?: AdPlacementInfo) => void;
};

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
    adBreak?: (config: AdPlacementConfig) => void;
    adConfig?: (config: AdPlacementConfig) => void;
  }
}

let fallbackCompletedSessions = 0;

function getPublisherId(): string {
  return (import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined)?.trim() || '';
}

/**
 * H5 Games Ads are deliberately disabled unless the site owner has:
 * 1) an approved AdSense account, 2) Google H5 Games Ads access, and
 * 3) explicitly enabled the feature in the Cloudflare Pages environment.
 */
export function isH5GamesAdsEnabled(): boolean {
  return (
    import.meta.env.VITE_H5_GAMES_ADS_ENABLED === 'true' &&
    getPublisherId().startsWith('ca-pub-')
  );
}

export function getCompletedGameSessions(): number {
  if (typeof window === 'undefined') return fallbackCompletedSessions;

  try {
    const raw = window.localStorage.getItem(COMPLETED_GAME_SESSIONS_KEY);
    const parsed = raw === null ? fallbackCompletedSessions : Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(COMPLETED_GAME_SESSIONS_PER_AD, parsed)) : 0;
  } catch {
    return fallbackCompletedSessions;
  }
}

export function recordCompletedGameSession(): number {
  const nextCount = Math.min(
    COMPLETED_GAME_SESSIONS_PER_AD,
    getCompletedGameSessions() + 1
  );
  fallbackCompletedSessions = nextCount;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(COMPLETED_GAME_SESSIONS_KEY, String(nextCount));
    } catch {
      // Keep the in-memory count when browser storage is unavailable.
    }
  }

  return nextCount;
}

function clearCompletedGameSessions(): void {
  fallbackCompletedSessions = 0;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(COMPLETED_GAME_SESSIONS_KEY);
  } catch {
    // Ignore storage restrictions; the in-memory count is still reset.
  }
}

export function initializeH5GamesAds(): boolean {
  if (!isH5GamesAdsEnabled() || typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  window.adsbygoogle = window.adsbygoogle || [];
  const enqueueAdCommand = (config: AdPlacementConfig) => {
    (window.adsbygoogle = window.adsbygoogle || []).push(config);
  };

  // This is the initialization pattern required by Google's H5 Ad Placement API.
  window.adBreak = enqueueAdCommand;
  window.adConfig = enqueueAdCommand;
  window.adConfig({ preloadAdBreaks: 'auto', sound: 'off' });

  let script = document.querySelector<HTMLScriptElement>(
    'script[data-playaura-adsense="true"]'
  );

  if (!script) {
    script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(getPublisherId())}`;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-playaura-adsense', 'true');
    script.setAttribute('data-playaura-h5-games-ads', 'true');
    script.setAttribute('data-ad-frequency-hint', '120s');
    document.head.appendChild(script);
  } else {
    script.setAttribute('data-ad-frequency-hint', '120s');
  }

  return true;
}

/**
 * Requests one Google H5 Games "browse" placement at a catalogue-to-game
 * transition. The caller must launch the game from adBreakDone(), which is
 * called whether or not Google has an ad available.
 *
 * Returns false when the H5 integration is not enabled, so the caller can
 * open the game normally without delaying the visitor.
 */
export function showH5BrowseAd(onComplete: () => void): boolean {
  if (!isH5GamesAdsEnabled() || typeof window === 'undefined' || !window.adBreak) {
    return false;
  }

  let completed = false;
  const finish = () => {
    if (completed) return;
    completed = true;
    clearCompletedGameSessions();
    onComplete();
  };

  try {
    window.adBreak({
      type: 'browse',
      name: 'after-five-completed-game-sessions',
      adBreakDone: finish,
    });
    return true;
  } catch {
    finish();
    return true;
  }
}
