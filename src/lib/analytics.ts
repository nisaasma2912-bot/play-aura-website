import type { GameRecord } from '../types/game';
import { hasAnalyticsTrackingAllowed } from './consent';

function sendGtagEvent(eventName: string, params: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  if (!hasAnalyticsTrackingAllowed()) return;
  if (typeof window.gtag !== 'function') return;

  try {
    window.gtag('event', eventName, params);
  } catch {
    // Ignore analytics transport errors cleanly
  }
}

export function trackGameOpen(game: Pick<GameRecord, 'id' | 'title'>): void {
  if (!game.id || !game.title) return;
  sendGtagEvent('game_open', {
    game_name: game.title,
    game_id: game.id,
  });
}

export function trackGameClose(game: Pick<GameRecord, 'id' | 'title'>): void {
  if (!game.id || !game.title) return;
  sendGtagEvent('game_close', {
    game_name: game.title,
    game_id: game.id,
  });
}
