'use client';

import React, { useState, useEffect } from 'react';
import PhotoModal from '@/components/PhotoModal';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ProgressHeader from './ProgressHeader';
import ProfilePhotoRow from './ProfilePhotoRow';
import UserInfoForm from './UserInfoForm';
import PrimaryCTA from './PrimaryCTA';
import ProfilePhotoSetup from '@/components/enhanced/ProfilePhotoSetup';
import { CustomPhoneInput } from '@/components/CustomPhoneInput';
import { CountryCombobox } from '@/components/CountryCombobox';

// Types
export interface PersonalInfoData {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  country: string;
  zipCode: string;
  profilePhoto?: string | ArrayBuffer | null;
  profilePhotoBlob?: Blob;
}

interface PersonalInfoStepProps {
  onNext: (data: PersonalInfoData) => void;
  initialData?: Partial<PersonalInfoData>;
  loading?: boolean;
}

// --- RHF onBlur version with username check ---

import { useCallback } from "react";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { countries } from "@/lib/countries"; // [{ value:"US", label:"United States" }, ...]

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema (adjust messages/rules as needed)
const Schema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName:  z.string().trim().min(1, "Last name is required"),
  username:  z.string()
               .trim()
               .min(3, "Min 3 characters")
               .max(30, "Max 30 characters")
               .regex(/^[a-z0-9_]+$/i, "Use letters, numbers, underscores"),
  email:     z.string().email("Invalid email"),
  phone:     z.string().trim().min(7, "Phone number is required"),
  country:   z.string().min(1, "Country of residence is required"), // store ISO like "US"
  zip:       z.string().trim().min(2, "ZIP/Postal code is required"),
});
type FormData = z.infer<typeof Schema>;

// ─────────────────────────────────────────────────────────────────────────────
// Props
interface PersonalInfoStepProps {
  email: string;
  userId: string;
  initialData?: Partial<PersonalInfoData>;
  onNext: (data: PersonalInfoData) => void;
  loading?: boolean;
}

function PersonalInfoStep({
  email,
  userId,
  initialData,
  onNext,
  loading
}: PersonalInfoStepProps) {
  if (typeof window !== 'undefined') {
    console.log('[PersonalInfoStep] email prop:', email);
  }
  const [profilePhoto, setProfilePhoto] = useState<string | null>(typeof initialData?.profilePhoto === 'string' ? initialData.profilePhoto : null);
  const methods = useForm<FormData>({
    resolver: zodResolver(Schema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      username: initialData?.username || "",
      email: email || "",
      phone: initialData?.phone || "",
      country: initialData?.country || "", // "" shows placeholder; set "US" to preselect
      zip: initialData?.zipCode || "",
    },
  });

  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    getValues,
    formState: { errors, isSubmitting },
  } = methods;

  // ── username availability: ONLY on blur ────────────────────────────────────
  const [usernameStatus, setUsernameStatus] = useState<null | "available" | "taken" | "error">(null);

  const checkUsername = useCallback(async () => {
    const username = getValues("username").trim();
    if (!username) {
      setUsernameStatus(null);
      return; // schema will handle empty
    }
    try {
      const res = await fetch(`/api/username/check?u=${encodeURIComponent(username)}`);
      const json = await res.json();
      if (!json?.available) {
        setError("username", { type: "validate", message: "Username is taken" });
        setUsernameStatus("taken");
      } else {
        clearErrors("username");
        setUsernameStatus("available");
      }
    } catch {
      setError("username", { type: "validate", message: "Could not verify username" });
      setUsernameStatus("error");
    }
  }, [getValues, setError, clearErrors]);

  // ── submit ─────────────────────────────────────────────────────────────────
  const onSubmit = handleSubmit(async (data) => {
    // Map zip -> zipCode for PersonalInfoData
    const { zip, ...rest } = data;
    // Only pass profilePhoto if it's a string
    await onNext({ ...rest, zipCode: zip, profilePhoto: typeof profilePhoto === 'string' ? profilePhoto : null });
  });

  // ── field shell class (one-border pattern; your globals.css should remove inner borders) ──
  const shell = (hasError?: boolean) =>
    clsx(
      "field mt-1 h-11 rounded-lg border px-3 flex items-center",
      hasError
        ? "border-red-500 ring-1 ring-red-500/40"
        : "border-gray-300 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20"
    );

  const help = "mt-1 text-xs text-red-600";

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} className="space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-2 pt-2">Welcome to Carrot!</h2>
        <ProfilePhotoRow
              avatar={profilePhoto}
              onAvatarChange={setProfilePhoto}
              userId={userId}
            />
        {/* First / Last */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">First Name *</label>
            <div className={shell(!!errors.firstName)}>
              <input
                {...register("firstName")}
                className="w-full bg-transparent border-0 outline-none"
                placeholder="First Name"
                autoComplete="given-name"
              />
            </div>
            {errors.firstName && <p className={help}>{errors.firstName.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium">Last Name *</label>
            <div className={shell(!!errors.lastName)}>
              <input
                {...register("lastName")}
                className="w-full bg-transparent border-0 outline-none"
                placeholder="Last Name"
                autoComplete="family-name"
              />
            </div>
            {errors.lastName && <p className={help}>{errors.lastName.message}</p>}
          </div>
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium">Username *</label>
          <div className={shell(!!errors.username)}>
            <input
              {...register("username")}
              className="w-full bg-transparent border-0 outline-none"
              placeholder="Username"
              autoComplete="username"
              onBlur={checkUsername} // 👈 only on blur
            />
          </div>
          {errors.username && <p className={help}>{errors.username.message}</p>}
{/* Username availability status */}
{!errors.username && getValues("username") && usernameStatus === "available" && (
  <p className="mt-1 text-xs text-green-600">Username is available</p>
)}
{!errors.username && getValues("username") && usernameStatus === "taken" && (
  <p className="mt-1 text-xs text-red-600">Username is not available</p>
)}
{!errors.username && getValues("username") && usernameStatus === "error" && (
  <p className="mt-1 text-xs text-red-600">Could not verify username</p>
)}
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="block text-sm font-medium">Email</label>
          <div className={shell(false)}>
            <input
              {...register("email")}
              className="w-full bg-transparent border-0 outline-none text-gray-600"
              readOnly
              disabled
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">Email is managed by your login provider</p>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium">Phone Number *</label>
          <div className={shell(!!errors.phone)}>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <CustomPhoneInput
                  value={field.value}
                  onChange={field.onChange}
                  className="w-full"
                  error={!!errors.phone}
                  onBlur={field.onBlur}
                  // Default to US country code, but can be dynamic
                />
              )}
            />
          </div>
          {errors.phone && <p className={help}>{errors.phone.message}</p>}
        </div>

        {/* Country / ZIP */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            {/* Country Picker */}
<CountryCombobox
  name="country"
  control={control}
  label="Country *"
  placeholder="Select a country..."
  error={errors.country?.message}
/>
          </div>

          <div>
            <label className="block text-sm font-medium">ZIP / Postal Code *</label>
            <div className={shell(!!errors.zip)}>
              <input
                {...register("zip")}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="ZIP / Postal Code"
                className="w-full bg-transparent border-0 outline-none"
                onBlur={(e) => (e.currentTarget.value = e.currentTarget.value.trim())}
              />
            </div>
            {errors.zip && <p className={help}>{errors.zip.message}</p>}
          </div>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className={clsx(
              "h-11 w-full rounded-lg bg-orange-600 text-white font-semibold",
              isSubmitting && "opacity-60 cursor-not-allowed"
            )}
          >
            {isSubmitting ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
    </FormProvider>
  );
};

export default PersonalInfoStep;
