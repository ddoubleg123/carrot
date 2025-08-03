'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function DangerZone() {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleLogoutAll = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement API call to invalidate all sessions
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Sign out from the current session
      await signOut({ redirect: false });
      
      // Redirect to login page
      router.push('/login');
    } catch (error) {
      console.error('Failed to log out all devices:', error);
      // TODO: Show error toast
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (confirmText.toLowerCase() !== 'deactivate') {
      // TODO: Show error toast
      return;
    }
    
    setIsLoading(true);
    try {
      // TODO: Implement account deactivation API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Sign out the user
      await signOut({ redirect: false });
      
      // Redirect to login page
      router.push('/login');
      // TODO: Show success toast
    } catch (error) {
      console.error('Failed to deactivate account:', error);
      // TODO: Show error toast
    } finally {
      setIsLoading(false);
      setShowDeactivateModal(false);
      setConfirmText('');
    }
  };

  const handleDelete = async () => {
    if (confirmText.toLowerCase() !== 'delete my account') {
      // TODO: Show error toast
      return;
    }
    
    setIsLoading(true);
    try {
      // TODO: Implement account deletion API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Sign out the user
      await signOut({ redirect: false });
      
      // Redirect to home page
      router.push('/');
      // TODO: Show success toast
    } catch (error) {
      console.error('Failed to delete account:', error);
      // TODO: Show error toast
    } finally {
      setIsLoading(false);
      setShowDeleteModal(false);
      setConfirmText('');
    }
  };

  return (
    <div className="bg-white shadow-sm rounded-lg border border-red-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-red-100 bg-red-50">
        <h2 className="text-lg font-medium text-red-800 flex items-center">
          <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
          Danger Zone
        </h2>
      </div>
      
      <div className="divide-y divide-red-100">
        {/* Log Out of All Devices */}
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="mb-4 sm:mb-0">
              <h3 className="text-sm font-medium text-gray-900">Log Out of All Devices</h3>
              <p className="mt-1 text-sm text-gray-500">
                This will log you out of all devices where you're currently signed in.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogoutAll}
              disabled={isLoading}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Logging out...' : 'Log Out Everywhere'}
            </button>
          </div>
        </div>

        {/* Deactivate Account (Temporary) */}
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="mb-4 sm:mb-0">
              <h3 className="text-sm font-medium text-gray-900">Deactivate Account</h3>
              <p className="mt-1 text-sm text-gray-500">
                Temporarily deactivate your account. You can reactivate it later by signing in again.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeactivateModal(true)}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Deactivate Account
            </button>
          </div>
        </div>

        {/* Delete Account Permanently */}
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="mb-4 sm:mb-0">
              <h3 className="text-sm font-medium text-red-800">Delete Account Permanently</h3>
              <p className="mt-1 text-sm text-red-700">
                This will permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Deactivate Account Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="text-center">
              <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-500" />
              <h3 className="mt-2 text-lg font-medium text-gray-900">Deactivate your account?</h3>
              <div className="mt-4 text-sm text-gray-500">
                <p>Your profile will be hidden, but your data will be preserved.</p>
                <p className="mt-2">Type <span className="font-mono bg-gray-100 px-2 py-1 rounded">deactivate</span> to confirm.</p>
              </div>
              <div className="mt-4">
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  placeholder="Type 'deactivate'"
                />
              </div>
              <div className="mt-5 sm:mt-6 space-y-3 sm:space-y-0 sm:space-x-3 sm:flex">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeactivateModal(false);
                    setConfirmText('');
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={isLoading || confirmText.toLowerCase() !== 'deactivate'}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${
                    confirmText.toLowerCase() === 'deactivate' && !isLoading
                      ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                      : 'bg-yellow-300 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? 'Deactivating...' : 'Deactivate Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="text-center">
              <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-600" />
              <h3 className="mt-2 text-lg font-medium text-gray-900">Delete your account?</h3>
              <div className="mt-4 text-sm text-gray-500">
                <p>This will permanently delete your account and all associated data.</p>
                <p className="mt-2 font-medium">This action cannot be undone.</p>
                <p className="mt-2">Type <span className="font-mono bg-gray-100 px-2 py-1 rounded">delete my account</span> to confirm.</p>
              </div>
              <div className="mt-4">
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                  placeholder="Type 'delete my account'"
                />
              </div>
              <div className="mt-5 sm:mt-6 space-y-3 sm:space-y-0 sm:space-x-3 sm:flex">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setConfirmText('');
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isLoading || confirmText.toLowerCase() !== 'delete my account'}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${
                    confirmText.toLowerCase() === 'delete my account' && !isLoading
                      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                      : 'bg-red-300 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? 'Deleting...' : 'Delete Account Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
