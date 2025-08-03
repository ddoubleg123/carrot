import '@/lib/firebase';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Carrot',
  description: 'A social platform for civic engagement and accountability',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.png" sizes="48x48" type="image/png" />
      </head>
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <SessionProvider>
        {children}
      </SessionProvider>
      </body>
    </html>
  );
}
