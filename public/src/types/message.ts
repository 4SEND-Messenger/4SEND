export interface Message {
  id: string;
  tempId?: string;
  sender: string;
  receiver: string;
  text: string;
  fileUrl?: string;
  fileUrls?: string[];
  fileName?: string;
  isAudio?: boolean;
  isMusic?: boolean;
  isVideoNote?: boolean;
  reply_to?: string;
  reply_to_id?: string;
  expires_at?: Date | string | number;
  timestamp: Date | string;
  is_read?: boolean;
  read_by?: string[];
  is_edited?: boolean;
  isService?: boolean;
  callType?: 'missed' | 'rejected' | 'outgoing' | 'incoming' | null;
  callDuration?: number;
  callWithVideo?: boolean;
  is_encrypted?: boolean;
  e2ee_failed?: boolean;
  reactions?: Reaction[];
  senderAvatar?: string;
  displayName?: string;
  isVerified?: boolean;
  isSelf?: boolean;
  dialog_id?: string;
  last_notified?: Date | string;
  duration?: number;
  lastText?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
}