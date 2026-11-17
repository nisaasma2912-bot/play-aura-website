import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Loader2, Maximize2, Minimize2, RotateCcw, X } from 'lucide-react';
import type { GameRecord } from '../types/game';
import { AdSenseSlot } from './AdSenseSlot';

interface GamePlayerOverlayProps {
  game: GameRecord;
  onClose: () => void;
}

function injectBaseHref(html: string, baseDirUrl: string): string {
  const safeBase = baseDirUrl.replace(/"/g, '&quot;');
  const baseTag = `<base href="${safeBase}">`;
  const svgFallbackScript = `<script data-playaura-svg-fix="true">
(function() {
  window.addEventListener('error', function(e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG' || t.dataset.svgFixed) return;
    var src = t.src || '';
    if (!/\\.svg(?:\\?|#|$)/i.test(src)) return;
    t.dataset.svgFixed = '1';
    fetch(src).then(function(r) { return r.text(); }).then(function(txt) {
      if (txt.indexOf('<svg') === -1) return;
      t.src = URL.createObjectURL(new Blob([txt], { type: 'image/svg+xml' }));
    }).catch(function() {});
  }, true);
})();
</script>`;
  const headInjection = `${baseTag}\n${svgFallbackScript}`;
  if (/<base\b[^>]*>/i.test(html)) {
    return html;
  }
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (match) => `${match}\n${headInjection}`);
  }
  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/<html\b[^>]*>/i, (match) => `${match}\n<head>${headInjection}</head>`);
  }
  return `<head>${headInjection}</head>\n${html}`;
}

