
let clickAudio: HTMLAudioElement | null = null;

export function playButtonClickSound(): void {
  if (typeof window === 'undefined') return;

  try {
    if (!clickAudio) {
      clickAudio = new Audio('/sounds/Button%20click%20sound.wav');
      clickAudio.preload = 'auto';
      clickAudio.volume = 0.35;
    }

    clickAudio.pause();
    clickAudio.currentTime = 0;

    void clickAudio.play().catch(() => {
      // Browser may block sound playback.
    });
  } catch {
    // Sound errors must not interrupt the website.
  }
}
