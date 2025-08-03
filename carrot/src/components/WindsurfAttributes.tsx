'use client';

import { useEffect } from 'react';

export default function WindsurfAttributes() {
  useEffect(() => {
    // This runs only on the client side after hydration
    const html = document.documentElement;
    
    // Add Windsurf attributes if they don't exist
    if (!html.hasAttribute('data-windsurf-page-id')) {
      html.setAttribute('data-windsurf-page-id', crypto.randomUUID());
    }
    
    if (!html.hasAttribute('data-windsurf-extension-id')) {
      // This is a placeholder - in a real scenario, get this from the extension
      html.setAttribute('data-windsurf-extension-id', 'foefnacdoacilokpfgininpfjnmlfikg');
    }
    
    // Cleanup function to remove attributes when component unmounts
    return () => {
      html.removeAttribute('data-windsurf-page-id');
      html.removeAttribute('data-windsurf-extension-id');
    };
  }, []);

  return null; // This component doesn't render anything
}
