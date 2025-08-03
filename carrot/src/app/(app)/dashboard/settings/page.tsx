'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { Session } from 'next-auth';
// Custom hook to handle toast functionality
const useToast = () => {
  const [toastModule, setToastModule] = useState<any>(null);

  useEffect(() => {
    const loadToast = async () => {
      try {
        const module = await import('react-hot-toast');
        setToastModule(module.default);
      } catch (error) {
        console.error('Failed to load react-hot-toast:', error);
        // Fallback implementation
        setToastModule({
          success: console.log,
          error: console.error,
          loading: console.log,
          dismiss: () => {},
          promise: (promise: Promise<any>) => promise
        });
      }
    };

    loadToast();
  }, []);

  return toastModule || {
    success: console.log,
    error: console.error,
    loading: console.log,
    dismiss: () => {},
    promise: (promise: Promise<any>) => promise
  };
};
import { 
  SettingsLayout, 
  AccountInformation, 
  NotificationPreferences, 
  PrivacySettings 
} from './components';

// Extend the default session type to include our custom fields
type ExtendedUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  username?: string;
  phone?: string;
  bio?: string;
  location?: string;
};

type ExtendedSession = Session & {
  user: ExtendedUser;
};

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [activeTab, setActiveTab] = useState('account');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    username: '',
    phone: '',
    bio: '',
    location: '',
  });
  
  // Use the custom toast hook
  const toast = useToast();

  // Initialize form data from session
  useEffect(() => {
    if (session?.user) {
      const user = session.user as ExtendedUser;
      setFormData({
        fullName: user.name || '',
        email: user.email || '',
        username: user.username || '',
        phone: user.phone || '',
        bio: user.bio || '',
        location: user.location || '',
      });
    }
  }, [session]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear any previous save errors when user types
    if (saveError) {
      setSaveError('');
    }
  };
  
  const handleUsernameChange = async (username: string) => {
    if (!session) return { success: false, message: 'Not authenticated' };
    
    setIsSaving(true);
    setSaveError('');
    
    try {
      // TODO: Replace with actual API call to update username
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock success response - in a real app, this would be an API call
      const success = Math.random() > 0.2; // 80% success rate for demo
      
      if (success) {
        // Update session with new username
        await update({
          ...session,
          user: {
            ...session.user,
            username
          }
        });
        
        toast.success('Username updated successfully');
        return { success: true };
      } else {
        throw new Error('Failed to update username. Please try again.');
      }
    } catch (error) {
      console.error('Error updating username:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while updating your username';
      setSaveError(errorMessage);
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate form data
      if (!formData.fullName.trim()) {
        throw new Error('Full name is required');
      }
      if (!formData.username.trim()) {
        throw new Error('Username is required');
      }
      if (!formData.email.trim()) {
        throw new Error('Email is required');
      }

      // Update the session with the new data
      const updatedSession = await update({
        ...session,
        user: {
          ...session?.user,
          name: formData.fullName,
          username: formData.username,
          email: formData.email,
          phone: formData.phone,
          bio: formData.bio,
          location: formData.location,
        },
      });

      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700">Please sign in to view settings</p>
        </div>
      </div>
    );
  }

  return (
    <SettingsLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {activeTab === 'account' && (
          <AccountInformation 
            formData={formData} 
            onInputChange={handleInputChange}
            onUsernameChange={handleUsernameChange}
            isSaving={isSaving}
            saveError={saveError}
            setSaveError={setSaveError}
          />
        )}
        
        {activeTab === 'notifications' && (
          <NotificationPreferences />
        )}
        
        {activeTab === 'privacy' && (
          <PrivacySettings />
        )}
        
        {/* Save button for all forms except username which has its own save */}
        {activeTab !== 'account' && (
          <div className="pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={isSaving}
              className={`px-4 py-2 rounded-md text-sm font-medium text-white ${
                isSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </form>
    </SettingsLayout>
  );
}
