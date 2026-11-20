export const SUGGESTION_MIN_LENGTH = 5;
export const SUGGESTION_MAX_LENGTH = 400;
export const SUGGESTION_COOLDOWN_MS = 60_000;

const LAST_SUBMIT_STORAGE_KEY = 'playaura_last_suggestion_at_v1';

const BLOCKED_TERMS_REGEX =
  /\b(?:fuck|shit|bitch|asshole|bastard|cunt|dick|pussy|whore|slut|nigger|faggot|kys|kill yourself|porn|xxx|nude|casino|viagra|crypto giveaway)\b/i;

const URL_PATTERN = /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|io|xyz|ru|cn|click|top)\b)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/;

export interface SuggestionValidationOutcome {
  valid: boolean;
  cleaned: string;
  error?: string;
}

export function normalizeSuggestionText(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function validateSuggestionInput(raw: string): SuggestionValidationOutcome {
  const cleaned = normalizeSuggestionText(raw);

  if (!cleaned) {
    return {
      valid: false,
      cleaned,
      error: 'Please write a short game idea before submitting.',
    };
  }

  if (cleaned.length < SUGGESTION_MIN_LENGTH) {
    return {
      valid: false,
      cleaned,
      error: `Please share a few more details (at least ${SUGGESTION_MIN_LENGTH} characters).`,
    };
  }

  if (cleaned.length > SUGGESTION_MAX_LENGTH) {
    return {
      valid: false,
      cleaned,
      error: `Suggestions must be ${SUGGESTION_MAX_LENGTH} characters or fewer.`,
    };
  }

  // Reject repetitive character flooding (e.g., "aaaaaaaaaa")
  if (/(.)\1{7,}/i.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: 'Please describe a real game idea without repeated spam characters.',
    };
  }

  if (EMAIL_PATTERN.test(cleaned) || PHONE_PATTERN.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error:
        'Please remove any email address, phone number, or personal details before sending your idea.',
    };
  }

  if (URL_PATTERN.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: 'Links and website addresses are not allowed in game suggestions.',
    };
  }

  if (BLOCKED_TERMS_REGEX.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: 'Please keep your game suggestion friendly and appropriate for all ages.',
    };
  }

  return { valid: true, cleaned };
}

export function getRemainingCooldownSeconds(nowMs = Date.now()): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(LAST_SUBMIT_STORAGE_KEY);
    if (!raw) return 0;
    const lastMs = Number(raw);
    if (!Number.isFinite(lastMs)) return 0;
    const elapsed = nowMs - lastMs;
    if (elapsed < 0 || elapsed >= SUGGESTION_COOLDOWN_MS) return 0;
    return Math.ceil((SUGGESTION_COOLDOWN_MS - elapsed) / 1000);
  } catch {
    return 0;
  }
}

export function recordSuggestionSubmissionTime(nowMs = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_SUBMIT_STORAGE_KEY, String(nowMs));
  } catch {
    // Ignore storage errors in restricted environments
  }
}
