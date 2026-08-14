export interface Room {
  roomId: string;
  name: string;
  description?: string;
  type: 'group' | 'channel';
  isPublic: boolean;
  publicLink?: string;
  owner: string;
  members: string[];
  joinRequests?: string[];
  avatar?: string;
  isVerified?: boolean;
  timestamp?: Date | string;
  copyRestriction?: boolean;
  autoDeleteTimer?: number;
  forwardRestriction?: boolean;
  screenshotNotification?: boolean;
  memberDetails?: RoomMember[];
  unreadCount?: number;
}

export interface RoomMember {
  username: string;
  displayName?: string;
  avatar?: string;
  isVerified?: boolean;
  isOwner?: boolean;
}

export interface CreateRoomData {
  name: string;
  description?: string;
  type: 'group' | 'channel';
  isPublic: boolean;
  publicLink?: string;
  avatar?: File;
}

export interface UpdateRoomData extends Partial<CreateRoomData> {
  roomId: string;
}

export interface RoomSettings {
  copyRestriction: boolean;
  forwardRestriction: boolean;
  screenshotNotification: boolean;
  autoDeleteTimer: number;
}

export interface JoinRequest {
  roomId: string;
  user: string;
  approve: boolean;
}