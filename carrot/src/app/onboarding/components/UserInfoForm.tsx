import React from 'react';

export interface UserInfoFormProps {
  values: Record<string, string>;
  errors: Record<string, string | undefined>;
  loading?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const UserInfoForm: React.FC<UserInfoFormProps> = ({ values, errors, loading, onChange }) => {
  return (
    <section className="w-full mb-8">
      <div className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-4">Your Info</div>
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex-1">
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={values.firstName || ''}
            onChange={onChange}
            className={`w-full h-11 px-4 border rounded-lg border-gray-300 focus:ring-2 focus:ring-[#FF7A18] focus:border-transparent bg-white text-gray-900 placeholder-gray-400 text-base transition ${errors.firstName ? 'border-red-500' : ''}`}
            placeholder="John"
            disabled={loading}
            aria-required="true"
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? 'firstNameError' : undefined}
            autoComplete="given-name"
          />
          {errors.firstName && <p id="firstNameError" className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
        </div>
        <div className="flex-1">
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={values.lastName || ''}
            onChange={onChange}
            className={`w-full h-11 px-4 border rounded-lg border-gray-300 focus:ring-2 focus:ring-[#FF7A18] focus:border-transparent bg-white text-gray-900 placeholder-gray-400 text-base transition ${errors.lastName ? 'border-red-500' : ''}`}
            placeholder="Doe"
            disabled={loading}
            aria-required="true"
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? 'lastNameError' : undefined}
            autoComplete="family-name"
          />
          {errors.lastName && <p id="lastNameError" className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
        </div>
      </div>
      {/* Add additional info fields here as needed */}
    </section>
  );
};

export default UserInfoForm;
