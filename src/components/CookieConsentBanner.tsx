import { Cookie, X } from 'lucide-react';
import type { ActiveView } from '../types/game';
import type { AnalyticsConsentChoice } from '../lib/consent';

interface CookieConsentBannerProps {
  isVisible: boolean;
  currentChoice: AnalyticsConsentChoice | null;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
  onOpenPrivacyPolicy: (view: ActiveView) => void;
}

export function CookieConsentBanner({
  isVisible,
  currentChoice,
  onAccept,
  onDecline,
  onDismiss,
  onOpenPrivacyPolicy,
}: CookieConsentBannerProps) {
  if (!isVisible) return null;

  return (
    <aside
      role="region"
      aria-label="Cookie and analytics preferences"
      className="fixed bottom-3 left-3 right-3 sm:bottom-5 sm:left-auto sm:right-5 z-40 sm:max-w-md rounded-[28px] bg-white/98 backdrop-blur-md border-2 border-[#CBE7FA] p-5 bubble-shadow space-y-3.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#D8F3E5] text-[#1D6B52] flex items-center justify-center shrink-0">
            <Cookie className="w-4 h-4" aria-hidden="true" />
          </div>
          <h2 className="font-display text-lg font-bold text-[#2B3445]">
            Cookie &amp; Analytics Preferences
          </h2>
        </div>

        {currentChoice !== null && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close cookie preferences"
            className="w-8 h-8 rounded-full bg-[#FAF5E8] hover:bg-[#EAE3CE] text-[#2B3445] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="text-xs sm:text-sm text-[#5A657A] leading-relaxed">
        Play Aura uses <strong>Google Analytics 4</strong> cookies to see which games visitors open and enjoy, plus essential browser storage for search, suggestions, and admin sign-in. Choose <strong>Essential Only</strong> to stop further analytics tracking and clear analytics cookies, or <strong>Accept Analytics</strong> to help us improve Play Aura. Read our{' '}
        <a
          href="/privacy-policy"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            onOpenPrivacyPolicy('privacy-policy');
          }}
          className="font-bold text-[#1D6B52] underline underline-offset-2"
        >
          Privacy Policy
        </a>
        .
      </p>

      {currentChoice !== null && (
        <p className="text-xs font-bold text-[#1E5B8A]">
          Current setting:{' '}
          {currentChoice === 'accepted' ? 'Analytics Accepted' : 'Essential Only (Analytics Disabled)'}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
        <button
          type="button"
          onClick={onDecline}
          className="bubble-button flex-1 rounded-full bg-[#FAF5E8] hover:bg-[#EAE3CE] border border-[#EAE3CE] text-[#2B3445] px-4 py-2.5 text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap"
        >
          Essential Only
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="bubble-button flex-1 rounded-full bg-[#BFEAD6] hover:bg-[#A9E0C6] text-[#1D6B52] px-4 py-2.5 text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap"
        >
          Accept Analytics
        </button>
      </div>
    </aside>
  );
}
