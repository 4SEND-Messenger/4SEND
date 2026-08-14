export interface ContactItem {
  username: string;
  displayName?: string;
  avatar?: string;
  isVerified?: boolean;
  lastText?: string;
  lastSender?: string;
  lastSenderDisplay?: string;
  timestamp?: Date | string;
  unreadCount?: number;
  is_pinned?: boolean;
  is_muted?: boolean;
  is_archived?: boolean;
  is_blocked_me?: boolean;
  i_blocked_him?: boolean;
  isRoom?: boolean;
  roomType?: 'group' | 'channel';
  roomOwner?: string;
  lastIsAudio?: boolean;
  lastIsMusic?: boolean;
  lastIsVideoNote?: boolean;
  lastFileUrl?: string;
  lastFileName?: string;
  copyRestriction?: boolean;
  forwardRestriction?: boolean;
  screenshotNotification?: boolean;
  autoDeleteTimer?: number;
  lastCallType?: string;
  lastCallDuration?: number;
  lastCallWithVideo?: boolean;
  isLastMessageRead?: boolean;
  online?: boolean;
  last_seen?: Date | string | null;
  isOnline?: boolean;
  memberCount?: number;
  isSecret?: boolean;
  previousText?: string | null;
}

export interface AuthState {
  me: string | null;
  token: string | null;
  displayName: string | null;
  avatar: string | null;
  isVerified: boolean;
  role: string;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
  twoFactorPassword?: string;
  termsAccepted?: boolean;
}

export interface RegisterData extends LoginCredentials {
  username: string;
  password: string;
  termsAccepted: boolean;
}