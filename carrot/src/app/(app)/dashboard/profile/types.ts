export interface UserStats {
  carrotsGiven: number;
  sticksGiven: number;
  followers: number;
  following: number;
}

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  avatar: string | null;
  banner: string | null;
  bio: string;
  location: string;
  joinDate: string;
  stats: UserStats;
  isCurrentUser: boolean;
}

export interface ProfileHeaderProps {
  user: UserProfile;
  isCurrentUser: boolean;
  onProfileUpdate?: (updatedProfile: Partial<UserProfile>) => void;
}

export interface ProfileTabsProps {
  userId: string;
  stats: UserStats;
  isCurrentUser: boolean;
}

export type TabType = 'posts' | 'carrots' | 'sticks' | 'replies';

export interface TabItem {
  id: TabType;
  label: string;
  count: number;
}

export interface EditProfileModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<UserProfile>) => void;
}
