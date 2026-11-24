import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Keyboard,
  Lightbulb,
  Loader2,
  Maximize2,
  Minimize2,
  Mouse,
  RotateCcw,
  Smartphone,
  Target,
  X,
} from 'lucide-react';
import type { GameRecord } from '../types/game';

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
  const closedOnceRef = useRef(false);
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
    closedOnceRef.current = false;
  }, [game.id]);

  const handleSafeClose = useCallback(() => {
    if (closedOnceRef.current) return;
    closedOnceRef.current = true;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    setIsExpandedFallback(false);
    onClose();
  }, [onClose]);

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

  // Only lock body scroll while temporary CSS fallback fullscreen is active.
  useEffect(() => {
    if (!isExpandedFallback) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isExpandedFallback]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.fullscreenElement) return;
      if (isExpandedFallback) {
        setIsExpandedFallback(false);
        return;
      }
      handleSafeClose();
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [handleSafeClose, isExpandedFallback]);

  const toggleFullscreen = async () => {
    const el = stageRef.current;
    if (!el) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      setIsExpandedFallback(false);
      return;
    }

    if (isExpandedFallback) {
      setIsExpandedFallback(false);
      return;
    }

    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        // Fallback maximize within viewport for iOS / restricted browsers
      }
    }
    setIsExpandedFallback(true);
  };

  const activeMax = isFullscreen || isExpandedFallback;

  const descriptionText = game.description?.trim() || '';
  const howToPlayText = game.howToPlay?.trim() || '';
  const objectiveText = game.objective?.trim() || '';
  const keyboardControlsText = game.keyboardControls?.trim() || '';
  const mouseControlsText = game.mouseControls?.trim() || '';
  const touchControlsText = game.touchControls?.trim() || '';
  const tipsText = game.tips?.trim() || '';

  const hasControls = Boolean(keyboardControlsText || mouseControlsText || touchControlsText);
  const hasAnyInfo = Boolean(
    descriptionText || howToPlayText || objectiveText || hasControls || tipsText
  );

  return (
    <section
      aria-label={`${game.title} game player`}
      className="w-full max-w-[1440px] mx-auto px-1.5 sm:px-4 lg:px-6 pt-3 sm:pt-5 pb-10"
    >
      {/* Player Control Bar */}
      <div className="w-full sm:max-w-[min(100%,calc(82dvh*16/9))] mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4 bg-white/95 border-2 border-[#CBE7FA] rounded-full px-3 sm:px-5 py-2 bubble-shadow">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={handleSafeClose}
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
            onClick={handleSafeClose}
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
            ? 'fixed inset-1 sm:inset-2 z-50 rounded-[20px] sm:rounded-[24px] bg-[#FFFDF6] border-3 sm:border-4 border-[#BFEAD6] overflow-hidden flex flex-col bubble-shadow'
            : isFullscreen
              ? 'w-screen h-screen bg-[#FFFDF6] overflow-hidden flex flex-col'
              : 'w-full sm:max-w-[min(100%,calc(82dvh*16/9))] mx-auto rounded-[20px] sm:rounded-[28px] bg-[#FFFDF6] border-2 sm:border-3 border-[#CBE7FA] overflow-hidden bubble-shadow flex flex-col'
        }
      >
        {activeMax && (
          <div className="flex items-center justify-between px-4 py-2 bg-[#FFFDF6] border-b border-[#EAE3CE] shrink-0">
            <span className="font-display font-bold text-[#2B3445] truncate pr-3">{game.title}</span>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-full bg-[#D8F3E5] hover:bg-[#BFEAD6] text-[#1D6B52] px-3.5 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              Exit Fullscreen
            </button>
          </div>
        )}

        <div
          className={
            activeMax
              ? 'w-full flex-1 min-h-0 bg-[#FFFDF6] relative'
              : 'w-full h-[62dvh] min-h-[360px] max-h-[560px] sm:h-auto sm:min-h-[420px] sm:max-h-none sm:aspect-video bg-[#FFFDF6] relative'
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

      {/* Separate Scrollable Game Information Section (only renders non-empty admin-provided sections) */}
      {hasAnyInfo && (
        <div className="mt-6 sm:mt-8 w-full sm:max-w-[min(100%,calc(82dvh*16/9))] mx-auto">
          <div className="rounded-[24px] sm:rounded-[32px] bg-white/96 border-2 border-[#CBE7FA] p-5 sm:p-8 bubble-shadow space-y-6">
            <div className="border-b border-[#EAE3CE] pb-4">
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#2B3445] break-words">
                About {game.title}
              </h3>
            </div>

            {descriptionText && (
              <div className="space-y-2">
                <h4 className="font-display text-lg sm:text-xl font-bold text-[#2B3445] flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#1E5B8A] shrink-0" aria-hidden="true" />
                  <span>Description</span>
                </h4>
                <p className="text-sm sm:text-base text-[#5A657A] leading-relaxed whitespace-pre-line break-words">
                  {descriptionText}
                </p>
              </div>
            )}

            {(howToPlayText || objectiveText) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {howToPlayText && (
                  <div className="rounded-2xl bg-[#D8F3E5]/45 border border-[#BFEAD6] p-4 sm:p-5 space-y-2">
                    <h4 className="font-display text-lg font-bold text-[#1D6B52]">How to Play</h4>
                    <p className="text-sm sm:text-base text-[#2B3445] leading-relaxed whitespace-pre-line break-words">
                      {howToPlayText}
                    </p>
                  </div>
                )}

                {objectiveText && (
                  <div className="rounded-2xl bg-[#DDF0FC]/55 border border-[#CBE7FA] p-4 sm:p-5 space-y-2">
                    <h4 className="font-display text-lg font-bold text-[#1E5B8A] flex items-center gap-2">
                      <Target className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Game Objective</span>
                    </h4>
                    <p className="text-sm sm:text-base text-[#2B3445] leading-relaxed whitespace-pre-line break-words">
                      {objectiveText}
                    </p>
                  </div>
                )}
              </div>
            )}

            {hasControls && (
              <div className="space-y-3">
                <h4 className="font-display text-lg sm:text-xl font-bold text-[#2B3445]">
                  Controls
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {keyboardControlsText && (
                    <div className="rounded-2xl bg-[#FAF5E8] border border-[#EAE3CE] p-4 space-y-1.5">
                      <h5 className="font-display text-base font-bold text-[#2B3445] flex items-center gap-2">
                        <Keyboard className="w-4 h-4 text-[#4B3D8F] shrink-0" aria-hidden="true" />
                        <span>Keyboard Controls</span>
                      </h5>
                      <p className="text-sm text-[#5A657A] leading-relaxed whitespace-pre-line break-words">
                        {keyboardControlsText}
                      </p>
                    </div>
                  )}

                  {mouseControlsText && (
                    <div className="rounded-2xl bg-[#FAF5E8] border border-[#EAE3CE] p-4 space-y-1.5">
                      <h5 className="font-display text-base font-bold text-[#2B3445] flex items-center gap-2">
                        <Mouse className="w-4 h-4 text-[#1E5B8A] shrink-0" aria-hidden="true" />
                        <span>Mouse Controls</span>
                      </h5>
                      <p className="text-sm text-[#5A657A] leading-relaxed whitespace-pre-line break-words">
                        {mouseControlsText}
                      </p>
                    </div>
                  )}

                  {touchControlsText && (
                    <div className="rounded-2xl bg-[#FAF5E8] border border-[#EAE3CE] p-4 space-y-1.5">
                      <h5 className="font-display text-base font-bold text-[#2B3445] flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-[#1D6B52] shrink-0" aria-hidden="true" />
                        <span>Mobile Touch Controls</span>
                      </h5>
                      <p className="text-sm text-[#5A657A] leading-relaxed whitespace-pre-line break-words">
                        {touchControlsText}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tipsText && (
              <div className="rounded-2xl bg-[#EAE5FA]/60 border border-[#DFD7F8] p-4 sm:p-5 space-y-2">
                <h4 className="font-display text-lg font-bold text-[#4B3D8F] flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Useful Tips</span>
                </h4>
                <p className="text-sm sm:text-base text-[#2B3445] leading-relaxed whitespace-pre-line break-words">
                  {tipsText}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
