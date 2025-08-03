'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface CreateCommitmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { commitment: string; carrotText: string; stickText: string }) => void;
}

export default function CreateCommitmentModal({ isOpen, onClose, onSubmit }: CreateCommitmentModalProps) {
  const [commitment, setCommitment] = useState('');
  const [carrotText, setCarrotText] = useState('');
  const [stickText, setStickText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitment.trim() || !carrotText.trim() || !stickText.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        commitment: commitment.trim(),
        carrotText: carrotText.trim(),
        stickText: stickText.trim()
      });
      // Reset form
      setCommitment('');
      setCarrotText('');
      setStickText('');
      onClose();
    } catch (error) {
      console.error('Error creating commitment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Create a Commitment</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={isSubmitting}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="commitment" className="block text-sm font-medium text-gray-700 mb-1">
              Commitment
            </label>
            <div className="mt-1">
              <textarea
                id="commitment"
                rows={3}
                className="shadow-sm focus:ring-primary focus:border-primary mt-1 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
                placeholder="What commitment do you want to propose?"
                value={commitment}
                onChange={(e) => setCommitment(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label htmlFor="carrot" className="block text-sm font-medium text-gray-700 mb-1">
              Carrot (Positive Incentive)
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="carrot"
                className="shadow-sm focus:ring-green-500 focus:border-green-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
                placeholder="What's the positive outcome?"
                value={carrotText}
                onChange={(e) => setCarrotText(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <p className="mt-1 text-xs text-green-600">Example: "I will vote for you."</p>
          </div>

          <div>
            <label htmlFor="stick" className="block text-sm font-medium text-gray-700 mb-1">
              Stick (Consequence)
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="stick"
                className="shadow-sm focus:ring-red-500 focus:border-red-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
                placeholder="What's the consequence if not met?"
                value={stickText}
                onChange={(e) => setStickText(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <p className="mt-1 text-xs text-red-600">Example: "I will vote against you."</p>
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
              disabled={isSubmitting || !commitment.trim() || !carrotText.trim() || !stickText.trim()}
            >
              {isSubmitting ? 'Posting...' : 'Post Commitment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
