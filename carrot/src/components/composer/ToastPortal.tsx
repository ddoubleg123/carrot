import React from 'react';
import Toast from '../../app/(app)/dashboard/components/Toast';
import { useComposer } from './ComposerContext';

interface ToastPortalProps {
  isVisible?: boolean;
  message?: string;
  type?: 'success' | 'error' | 'info';
  onClose?: () => void;
}

export default function ToastPortal(props: ToastPortalProps) {
  let { isVisible, message, type, onClose } = props;
  try {
    const ctx = useComposer();
    if (typeof isVisible === 'undefined') isVisible = ctx.showToast;
    if (typeof message === 'undefined') message = ctx.toastMessage;
    if (typeof type === 'undefined') type = ctx.toastType;
    if (typeof onClose === 'undefined') onClose = () => ctx.setShowToast(false);
  } catch {}

  if (!isVisible) return null;
  return (
    <Toast
      message={message!}
      type={type!}
      isVisible={isVisible}
      onClose={onClose!}
    />
  );
}
