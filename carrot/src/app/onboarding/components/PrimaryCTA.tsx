import React from 'react';

interface PrimaryCTAProps {
  disabled?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  loading?: boolean;
  children: React.ReactNode;
}

export const PrimaryCTA: React.FC<PrimaryCTAProps> = ({ disabled, onClick, loading, children }) => (
  <button
    type="submit"
    className={`w-full mt-4 px-6 py-3 rounded-lg font-bold text-white bg-[#FF7A18] hover:bg-[#e06d1d] focus:ring-2 focus:ring-[#FF7A18] focus:ring-offset-2 transition disabled:bg-gray-300 disabled:cursor-not-allowed text-base`}
    disabled={disabled || loading}
    onClick={onClick}
    aria-disabled={disabled || loading}
  >
    {loading ? 'Saving...' : children}
  </button>
);

export default PrimaryCTA;
