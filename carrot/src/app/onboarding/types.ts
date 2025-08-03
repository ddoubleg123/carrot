export type DraftImage = {
  assetId: string;
  storagePath: string;
  uploadState: "uploading" | "done" | "canceled";
  rev: number;
  superseded?: boolean;
};

export type OnboardingDraft = {
  step: 1 | 2 | 3;
  image?: DraftImage;
  data: Record<string, any>;
  draftStatus?: "open" | "closed";
  updatedAt: any; // FirebaseFirestore.FieldValue
  closedAt?: any; // FirebaseFirestore.FieldValue
};
