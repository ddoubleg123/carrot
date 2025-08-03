import React from 'react';

interface StepperBarProps {
  currentStep: number;
  totalSteps: number;
}

export function StepperBar({ currentStep, totalSteps }: StepperBarProps) {
  const percent = Math.round((currentStep / totalSteps) * 100);
  return (
    <div className="w-full flex flex-col items-center px-6 pt-4 pb-4" style={{ minHeight: 48 }}>
      <div className="text-sm font-medium text-gray-600 mb-2">
        Step {currentStep} of {totalSteps}
      </div>
      <div
        className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden"
        aria-label="Progress bar"
        aria-valuenow={currentStep}
        aria-valuemax={totalSteps}
        aria-valuemin={1}
        role="progressbar"
      >
        <div
          className="h-full bg-[#FF7A18] rounded-full transition-all duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default StepperBar;
