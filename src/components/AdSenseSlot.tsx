import { useEffect } from 'react';

interface AdSenseSlotProps {
  placement: 'home' | 'player';
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

export function AdSenseSlot({ placement, className = '' }: AdSenseSlotProps) {
  const clientId = (import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined)?.trim() || '';
  const slotId =
    placement === 'home'
      ? (import.meta.env.VITE_ADSENSE_HOME_SLOT as string | undefined)?.trim() || ''
      : (import.meta.env.VITE_ADSENSE_PLAYER_SLOT as string | undefined)?.trim() || '';

  const isConfigured = Boolean(clientId && slotId);

  useEffect(() => {
    if (!isConfigured) return;

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-playaura-adsense="true"]'
    );
    if (!existingScript) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        clientId
      )}`;
      script.crossOrigin = 'anonymous';
      script.setAttribute('data-playaura-adsense', 'true');
      document.head.appendChild(script);
    }

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense script not yet initialized or blocked by browser privacy extension
    }
  }, [clientId, slotId, isConfigured]);

  if (!isConfigured) {
    return null;
  }

  return (
    <aside
      aria-label="Advertisement"
      className={`w-full max-w-4xl mx-auto rounded-[24px] bg-[#FAF5E8]/70 border border-[#EAE3CE] p-3 text-center ${className}`}
    >
      <p className="text-[11px] font-semibold text-[#5A657A] mb-1.5">Advertisement</p>
      <ins
        className="adsbygoogle block w-full overflow-hidden"
        style={{ display: 'block', minHeight: placement === 'player' ? '90px' : '100px' }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
