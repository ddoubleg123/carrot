import { Timestamp } from 'firebase/firestore';

export interface UserDoc {
  email: string;
  username?: string;
  emailVerified: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  onboardingStatus: 'none' | 'in_progress' | 'complete';
  onboardingSessionId?: string;
  profile?: {
    displayName?: string;
    photoURL?: string;
    photoRev?: number;
  };
  preferences?: {
    topics?: string[];
    notifications?: {
      marketing?: boolean;
      product?: boolean;
    };
    timezone?: string;
  };
  _v: number;
}

export interface OnboardingSessionDoc {
  ownerId: string;
  status: 'active' | 'finished' | 'abandoned';
  currentStep: 'welcome' | 'account' | 'photo' | 'prefs' | 'review';
  completed: string[];
  required: string[];
  drafts?: {
    account?: {
      username?: string;
      displayName?: string;
    };
    prefs?: {
      topics?: string[];
      notifications?: { marketing?: boolean; product?: boolean };
      timezone?: string;
    };
  };
  staged: {
    hasProfilePhoto?: boolean;
  };
  rev: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt?: Timestamp;
  _v: number;
}

export interface StagedAssetDoc {
  ownerId: string;
  kind: 'profilePhoto' | 'document' | 'other';
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  uploadState: 'pending' | 'done' | 'failed';
  rev: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
