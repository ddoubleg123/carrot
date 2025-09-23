import { cn } from '@/lib/utils';

// Card component styles following design system
export const cardStyles = {
  base: "rounded-2xl border border-[#E6E8EC] bg-white shadow-sm",
  padding: "p-4 sm:p-6", // 16-24px padding
  hover: "hover:shadow-md transition-shadow duration-180",
  interactive: "hover:shadow-md transition-all duration-180 cursor-pointer",
} as const;

// Card variants
export const cardVariants = {
  default: cn(cardStyles.base, cardStyles.padding),
  interactive: cn(cardStyles.base, cardStyles.padding, cardStyles.interactive),
  compact: cn(cardStyles.base, "p-4"), // 16px padding for compact cards
  sidebar: cn(cardStyles.base, "p-4"), // Sidebar cards
} as const;

// Section heading styles
export const sectionHeading = "text-lg font-semibold text-[#0B0B0F] mb-4";

// Badge styles
export const badgeStyles = {
  primary: "bg-[#0A5AFF] text-white text-xs px-2 py-1 rounded-md",
  secondary: "bg-[#E6E8EC] text-[#60646C] text-xs px-2 py-1 rounded-md",
  endingSoon: "bg-[#FF6A00] text-white text-xs px-2 py-1 rounded-md",
  tag: "bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full",
} as const;
