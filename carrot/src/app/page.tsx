import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
  
  // This return is a fallback and won't be reached due to the redirect
  return null;
}
