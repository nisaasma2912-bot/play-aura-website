import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCheck,
  Clock,
  Loader2,
  MailOpen,
  MessageSquareText,
  RefreshCw,
  X,
} from 'lucide-react';
import { playButtonClickSound } from '../lib/sound';
import { NOTIFICATION_BELL_CUSTOM_ICON_SRC } from './FloatingSocialButtons';
import type { VisitorConversationRecord } from '../types/game';

interface VisitorInboxModalProps {
  isOpen: boolean;
  supported: boolean;
  loading: boolean;
  error: string | null;
  unreadCount: number;
  conversations: VisitorConversationRecord[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onOpenSuggestionModal: () => void;
  onMarkConversationRead: (suggestionId: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

const VISITOR_STATUS_LABEL: Record<VisitorConversationRecord['status'], string> = {
  new: 'Received',
  reviewed: 'Reviewed',
  archived: 'Archived',
};

export function VisitorInboxModal({
  isOpen,
  supported,
  loading,
  error,
  unreadCount,
  conversations,
  onClose,
  onRefresh,
  onOpenSuggestionModal,
  onMarkConversationRead,
  onMarkAllRead,
}: VisitorInboxModalProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [justReadReplyIds, setJustReadReplyIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!isOpen) {
      setSelectedConversationId(null);
      setJustReadReplyIds(new Set());
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedConversationId) {
          setSelectedConversationId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, selectedConversationId]);

  if (!isOpen) {
    return null;
  }

  const selectedConversation =
    selectedConversationId
      ? conversations.find((c) => c.id === selectedConversationId) || null
      : null;

  const handleSelectConversation = (conv: VisitorConversationRecord) => {
    playButtonClickSound();
    const newlyUnreadIds = conv.replies
      .filter((r) => r.senderType === 'admin' && !r.visitorReadAt)
      .map((r) => r.id);

    setJustReadReplyIds(new Set(newlyUnreadIds));
    setSelectedConversationId(conv.id);

    if (conv.unreadReplyCount > 0) {
      void onMarkConversationRead(conv.id);
    }
  };

  const handleMarkAll = async () => {
    if (markingAll || unreadCount === 0) return;
    playButtonClickSound();
    setMarkingAll(true);
    try {
      await onMarkAllRead();
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="visitor-inbox-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-[#EDF6FC]/85 backdrop-blur-md overflow-y-auto p-3 sm:p-5 flex items-center justify-center"
    >
      <div className="w-full max-w-2xl rounded-[32px] bg-white border-2 border-[#CBE7FA] p-5 sm:p-7 bubble-shadow my-4 flex flex-col max-h-[90dvh]">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EAE3CE] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {selectedConversation ? (
              <button
                type="button"
                onClick={() => {
                  playButtonClickSound();
                  setSelectedConversationId(null);
                  setJustReadReplyIds(new Set());
                }}
                aria-label="Back to notifications"
                className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#FAF5E8] hover:bg-[#D8F3E5] text-[#2B3445] hover:text-[#1D6B52] px-3.5 py-2 text-xs sm:text-sm font-bold shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Back</span>
              </button>
            ) : (
              <img
                src={NOTIFICATION_BELL_CUSTOM_ICON_SRC}
                alt=""
                width={1080}
                height={1057}
                decoding="async"
                aria-hidden="true"
                className="w-11 h-11 object-contain shrink-0 select-none"
              />
            )}

            <div className="min-w-0">
              <h2
                id="visitor-inbox-title"
                className="font-display text-xl sm:text-2xl font-bold text-[#2B3445] truncate"
              >
                {selectedConversation ? 'Message Conversation' : 'Your Notifications'}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#5A657A]">
                {selectedConversation
                  ? `Submitted ${formatDateTime(selectedConversation.createdAt)}`
                  : unreadCount > 0
                    ? 'You have unread replies from Play Aura'
                    : conversations.length > 0
                      ? 'Replies from Play Aura to your suggestions'
                      : 'Your personal suggestion inbox'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!selectedConversation && unreadCount > 0 && (
              <button
                type="button"
                disabled={markingAll}
                onClick={() => void handleMarkAll()}
                className="bubble-button hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#D8F3E5] hover:bg-[#BFEAD6] disabled:opacity-60 text-[#1D6B52] px-3.5 py-2 text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{markingAll ? 'Marking...' : 'Mark all read'}</span>
              </button>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                playButtonClickSound();
                void onRefresh();
              }}
              aria-label="Refresh notifications"
              title="Refresh notifications"
              className="w-10 h-10 rounded-full bg-[#FAF5E8] hover:bg-[#DDF0FC] text-[#1E5B8A] flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8AD8B5]"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="w-10 h-10 rounded-full bg-[#FAF5E8] hover:bg-[#EAE5FA] text-[#2B3445] flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8AD8B5]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto pt-4 space-y-4 pr-0.5">
          {!selectedConversation && unreadCount > 0 && (
            <div className="sm:hidden flex justify-end">
              <button
                type="button"
                disabled={markingAll}
                onClick={() => void handleMarkAll()}
                className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#D8F3E5] hover:bg-[#BFEAD6] disabled:opacity-60 text-[#1D6B52] px-3.5 py-2 text-xs font-bold cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{markingAll ? 'Marking...' : 'Mark all read'}</span>
              </button>
            </div>
          )}

          {error ? (
            <div
              role="alert"
              className="rounded-2xl bg-[#FAF5E8] border border-[#C8BCF2] p-4 text-sm font-semibold text-[#4B3D8F] flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => void onRefresh()}
                className="bubble-button rounded-full bg-white px-4 py-1.5 text-xs font-bold text-[#4B3D8F] cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : loading && conversations.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-sm font-semibold text-[#5A657A]">
              <Loader2 className="w-7 h-7 animate-spin text-[#1E5B8A]" aria-hidden="true" />
              <span>Checking your notifications...</span>
            </div>
          ) : !supported ? (
            <div className="rounded-[24px] bg-[#FAF5E8] border border-[#EAE3CE] p-6 text-center space-y-3">
              <MailOpen className="w-10 h-10 text-[#1E5B8A] mx-auto" aria-hidden="true" />
              <h3 className="font-display text-lg font-bold text-[#2B3445]">
                Notifications are getting ready
              </h3>
              <p className="text-sm text-[#5A657A] max-w-md mx-auto">
                The visitor reply inbox is not active on the database yet. You can still send game ideas anytime using the Suggest a Game button.
              </p>
            </div>
          ) : selectedConversation ? (
            /* Complete Conversation View */
            <div className="space-y-4">
              {/* Original Visitor Message */}
              <div className="rounded-[24px] bg-[#FAF5E8] border border-[#EAE3CE] p-4 sm:p-5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#5A657A]">
                  <span className="text-[#2B3445]">Your Original Suggestion</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{VISITOR_STATUS_LABEL[selectedConversation.status]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDateTime(selectedConversation.createdAt)}</span>
                  </div>
                </div>
                <p className="text-sm sm:text-base font-semibold text-[#2B3445] whitespace-pre-wrap break-words leading-relaxed">
                  {selectedConversation.message}
                </p>
              </div>

              {/* Chronological Admin Replies */}
              {selectedConversation.replies.length === 0 ? (
                <div className="rounded-[24px] bg-[#FFFDF6] border border-[#CBE7FA] p-5 text-center space-y-2">
                  <Clock className="w-6 h-6 text-[#1E5B8A] mx-auto" aria-hidden="true" />
                  <p className="text-sm font-bold text-[#2B3445]">No replies yet</p>
                  <p className="text-xs sm:text-sm text-[#5A657A]">
                    Your suggestion has been sent to the Play Aura team. When we reply, it will appear right here and highlight your notification bell.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#5A657A] px-1">
                    Replies ({selectedConversation.replies.length})
                  </h3>

                  {selectedConversation.replies.map((reply) => {
                    const isNew = !reply.visitorReadAt || justReadReplyIds.has(reply.id);
                    return (
                      <div
                        key={reply.id}
                        className={`rounded-[24px] border p-4 sm:p-5 space-y-2 transition-colors ${
                          isNew
                            ? 'bg-[#D8F3E5]/55 border-[#8AD8B5]'
                            : 'bg-[#DDF0FC]/45 border-[#CBE7FA]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                          <span className="text-[#1D6B52]">Play Aura Team</span>
                          <div className="flex flex-wrap items-center gap-2 text-[#5A657A]">
                            {isNew ? (
                              <span className="text-[#1D6B52] font-extrabold">New reply</span>
                            ) : (
                              <span>Read</span>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>{formatDateTime(reply.createdAt)}</span>
                          </div>
                        </div>

                        <p className="text-sm sm:text-base font-semibold text-[#2B3445] whitespace-pre-wrap break-words leading-relaxed">
                          {reply.body}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : conversations.length === 0 ? (
            /* Empty State */
            <div className="rounded-[24px] bg-[#FAF5E8] border border-[#EAE3CE] p-6 sm:p-8 text-center space-y-3">
              <MessageSquareText className="w-10 h-10 text-[#1E5B8A] mx-auto" aria-hidden="true" />
              <h3 className="font-display text-xl font-bold text-[#2B3445]">
                No notifications yet
              </h3>
              <p className="text-sm text-[#5A657A] max-w-md mx-auto leading-relaxed">
                When you send a game suggestion from this browser, your message and any replies from Play Aura will appear safely right here.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSuggestionModal();
                  }}
                  className="bubble-button rounded-full bg-[#BFEAD6] hover:bg-[#A9E0C6] text-[#1D6B52] px-6 py-2.5 text-sm font-bold cursor-pointer"
                >
                  Suggest a Game
                </button>
              </div>
            </div>
          ) : (
            /* Notifications / Conversations List */
            <div className="space-y-3">
              {conversations.map((conv) => {
                const latestReply =
                  conv.replies.length > 0 ? conv.replies[conv.replies.length - 1] : null;
                const hasUnread = conv.unreadReplyCount > 0;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-left rounded-[22px] border-2 p-4 sm:p-5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#8AD8B5] ${
                      hasUnread
                        ? 'bg-[#D8F3E5]/45 hover:bg-[#D8F3E5]/70 border-[#8AD8B5]'
                        : 'bg-[#FFFDF6] hover:bg-[#EDF6FC] border-[#CBE7FA]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold mb-1.5">
                      <span className={hasUnread ? 'text-[#1D6B52]' : 'text-[#1E5B8A]'}>
                        {hasUnread
                          ? 'New reply from Play Aura'
                          : latestReply
                            ? 'Play Aura replied'
                            : 'Sent · Waiting for reply'}
                      </span>

                      <span className="text-[#5A657A] font-semibold">
                        {formatDateTime(conv.latestActivityAt)}
                      </span>
                    </div>

                    {latestReply ? (
                      <div className="space-y-1.5">
                        <p className="text-sm sm:text-base font-bold text-[#2B3445] line-clamp-2 break-words">
                          {latestReply.body}
                        </p>
                        <p className="text-xs text-[#5A657A] line-clamp-1 break-words">
                          Your suggestion: &ldquo;{conv.message}&rdquo;
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm sm:text-base font-bold text-[#2B3445] line-clamp-2 break-words">
                        {conv.message}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
