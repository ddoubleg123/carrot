export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-layout min-h-screen flex items-center justify-center">
      {children}
    </div>
  );
}
