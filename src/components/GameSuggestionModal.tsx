import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { playButtonClickSound } from '../lib/sound';
import { submitGameSuggestion } from '../lib/supabase';
import {
  SUGGESTION_MAX_LENGTH,
  validateSuggestionInput,
} from '../lib/suggestionValidation';
import { SUGGESTION_CUSTOM_ICON_SRC } from './FloatingSocialButtons';

interface GameSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GameSuggestionModal({ isOpen, onClose }: GameSuggestionModalProps) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 40);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, submitting]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    if (submitting) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    playButtonClickSound();
    setErrorMessage(null);
    setSuccessMessage(null);

    const validation = validateSuggestionInput(message);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Please enter a valid game suggestion.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitGameSuggestion(message);
      if (result.ok) {
        setSuccessMessage(result.message);
        setMessage('');
      } else {
        setErrorMessage(result.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const charCount = message.length;
  const nearLimit = charCount >= SUGGESTION_MAX_LENGTH - 40;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="suggestion-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      className="fixed inset-0 z-50 bg-[#EDF6FC]/85 backdrop-blur-md overflow-y-auto p-4 flex items-center justify-center"
    >
      <div className="w-full max-w-lg rounded-[32px] bg-white border-2 border-[#CBE7FA] p-6 sm:p-8 bubble-shadow my-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={SUGGESTION_CUSTOM_ICON_SRC}
              alt=""
              width={1293}
              height={1217}
              decoding="async"
              aria-hidden="true"
              className="w-11 h-11 object-contain shrink-0 select-none"
            />
            <div>
              <h2
                id="suggestion-modal-title"
                className="font-display text-2xl font-bold text-[#2B3445]"
              >
                Suggest a Game!
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Close game suggestion modal"
            className="w-10 h-10 rounded-full bg-[#FAF5E8] hover:bg-[#EAE5FA] text-[#2B3445] flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8AD8B5]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm sm:text-base text-[#5A657A] leading-relaxed">
          Tell us what kind of game you would love to see on Play Aura. Your idea may inspire our next game!
        </p>

        {/* Safety Notice */}
        <div className="rounded-2xl bg-[#FAF5E8] border border-[#EAE3CE] p-3.5 text-xs sm:text-sm font-semibold text-[#4B3D8F] flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#4B3D8F]" aria-hidden="true" />
          <span>
            Please do not include your name, email address, phone number, home address or other personal information.
          </span>
        </div>

        {successMessage ? (
          <div className="space-y-4">
            <div
              role="status"
              className="rounded-2xl bg-[#D8F3E5]/75 border border-[#8AD8B5] p-4 text-sm font-bold text-[#1D6B52] flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{successMessage}</span>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="bubble-button rounded-full bg-[#BFEAD6] hover:bg-[#A9E0C6] text-[#1D6B52] px-6 py-2.5 text-sm font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="game-suggestion-input"
                  className="block text-sm font-bold text-[#2B3445]"
                >
                  Game Idea
                </label>
                <span
                  aria-live="polite"
                  className={`text-xs font-bold tabular-nums ${
                    nearLimit ? 'text-[#4B3D8F]' : 'text-[#5A657A]'
                  }`}
                >
                  {charCount} / {SUGGESTION_MAX_LENGTH}
                </span>
              </div>
              <textarea
                ref={textareaRef}
                id="game-suggestion-input"
                rows={4}
                maxLength={SUGGESTION_MAX_LENGTH}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Describe the game you would like us to add..."
                className="w-full rounded-2xl bg-[#FFFDF6] border-2 border-[#CBE7FA] px-4 py-3 text-sm sm:text-base font-semibold text-[#2B3445] placeholder:text-[#78849B] focus:outline-none focus:border-[#8AD8B5] focus:ring-4 focus:ring-[#D8F3E5]/60 transition-all resize-y min-h-[112px]"
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-2xl bg-[#FAF5E8] border border-[#C8BCF2] p-3.5 text-xs sm:text-sm font-bold text-[#4B3D8F] flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={handleClose}
                className="bubble-button rounded-full bg-[#FAF5E8] hover:bg-[#EAE3CE] px-5 py-2.5 text-sm font-bold text-[#5A657A] cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bubble-button rounded-full bg-[#BFEAD6] hover:bg-[#A9E0C6] disabled:opacity-60 px-6 py-2.5 text-sm font-bold text-[#1D6B52] cursor-pointer min-h-[44px]"
              >
                {submitting ? 'Sending...' : 'Submit Suggestion'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
