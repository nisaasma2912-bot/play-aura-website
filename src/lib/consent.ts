export type AnalyticsConsentChoice = 'accepted' | 'rejected';

export const GA4_MEASUREMENT_ID = 'G-1FN81T0SYK';
const CONSENT_STORAGE_KEY = 'playaura_cookie_consent_v1';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

export function getStoredConsent(): AnalyticsConsentChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (raw === 'accepted' || raw === 'rejected') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function hasAnalyticsTrackingAllowed(): boolean {
  return getStoredConsent() !== 'rejected';
}

function clearGoogleAnalyticsCookies(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const cookiePairs = document.cookie ? document.cookie.split(';') : [];
  const host = window.location.hostname;
  const domainParts = host.split('.');
  const candidateDomains = new Set<string>(['', host]);
  if (domainParts.length >= 2) {
    candidateDomains.add(`.${domainParts.slice(-2).join('.')}`);
    candidateDomains.add(`.${host}`);
  }

  for (const pair of cookiePairs) {
    const eqIndex = pair.indexOf('=');
    const name = (eqIndex === -1 ? pair : pair.slice(0, eqIndex)).trim();
    if (!name) continue;
    if (name === '_ga' || name === '_gid' || name.startsWith('_ga_') || name.startsWith('_gat')) {
      for (const domain of candidateDomains) {
        const domainAttr = domain ? `; domain=${domain}` : '';
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainAttr}`;
      }
    }
  }
}

function applyConsentChoice(choice: AnalyticsConsentChoice): void {
  if (typeof window === 'undefined') return;
  const disableKey = `ga-disable-${GA4_MEASUREMENT_ID}` as const;

  if (choice === 'rejected') {
    window[disableKey] = true;
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
    }
    clearGoogleAnalyticsCookies();
    return;
  }

  window[disableKey] = false;
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
    });
  }
}

export function applyStoredConsentOnLoad(): AnalyticsConsentChoice | null {
  const choice = getStoredConsent();
  if (choice) {
    applyConsentChoice(choice);
  }
  return choice;
}

export function saveConsentChoice(choice: AnalyticsConsentChoice): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    } catch {
      // Ignore storage errors in restricted environments
    }
  }
  applyConsentChoice(choice);
}
