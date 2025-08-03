import React from 'react';

interface ProgressHeaderProps {
  step: number;
  totalSteps: number;
}

export const ProgressHeader: React.FC<ProgressHeaderProps> = ({ step, totalSteps }) => {
  const percent = Math.round((step / totalSteps) * 100);
  return (
    <div className="w-full flex flex-col items-start mb-6">
      <div className="text-xs text-gray-500 mb-1 font-medium">
        Step {step} of {totalSteps} · {percent}%
      </div>
      <div
        className="w-full h-1 rounded bg-gray-200 overflow-hidden"
        aria-label="Progress bar"
        aria-valuenow={step}
        aria-valuemax={totalSteps}
        aria-valuemin={1}
        role="progressbar"
      >
        <div
          className="h-full bg-[#FF7A18] transition-all duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressHeader;