export function GamePlayerOverlay({ game, onClose }: GamePlayerOverlayProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExpandedFallback, setIsExpandedFallback] = useState(false);

  const [resolvedSrcDoc, setResolvedSrcDoc] = useState<string | undefined>(game.gameSrcDoc);
  const [resolvedSrcUrl, setResolvedSrcUrl] = useState<string | undefined>(
    game.gameSrcDoc ? undefined : game.gameEntryUrl
  );
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Local pre-publish ZIP preview already provides self-contained srcDoc
    if (game.gameSrcDoc) {
      setResolvedSrcDoc(game.gameSrcDoc);
      setResolvedSrcUrl(undefined);
      setLoadingEntry(false);
      setEntryError(null);
      return;
    }

    const entryUrl = game.gameEntryUrl?.trim();
    if (!entryUrl) {
      setResolvedSrcDoc(undefined);
      setResolvedSrcUrl(undefined);
      setLoadingEntry(false);
      setEntryError('This game does not have a playable entry URL.');
      return;
    }

    // Verify hosted entry HTML: if storage serves HTML as text/plain (e.g. Supabase Storage),
    // fetch the HTML text and render via srcDoc with <base href="..."> pointing to the folder
    // in storage so all relative assets (images, scripts, CSS, audio, JSON) resolve natively.
    setLoadingEntry(true);
    setEntryError(null);
    setResolvedSrcDoc(undefined);
    setResolvedSrcUrl(undefined);

    (async () => {
      try {
        const res = await fetch(entryUrl, { method: 'GET', mode: 'cors' });
        if (!res.ok) {
          throw new Error(`Could not load game entry (${res.status}).`);
        }

        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('text/html')) {
          if (!cancelled) {
            setResolvedSrcDoc(undefined);
            setResolvedSrcUrl(entryUrl);
            setLoadingEntry(false);
          }
          return;
        }

        const htmlText = await res.text();
        const baseDirUrl = entryUrl.slice(0, entryUrl.lastIndexOf('/') + 1);
        const preparedHtml = injectBaseHref(htmlText, baseDirUrl);

        if (!cancelled) {
          setResolvedSrcDoc(preparedHtml);
          setResolvedSrcUrl(undefined);
          setLoadingEntry(false);
        }
      } catch (err) {
        // Fallback to direct iframe URL if CORS check is blocked on a third-party static host
        if (!cancelled) {
          setResolvedSrcDoc(undefined);
          setResolvedSrcUrl(entryUrl);
          setLoadingEntry(false);
          if (err instanceof Error && err.message.includes('Could not load game entry')) {
            setEntryError(err.message);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [game.gameEntryUrl, game.gameSrcDoc, reloadKey]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [onClose]);

  const toggleFullscreen = async () => {
    const el = stageRef.current;
    if (!el) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      setIsExpandedFallback(false);
      return;
    }

    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        // Fallback maximize within viewport for iOS / restricted iframes
      }
    }
    setIsExpandedFallback((prev) => !prev);
  };

  const activeMax = isFullscreen || isExpandedFallback;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${game.title} game player`}
      className="fixed inset-0 z-50 overflow-y-auto bg-[#EDF6FC]/95 backdrop-blur-md"
    >
      <div className="min-h-full w-full max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-6 flex flex-col items-center">
        {/* Player Control Bar */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4 bg-white/95 border-2 border-[#CBE7FA] rounded-full px-3 sm:px-5 py-2 bubble-shadow">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#FAF5E8] hover:bg-[#D8F3E5] text-[#2B3445] hover:text-[#1D6B52] px-3.5 py-2 text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back</span>
            </button>
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-xl font-bold text-[#2B3445] truncate">
                {game.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              aria-label="Restart game"
              className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#EAE5FA] hover:bg-[#DFD7F8] text-[#4B3D8F] px-3 sm:px-3.5 py-2 text-sm font-bold whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Restart</span>
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={activeMax ? 'Exit fullscreen' : 'Enter fullscreen'}
              className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#D8F3E5] hover:bg-[#BFEAD6] text-[#1D6B52] px-3 sm:px-3.5 py-2 text-sm font-bold whitespace-nowrap cursor-pointer"
            >
              {activeMax ? (
                <Minimize2 className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="w-4 h-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{activeMax ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close game player"
              className="bubble-button inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#FAF5E8] hover:bg-[#CBE7FA] text-[#2B3445] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Game Viewport Stage — iframe never remounts on fullscreen or resize to preserve game state */}
        <div
          ref={stageRef}
          className={
            isExpandedFallback
              ? 'fixed inset-2 z-50 rounded-[24px] bg-[#FFFDF6] border-4 border-[#BFEAD6] overflow-hidden flex flex-col bubble-shadow'
              : 'w-full rounded-[28px] bg-[#FFFDF6] border-3 border-[#CBE7FA] overflow-hidden bubble-shadow flex flex-col'
          }
        >
          {isExpandedFallback && (
            <div className="flex items-center justify-between px-4 py-2 bg-[#FFFDF6] border-b border-[#EAE3CE]">
              <span className="font-display font-bold text-[#2B3445] truncate pr-3">{game.title}</span>
              <button
                type="button"
                onClick={() => setIsExpandedFallback(false)}
                className="rounded-full bg-[#D8F3E5] text-[#1D6B52] px-3.5 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
              >
                Exit Fullscreen
              </button>
            </div>
          )}

          <div
            className={
              activeMax
                ? 'w-full flex-1 bg-[#FFFDF6] relative'
                : 'w-full h-[64dvh] sm:h-[70dvh] min-h-[340px] max-h-[760px] bg-[#FFFDF6] relative'
            }
          >
            {loadingEntry ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-sm font-bold text-[#1E5B8A]">
                <Loader2 className="w-7 h-7 animate-spin" aria-hidden="true" />
                <span>Loading game files...</span>
              </div>
            ) : entryError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                <AlertCircle className="w-8 h-8 text-[#4B3D8F]" aria-hidden="true" />
                <p className="font-display text-lg font-bold text-[#2B3445]">
                  Unable to start game
                </p>
                <p className="text-sm text-[#5A657A] max-w-md">{entryError}</p>
              </div>
            ) : (
              <iframe
                key={`${game.id}-${reloadKey}`}
                src={resolvedSrcDoc ? undefined : resolvedSrcUrl}
                srcDoc={resolvedSrcDoc}
                title={game.title}
                sandbox="allow-scripts allow-same-origin allow-pointer-lock"
                allow="fullscreen"
                className="w-full h-full border-0 block"
              />
            )}
          </div>
        </div>

        {game.description && (
          <p className="mt-4 text-center text-sm font-semibold text-[#5A657A] max-w-2xl px-2">
            {game.description}
          </p>
        )}

        {/* AdSense Area placed well away from game controls */}
        {!game.gameSrcDoc && (
          <div className="w-full mt-6 pb-4">
            <AdSenseSlot placement="player" />
          </div>
        )}
      </div>
    </div>
  );
}
