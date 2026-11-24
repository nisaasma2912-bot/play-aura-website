const CLICK_SOUND_SRC = '/assets/sounds/button-click.wav';

let sharedAudio: HTMLAudioElement | null = null;

/**
 * Plays the supplied button click WAV sound effect on explicit user clicks.
 * Prevents overlapping playback and fails silently if browser autoplay policy
 * or missing audio prevents playback.
 */
export function playButtonClickSound(): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    return;
  }

  try {
    if (!sharedAudio) {
      sharedAudio = new Audio(CLICK_SOUND_SRC);
      sharedAudio.preload = 'auto';
      sharedAudio.volume = 0.65;
    }

    if (!sharedAudio.paused) {
      sharedAudio.pause();
    }
    sharedAudio.currentTime = 0;

    const playPromise = sharedAudio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Respect browser audio restrictions cleanly without breaking UI
      });
    }
  } catch {
    // Graceful no-op if audio playback is unavailable
  }
}
