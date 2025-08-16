import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import TestDashboardClient from './components/TestDashboardClient';

export default async function TestDashboardPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/login');
  }

  return <TestDashboardClient />;
}
