import React from 'react';

interface FooterActionsProps {
  count: number;
  disabled: boolean;
  isPosting: boolean;
  onCancel: () => void;
  onSubmitClick: () => void;
}

export default function FooterActions({ count, disabled, isPosting, onCancel, onSubmitClick }: FooterActionsProps) {
  return (
    <div className="flex items-center justify-between pt-2">
      <div className="text-sm text-gray-700">{count}/1000 characters</div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-full">Cancel</button>
        <button
          type="submit"
          onClick={onSubmitClick}
          disabled={disabled}
          className="px-6 py-2 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-full font-medium hover:from-orange-500 hover:to-red-600 disabled:opacity-50"
        >
          {isPosting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
}
