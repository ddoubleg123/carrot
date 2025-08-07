// No layout needed - session is passed as props from server component
// Authentication is handled in the page.tsx server component
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
