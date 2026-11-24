export type GameStatus = 'draft' | 'published' | 'unpublished';

export interface GameRecord {
  id: string;
  title: string;
  slug: string;
  description: string;
  howToPlay?: string;
  objective?: string;
  keyboardControls?: string;
  mouseControls?: string;
  touchControls?: string;
  tips?: string;
  thumbnailUrl: string;
  gameEntryUrl: string;
  gameSrcDoc?: string;
  storagePath?: string | null;
  status: GameStatus;
  createdAt: string;
}

export interface ExtractedGameFile {
  relativePath: string;
  contentType: string;
  sizeBytes: number;
  data: Uint8Array;
}

export interface AssetSummary {
  html: number;
  scripts: number;
  styles: number;
  images: number;
  models3d: number;
  audio: number;
  video: number;
  fonts: number;
  data: number;
  other: number;
}

export interface ZipValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingDependencies: string[];
  entryPath: string | null;
  fileCount: number;
  totalSizeBytes: number;
  assetSummary: AssetSummary;
  files: ExtractedGameFile[];
}

export interface AdminUserSession {
  userId: string;
  email: string;
}

export type ActiveView =
  | 'home'
  | 'admin'
  | 'privacy-policy'
  | 'terms'
  | 'contact'
  | 'about'
  | 'disclaimer';

export type SuggestionStatus = 'new' | 'reviewed' | 'archived';

export type ReplySenderType = 'admin' | 'visitor';

export interface SuggestionReplyRecord {
  id: string;
  suggestionId: string;
  senderType: ReplySenderType;
  body: string;
  adminUserId?: string | null;
  visitorReadAt: string | null;
  createdAt: string;
}

export interface GameSuggestionRecord {
  id: string;
  message: string;
  visitorTokenHash: string;
  status: SuggestionStatus;
  createdAt: string;
  adminReadAt: string | null;
  replies: SuggestionReplyRecord[];
}

export interface VisitorConversationRecord {
  id: string;
  message: string;
  status: SuggestionStatus;
  createdAt: string;
  replyCount: number;
  unreadReplyCount: number;
  latestActivityAt: string;
  replies: SuggestionReplyRecord[];
}

export interface VisitorInboxData {
  supported: boolean;
  unreadCount: number;
  conversations: VisitorConversationRecord[];
}

export interface BlockedSuggestionVisitorRecord {
  id: string;
  visitorTokenHash: string;
  reason: string;
  createdAt: string;
  blockedBy: string | null;
}
