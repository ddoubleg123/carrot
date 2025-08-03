'use client';

import { PlusIcon } from '@heroicons/react/24/solid';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CreateCommitmentModal from './CreateCommitmentModal';

export default function CreateCommitmentButton() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleSubmit = async (data: { commitment: string; carrotText: string; stickText: string }) => {
    try {
      // Call your API endpoint to create a new commitment
      const response = await fetch('/api/commitments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create commitment');
      }

      // Close the modal and refresh the page to show the new commitment
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      console.error('Failed to create commitment:', error);
      // You might want to show an error message to the user here
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 lg:hidden p-4 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark transition-colors z-40"
        aria-label="Create new commitment"
      >
        <PlusIcon className="h-6 w-6" />
      </button>
      
      <CreateCommitmentModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
