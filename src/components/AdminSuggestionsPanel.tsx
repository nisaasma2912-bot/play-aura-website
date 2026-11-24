import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  CheckCircle2,
  Eye,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  blockSuggestionVisitorAdmin,
  deleteSuggestionAdmin,
  fetchAllSuggestionsWithRepliesAdmin,
  fetchBlockedSuggestionVisitorsAdmin,
  isSupabaseConfigured,
  markSuggestionReadAdmin,
  sendAdminSuggestionReply,
  unblockSuggestionVisitorAdmin,
  updateSuggestionStatusAdmin,
} from '../lib/supabase';
import type {
  AdminUserSession,
  BlockedSuggestionVisitorRecord,
  GameSuggestionRecord,
  SuggestionStatus,
} from '../types/game';

interface AdminSuggestionsPanelProps {
  session: AdminUserSession;
  onNewCountChange?: (newCount: number) => void;
}

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  archived: 'Archived',
};

const REPLY_MAX_LENGTH = 2000;

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function AdminSuggestionsPanel({
  session,
  onNewCountChange,
}: AdminSuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<GameSuggestionRecord[]>([]);
  const [blockedVisitors, setBlockedVisitors] = useState<BlockedSuggestionVisitorRecord[]>([]);
  const [messagingSupported, setMessagingSupported] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [subTab, setSubTab] = useState<'suggestions' | 'blocked'>('suggestions');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | SuggestionStatus>('all');
  const [searchText, setSearchText] = useState('');

  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const [deletingSuggestion, setDeletingSuggestion] = useState<GameSuggestionRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const [suggestionsResult, blockedRows] = await Promise.all([
        fetchAllSuggestionsWithRepliesAdmin(),
        fetchBlockedSuggestionVisitorsAdmin(),
      ]);
      setSuggestions(suggestionsResult.suggestions);
      setMessagingSupported(suggestionsResult.messagingSupported);
      setBlockedVisitors(blockedRows);
      setSelectedSuggestionId((prev) =>
        prev && suggestionsResult.suggestions.some((s) => s.id === prev) ? prev : null
      );
      onNewCountChange?.(
        suggestionsResult.suggestions.filter((s) => s.status === 'new' || !s.adminReadAt).length
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load suggestions right now.');
    } finally {
      setLoading(false);
    }
  }, [onNewCountChange]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    onNewCountChange?.(
      suggestions.filter((s) => s.status === 'new' || !s.adminReadAt).length
    );
  }, [suggestions, onNewCountChange]);

  const blockedHashSet = useMemo(
    () => new Set(blockedVisitors.map((b) => b.visitorTokenHash)),
    [blockedVisitors]
  );

  const selectedSuggestion = useMemo(
    () => suggestions.find((s) => s.id === selectedSuggestionId) || null,
    [suggestions, selectedSuggestionId]
  );

  const filteredSuggestions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return suggestions.filter((s) => {
      if (statusFilter === 'unread') {
        if (s.adminReadAt !== null && s.status !== 'new') return false;
      } else if (statusFilter !== 'all' && s.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const replyMatch = s.replies.some((r) => r.body.toLowerCase().includes(q));
      return (
        s.message.toLowerCase().includes(q) ||
        s.visitorTokenHash.toLowerCase().includes(q) ||
        replyMatch
      );
    });
  }, [suggestions, statusFilter, searchText]);

  const unreadMessagesCount = useMemo(
    () => suggestions.filter((s) => !s.adminReadAt).length,
    [suggestions]
  );

  const unreadVisitorRepliesCount = useMemo(
    () =>
      suggestions.reduce(
        (sum, s) =>
          sum + s.replies.filter((r) => r.senderType === 'admin' && !r.visitorReadAt).length,
        0
      ),
    [suggestions]
  );

  const handleOpenConversation = async (item: GameSuggestionRecord) => {
    setSelectedSuggestionId(item.id);
    setSubTab('suggestions');
    setReplyError(null);

    if (messagingSupported && !item.adminReadAt) {
      try {
        const readAt = await markSuggestionReadAdmin(item.id);
        if (readAt) {
          setSuggestions((prev) =>
            prev.map((row) =>
              row.id === item.id ? { ...row, adminReadAt: row.adminReadAt || readAt } : row
            )
          );
        }
      } catch {
        // Non-blocking read mark error
      }
    }
  };

  const handleStatusUpdate = async (item: GameSuggestionRecord, nextStatus: SuggestionStatus) => {
    setBusyId(item.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateSuggestionStatusAdmin(item.id, nextStatus);
      setSuggestions((prev) =>
        prev.map((row) =>
          row.id === updated.id
            ? {
                ...updated,
                replies: row.replies,
                adminReadAt: updated.adminReadAt ?? row.adminReadAt,
              }
            : row
        )
      );
      setNotice(`Marked suggestion as ${STATUS_LABEL[nextStatus]}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update suggestion status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSendReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSuggestion || sendingReply) return;

    const currentDraft = replyDrafts[selectedSuggestion.id] || '';
    if (!currentDraft.trim()) {
      setReplyError('Please enter a reply message before sending.');
      return;
    }

    setSendingReply(true);
    setReplyError(null);
    setError(null);
    setNotice(null);

    try {
      const result = await sendAdminSuggestionReply(selectedSuggestion.id, currentDraft);
      setSuggestions((prev) =>
        prev.map((row) => {
          if (row.id !== selectedSuggestion.id) return row;
          const alreadyHasReply = row.replies.some((r) => r.id === result.reply.id);
          return {
            ...row,
            status: result.suggestionStatus,
            adminReadAt: row.adminReadAt || result.adminReadAt,
            replies: alreadyHasReply ? row.replies : [...row.replies, result.reply],
          };
        })
      );
      setReplyDrafts((prev) => ({ ...prev, [selectedSuggestion.id]: '' }));
      setNotice(`Reply sent to Visitor #${selectedSuggestion.visitorTokenHash.slice(0, 8)}.`);
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Could not send reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSuggestion) return;
    setBusyId(deletingSuggestion.id);
    setError(null);
    setNotice(null);
    try {
      await deleteSuggestionAdmin(deletingSuggestion.id);
      setSuggestions((prev) => prev.filter((row) => row.id !== deletingSuggestion.id));
      if (selectedSuggestionId === deletingSuggestion.id) {
        setSelectedSuggestionId(null);
      }
      setDeletingSuggestion(null);
      setNotice('Deleted suggestion conversation.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete suggestion.');
    } finally {
      setBusyId(null);
    }
  };

  const handleBlockVisitor = async (visitorTokenHash: string) => {
    setBusyId(visitorTokenHash);
    setError(null);
    setNotice(null);
    try {
      const blocked = await blockSuggestionVisitorAdmin(
        visitorTokenHash,
        session.userId,
        'Blocked from Admin Suggestions moderation'
      );
      setBlockedVisitors((prev) => {
        const filtered = prev.filter((b) => b.visitorTokenHash !== blocked.visitorTokenHash);
        return [blocked, ...filtered];
      });
      setNotice(`Blocked anonymous visitor #${visitorTokenHash.slice(0, 8)} from future suggestions.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not block visitor.');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnblockVisitor = async (visitorTokenHash: string) => {
    setBusyId(visitorTokenHash);
    setError(null);
    setNotice(null);
    try {
      await unblockSuggestionVisitorAdmin(visitorTokenHash);
      setBlockedVisitors((prev) =>
        prev.filter((b) => b.visitorTokenHash !== visitorTokenHash)
      );
      setNotice(`Unblocked anonymous visitor #${visitorTokenHash.slice(0, 8)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unblock visitor.');
    } finally {
      setBusyId(null);
    }
  };

  const currentDraftValue = selectedSuggestion ? replyDrafts[selectedSuggestion.id] || '' : '';

  return (
    <div className="space-y-6">
      {/* Real Suggestion & Messaging Counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[24px] bg-[#FAF5E8] border border-[#EAE3CE] p-5">
          <div className="text-xs font-bold text-[#5A657A]">Total Messages</div>
          <div className="font-display text-3xl font-bold text-[#2B3445] mt-1 tabular-nums">
            {suggestions.length}
          </div>
        </div>
        <div className="rounded-[24px] bg-[#D8F3E5]/60 border border-[#BFEAD6] p-5">
          <div className="text-xs font-bold text-[#1D6B52]">Unread Messages</div>
          <div className="font-display text-3xl font-bold text-[#2B3445] mt-1 tabular-nums">
            {unreadMessagesCount}
          </div>
        </div>
        <div className="rounded-[24px] bg-[#DDF0FC]/65 border border-[#CBE7FA] p-5">
          <div className="text-xs font-bold text-[#1E5B8A]">Unread Replies (Visitor)</div>
          <div className="font-display text-3xl font-bold text-[#2B3445] mt-1 tabular-nums">
            {unreadVisitorRepliesCount}
          </div>
        </div>
        <div className="rounded-[24px] bg-[#EAE5FA]/65 border border-[#DFD7F8] p-5">
          <div className="text-xs font-bold text-[#4B3D8F]">Blocked Visitors</div>
          <div className="font-display text-3xl font-bold text-[#2B3445] mt-1 tabular-nums">
            {blockedVisitors.length}
          </div>
        </div>
      </div>

      {!messagingSupported && (
        <div
          role="status"
          className="rounded-2xl bg-[#FAF5E8] border border-[#CBE7FA] px-4 py-3 text-xs sm:text-sm font-semibold text-[#1E5B8A] flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Visitor messaging tables are not installed yet on Supabase. Run{' '}
            <code className="font-mono">supabase/migrations/20261122_visitor_messaging.sql</code> in
            your Supabase SQL Editor to enable admin replies, read receipts, and visitor notifications.
          </span>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-2xl bg-[#D8F3E5]/70 border border-[#8AD8B5] px-4 py-3 text-sm font-bold text-[#1D6B52] flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
            className="p-1 rounded-full hover:bg-white/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-[#FAF5E8] border border-[#C8BCF2] p-4 text-sm font-semibold text-[#4B3D8F] flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-[#4B3D8F] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main Suggestions & Conversation Management Card */}
      <div className="rounded-[28px] bg-white border-2 border-[#CBE7FA] p-4 sm:p-6 lg:p-7 bubble-shadow space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSubTab('suggestions')}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                subTab === 'suggestions'
                  ? 'bg-[#D8F3E5] text-[#1D6B52]'
                  : 'bg-[#FAF5E8] text-[#5A657A] hover:text-[#2B3445]'
              }`}
            >
              Suggestions ({suggestions.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('blocked')}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                subTab === 'blocked'
                  ? 'bg-[#EAE5FA] text-[#4B3D8F]'
                  : 'bg-[#FAF5E8] text-[#5A657A] hover:text-[#2B3445]'
              }`}
            >
              Blocked Visitors ({blockedVisitors.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="bubble-button inline-flex items-center justify-center gap-1.5 rounded-full bg-[#FAF5E8] hover:bg-[#DDF0FC] text-[#1E5B8A] px-4 py-2 text-xs font-bold cursor-pointer self-start lg:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh Conversations</span>
          </button>
        </div>

        {subTab === 'suggestions' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Clickable Visitor Messages List */}
            <div
              className={`lg:col-span-5 space-y-4 ${
                selectedSuggestion ? 'hidden lg:block' : 'block'
              }`}
            >
              {/* Filter & Search Bar */}
              <div className="space-y-3">
                <div
                  className="flex flex-wrap items-center gap-1 p-1 rounded-full bg-[#FAF5E8] border border-[#EAE3CE]"
                  role="tablist"
                  aria-label="Filter suggestions by status"
                >
                  {(['all', 'unread', 'new', 'reviewed', 'archived'] as const).map((st) => {
                    const active = statusFilter === st;
                    const label =
                      st === 'all' ? 'All' : st === 'unread' ? 'Unread' : STATUS_LABEL[st];
                    return (
                      <button
                        key={st}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                          active
                            ? 'bg-white text-[#1D6B52] shadow-sm'
                            : 'text-[#5A657A] hover:text-[#2B3445]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full">
                  <Search
                    className="w-4 h-4 text-[#5A657A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search messages, replies, visitor ID..."
                    aria-label="Filter suggestions by message text or visitor ID"
                    className="w-full rounded-full bg-[#FFFDF6] border-2 border-[#CBE7FA] pl-10 pr-4 py-2 text-xs sm:text-sm font-semibold text-[#2B3445] focus:outline-none focus:border-[#8AD8B5]"
                  />
                </div>
              </div>

              {loading && suggestions.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center gap-2 text-sm font-semibold text-[#5A657A]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#1E5B8A]" aria-hidden="true" />
                  <span>Loading game suggestions...</span>
                </div>
              ) : filteredSuggestions.length === 0 ? (
                <div className="rounded-[24px] bg-[#FAF5E8] p-7 text-center space-y-2">
                  <MessageSquareText
                    className="w-9 h-9 text-[#1E5B8A] mx-auto"
                    aria-hidden="true"
                  />
                  <p className="font-display text-lg font-bold text-[#2B3445]">
                    {suggestions.length === 0
                      ? 'No game suggestions yet'
                      : 'No messages match your filter'}
                  </p>
                  <p className="text-xs sm:text-sm text-[#5A657A] max-w-sm mx-auto">
                    {suggestions.length === 0
                      ? 'When visitors submit game ideas from the homepage Suggestion button, they will appear here.'
                      : 'Try clearing the search box or switching status filters above.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 lg:max-h-[680px] lg:overflow-y-auto lg:pr-1">
                  {filteredSuggestions.map((item) => {
                    const isBlocked = blockedHashSet.has(item.visitorTokenHash);
                    const isSelected = selectedSuggestionId === item.id;
                    const isUnreadMessage = item.adminReadAt === null;
                    const unreadReplyCount = item.replies.filter(
                      (r) => r.senderType === 'admin' && !r.visitorReadAt
                    ).length;
                    const rowBusy = busyId === item.id || busyId === item.visitorTokenHash;

                    return (
                      <div
                        key={item.id}
                        className={`rounded-[22px] border-2 p-3.5 transition-colors space-y-3 ${
                          isSelected
                            ? 'bg-[#EDF6FC] border-[#1E5B8A]'
                            : isUnreadMessage
                              ? 'bg-[#D8F3E5]/35 border-[#8AD8B5]'
                              : 'bg-[#FFFDF6] border-[#CBE7FA]/80 hover:border-[#8AC5F0]'
                        }`}
                      >
                        {/* Dedicated clickable button for message content (never nests action buttons) */}
                        <button
                          type="button"
                          onClick={() => void handleOpenConversation(item)}
                          className="w-full text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8AD8B5] cursor-pointer space-y-1.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold">
                            <span
                              className={
                                isUnreadMessage
                                  ? 'text-[#1D6B52]'
                                  : item.status === 'new'
                                    ? 'text-[#1D6B52]'
                                    : item.status === 'reviewed'
                                      ? 'text-[#1E5B8A]'
                                      : 'text-[#4B3D8F]'
                              }
                            >
                              {isUnreadMessage ? 'Unread message' : STATUS_LABEL[item.status]}
                            </span>

                            <span className="text-[#5A657A] font-semibold">
                              {formatTimestamp(item.createdAt)}
                            </span>
                          </div>

                          <p className="text-sm font-bold text-[#2B3445] line-clamp-2 break-words">
                            {item.message}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[#5A657A]">
                            <span className="font-mono text-[#2B3445]">
                              Visitor #{item.visitorTokenHash.slice(0, 8)}
                            </span>
                            {item.replies.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#1E5B8A] font-bold">
                                  {item.replies.length}{' '}
                                  {item.replies.length === 1 ? 'reply' : 'replies'}
                                  {unreadReplyCount > 0 ? ` (${unreadReplyCount} unread)` : ' (read)'}
                                </span>
                              </>
                            )}
                            {isBlocked && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-bold text-[#4B3D8F]">Blocked</span>
                              </>
                            )}
                          </div>
                        </button>

                        {/* Sibling action buttons (zero nesting) */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#EAE3CE]/80">
                          <button
                            type="button"
                            onClick={() => void handleOpenConversation(item)}
                            className="bubble-button inline-flex items-center gap-1 rounded-full bg-[#DDF0FC] hover:bg-[#CBE7FA] text-[#1E5B8A] px-3 py-1.5 text-xs font-bold cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>View</span>
                          </button>

                          {item.status !== 'archived' && (
                            <button
                              type="button"
                              disabled={rowBusy}
                              onClick={() => void handleStatusUpdate(item, 'archived')}
                              className="bubble-button inline-flex items-center gap-1 rounded-full bg-[#FAF5E8] hover:bg-[#EAE3CE] disabled:opacity-50 text-[#5A657A] px-3 py-1.5 text-xs font-bold cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Archive</span>
                            </button>
                          )}

                          {isBlocked ? (
                            <button
                              type="button"
                              disabled={rowBusy}
                              onClick={() => void handleUnblockVisitor(item.visitorTokenHash)}
                              className="bubble-button inline-flex items-center gap-1 rounded-full bg-[#D8F3E5] hover:bg-[#BFEAD6] disabled:opacity-50 text-[#1D6B52] px-3 py-1.5 text-xs font-bold cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Unblock Visitor</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={rowBusy}
                              onClick={() => void handleBlockVisitor(item.visitorTokenHash)}
                              className="bubble-button inline-flex items-center gap-1 rounded-full bg-[#EAE5FA] hover:bg-[#DFD7F8] disabled:opacity-50 text-[#4B3D8F] px-3 py-1.5 text-xs font-bold cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Block Visitor</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => setDeletingSuggestion(item)}
                            className="bubble-button inline-flex items-center gap-1 rounded-full bg-[#FAF5E8] hover:bg-[#EAE3CE] disabled:opacity-50 text-[#2B3445] px-3 py-1.5 text-xs font-bold cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Complete Conversation Detail & Admin Reply Panel */}
            <div
              className={`lg:col-span-7 ${
                selectedSuggestion ? 'block' : 'hidden lg:block'
              }`}
            >
              {selectedSuggestion ? (
                <div className="rounded-[26px] bg-[#FFFDF6] border-2 border-[#CBE7FA] p-4 sm:p-6 space-y-5">
                  {/* Conversation Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#EAE3CE]">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSuggestionId(null)}
                          className="lg:hidden bubble-button inline-flex items-center gap-1.5 rounded-full bg-white border border-[#CBE7FA] text-[#1E5B8A] px-3 py-1.5 text-xs font-bold cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>All Messages</span>
                        </button>
                        <h3 className="font-display text-lg sm:text-xl font-bold text-[#2B3445]">
                          Visitor #{selectedSuggestion.visitorTokenHash.slice(0, 8)}
                        </h3>
                        {blockedHashSet.has(selectedSuggestion.visitorTokenHash) && (
                          <span className="text-xs font-bold text-[#4B3D8F]">· Blocked</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[#5A657A]">
                        <span>Submitted {formatTimestamp(selectedSuggestion.createdAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#1D6B52]">
                          {selectedSuggestion.adminReadAt
                            ? `Opened ${formatTimestamp(selectedSuggestion.adminReadAt)}`
                            : 'Unread visitor message'}
                        </span>
                      </div>

                      <p className="font-mono text-[11px] text-[#5A657A] break-all">
                        Visitor ID: {selectedSuggestion.visitorTokenHash}
                      </p>
                    </div>

                    {/* Moderation Controls */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <label htmlFor="admin-conversation-status" className="sr-only">
                        Moderation status
                      </label>
                      <select
                        id="admin-conversation-status"
                        value={selectedSuggestion.status}
                        disabled={busyId === selectedSuggestion.id}
                        onChange={(e) =>
                          void handleStatusUpdate(
                            selectedSuggestion,
                            e.target.value as SuggestionStatus
                          )
                        }
                        className="rounded-full bg-white border-2 border-[#CBE7FA] px-3.5 py-1.5 text-xs font-bold text-[#2B3445] cursor-pointer"
                      >
                        <option value="new">New</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="archived">Archived</option>
                      </select>

                      {blockedHashSet.has(selectedSuggestion.visitorTokenHash) ? (
                        <button
                          type="button"
                          disabled={busyId === selectedSuggestion.visitorTokenHash}
                          onClick={() =>
                            void handleUnblockVisitor(selectedSuggestion.visitorTokenHash)
                          }
                          className="bubble-button inline-flex items-center gap-1 rounded-full bg-[#D8F3E5] hover:bg-[#BFEAD6] text-[#1D6B52] px-3 py-1.5 text-xs font-bold cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Unblock</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === selectedSuggestion.visitorTokenHash}
                          onClick={() =>
                            void handleBlockVisitor(selectedSuggestion.visitorTokenHash)
                          }
                          className="bubble-button inline-flex items-center gap-1 rounded-full bg-[#EAE5FA] hover:bg-[#DFD7F8] text-[#4B3D8F] px-3 py-1.5 text-xs font-bold cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Block</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeletingSuggestion(selectedSuggestion)}
                        className="bubble-button inline-flex items-center gap-1 rounded-full bg-[#FAF5E8] hover:bg-[#EAE3CE] text-[#2B3445] px-3 py-1.5 text-xs font-bold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Conversation Timeline */}
                  <div className="space-y-4">
                    {/* Complete Untruncated Original Visitor Message */}
                    <div className="rounded-[22px] bg-white border border-[#EAE3CE] p-4 sm:p-5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#5A657A]">
                        <span className="text-[#2B3445]">
                          Original Visitor Message (Visitor #{selectedSuggestion.visitorTokenHash.slice(0, 8)})
                        </span>
                        <span>{formatTimestamp(selectedSuggestion.createdAt)}</span>
                      </div>
                      <p className="text-sm sm:text-base font-semibold text-[#2B3445] whitespace-pre-wrap break-words leading-relaxed">
                        {selectedSuggestion.message}
                      </p>
                    </div>

                    {/* Previous Admin Replies in Chronological Order */}
                    {selectedSuggestion.replies.length === 0 ? (
                      <div className="rounded-2xl bg-[#FAF5E8]/80 border border-[#EAE3CE] px-4 py-3 text-xs sm:text-sm font-semibold text-[#5A657A]">
                        No replies sent yet. Write a reply below to send a notification directly to this visitor&apos;s inbox.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#5A657A] px-1">
                          Conversation Replies ({selectedSuggestion.replies.length})
                        </h4>
                        {selectedSuggestion.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="rounded-[22px] bg-[#D8F3E5]/45 border border-[#8AD8B5] p-4 space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                              <span className="text-[#1D6B52]">Play Aura Admin Reply</span>
                              <div className="flex flex-wrap items-center gap-2 text-[#5A657A]">
                                {reply.visitorReadAt ? (
                                  <span className="inline-flex items-center gap-1 text-[#1D6B52]">
                                    <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Read by visitor · {formatTimestamp(reply.visitorReadAt)}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[#1E5B8A]">
                                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Sent · Unread by visitor</span>
                                  </span>
                                )}
                                <span aria-hidden="true">·</span>
                                <span>{formatTimestamp(reply.createdAt)}</span>
                              </div>
                            </div>

                            <p className="text-sm sm:text-base font-semibold text-[#2B3445] whitespace-pre-wrap break-words leading-relaxed">
                              {reply.body}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Admin Reply Composer (supports multiple replies in the same conversation) */}
                  <form
                    onSubmit={handleSendReply}
                    className="pt-4 border-t border-[#EAE3CE] space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="admin-reply-input"
                        className="text-sm font-bold text-[#2B3445]"
                      >
                        Send a Reply to Visitor #{selectedSuggestion.visitorTokenHash.slice(0, 8)}
                      </label>
                      <span className="text-xs font-bold text-[#5A657A] tabular-nums">
                        {currentDraftValue.length} / {REPLY_MAX_LENGTH}
                      </span>
                    </div>

                    <textarea
                      id="admin-reply-input"
                      rows={4}
                      maxLength={REPLY_MAX_LENGTH}
                      value={currentDraftValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReplyDrafts((prev) => ({
                          ...prev,
                          [selectedSuggestion.id]: val,
                        }));
                        if (replyError) setReplyError(null);
                      }}
                      placeholder="Write your reply to this visitor..."
                      className="w-full rounded-2xl bg-white border-2 border-[#CBE7FA] px-4 py-3 text-sm font-semibold text-[#2B3445] placeholder:text-[#78849B] focus:outline-none focus:border-[#8AD8B5] resize-y min-h-[104px]"
                    />

                    {replyError && (
                      <div
                        role="alert"
                        className="rounded-xl bg-[#FAF5E8] border border-[#C8BCF2] px-3.5 py-2.5 text-xs font-bold text-[#4B3D8F] flex items-center gap-2"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{replyError}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-[#5A657A]">
                        Replies appear in this visitor&apos;s personal homepage notification inbox.
                      </p>
                      <button
                        type="submit"
                        disabled={sendingReply || !currentDraftValue.trim()}
                        className="bubble-button inline-flex items-center gap-2 rounded-full bg-[#BFEAD6] hover:bg-[#A9E0C6] disabled:opacity-55 text-[#1D6B52] px-5 py-2.5 text-sm font-bold cursor-pointer"
                      >
                        <Send className="w-4 h-4" aria-hidden="true" />
                        <span>{sendingReply ? 'Sending Reply...' : 'Send Reply'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="rounded-[26px] bg-[#FAF5E8]/80 border-2 border-dashed border-[#CBE7FA] p-10 text-center space-y-3">
                  <MessageSquareText
                    className="w-10 h-10 text-[#1E5B8A] mx-auto"
                    aria-hidden="true"
                  />
                  <h3 className="font-display text-xl font-bold text-[#2B3445]">
                    Select a visitor message
                  </h3>
                  <p className="text-sm text-[#5A657A] max-w-md mx-auto">
                    Click any visitor suggestion or its View button on the left to read the full message, inspect its conversation history, and send replies.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-sm font-semibold text-[#5A657A]">
            <Loader2 className="w-6 h-6 animate-spin text-[#1E5B8A]" aria-hidden="true" />
            <span>Loading blocked visitors...</span>
          </div>
        ) : blockedVisitors.length === 0 ? (
          <div className="rounded-[24px] bg-[#FAF5E8] p-8 text-center space-y-2">
            <ShieldCheck className="w-10 h-10 text-[#1D6B52] mx-auto" aria-hidden="true" />
            <p className="font-display text-lg font-bold text-[#2B3445]">
              No blocked visitors
            </p>
            <p className="text-sm text-[#5A657A] max-w-md mx-auto">
              Anonymous visitor hashes you block from suggestions will appear here and can be unblocked at any time.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EAE3CE]">
            {blockedVisitors.map((visitor) => (
              <div
                key={visitor.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-xs sm:text-sm font-bold text-[#2B3445] break-all">
                    {visitor.visitorTokenHash}
                  </p>
                  <p className="text-xs font-semibold text-[#5A657A]">
                    Blocked {formatTimestamp(visitor.createdAt)}
                    {visitor.reason ? ` · ${visitor.reason}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={busyId === visitor.visitorTokenHash}
                  onClick={() => void handleUnblockVisitor(visitor.visitorTokenHash)}
                  className="bubble-button inline-flex items-center gap-1.5 rounded-full bg-[#D8F3E5] hover:bg-[#BFEAD6] disabled:opacity-50 text-[#1D6B52] px-4 py-2 text-xs font-bold cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Unblock</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingSuggestion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Delete Suggestion"
          className="fixed inset-0 z-50 bg-[#EDF6FC]/90 backdrop-blur-sm p-4 flex items-center justify-center"
        >
          <div className="w-full max-w-sm rounded-[28px] bg-white border-2 border-[#CBE7FA] p-6 text-center bubble-shadow space-y-4">
            <h2 className="font-display text-xl font-bold text-[#2B3445]">
              Delete Suggestion?
            </h2>
            <p className="text-sm text-[#5A657A]">
              Are you sure you want to permanently remove this suggestion and any admin replies in this conversation? This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                disabled={busyId === deletingSuggestion.id}
                onClick={() => setDeletingSuggestion(null)}
                className="bubble-button rounded-full bg-[#FAF5E8] px-5 py-2.5 text-sm font-bold text-[#5A657A] cursor-pointer"
              >
                Keep
              </button>
              <button
                type="button"
                disabled={busyId === deletingSuggestion.id}
                onClick={() => void handleConfirmDelete()}
                className="bubble-button rounded-full bg-[#4B3D8F] text-[#FFFDF6] px-5 py-2.5 text-sm font-bold cursor-pointer"
              >
                {busyId === deletingSuggestion.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
