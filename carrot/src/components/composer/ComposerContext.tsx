import React, { createContext, useContext, PropsWithChildren } from 'react';

export interface ComposerContextValue {
  // Toasts
  showToast: boolean;
  toastMessage: string;
  toastType: 'success' | 'error' | 'info';
  setShowToast: (v: boolean) => void;
  // Audio recorder visibility
  showAudioRecorder: boolean;
  setShowAudioRecorder: (v: boolean) => void;
}

const ComposerContext = createContext<ComposerContextValue | undefined>(undefined);

export function useComposer(): ComposerContextValue {
  const ctx = useContext(ComposerContext);
  if (!ctx) throw new Error('useComposer must be used within a ComposerProvider');
  return ctx;
}

interface ComposerProviderProps extends PropsWithChildren<{}> {
  value: ComposerContextValue;
}

export function ComposerProvider({ children, value }: ComposerProviderProps) {
  return (
    <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>
  );
}
