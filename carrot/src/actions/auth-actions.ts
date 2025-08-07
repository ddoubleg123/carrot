'use server';

// import { signOut } from '../config/auth';
import { redirect } from 'next/navigation';

export async function signOutAction() {
  try {
    // TODO: Implement signOut logic or integrate with correct auth provider
    // await signOut({ redirect: false });
    // Force a hard redirect to ensure the session is cleared
    redirect('/login');
  } catch (error) {
    console.error('Error during sign out:', error);
    // If redirect fails, throw the error to be handled by the client
    throw error;
  }
}
