'use client';
import { useEffect } from 'react';

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Hide the header when component mounts
    const header = document.querySelector('header');
    if (header) {
      header.style.display = 'none';
    }
    
    // Cleanup function to show header again when component unmounts
    return () => {
      if (header) {
        header.style.display = '';
      }
    };
  }, []);

  return (
    <div className="login-layout">
      <style jsx global>{`
        /* Ensure the main content takes full height */
        main {
          min-height: 100vh;
          padding: 0 !important;
          margin: 0 !important;
        }
        
        /* Reset any padding/margin on the body */
        body {
          margin: 0;
          padding: 0;
        }
      `}</style>
      {children}
    </div>
  );
}
