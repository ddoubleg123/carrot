'use client';

import CreateGroupWizard from '@/components/groups/CreateGroupWizard';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: GroupFormData) => Promise<void>;
}

interface GroupFormData {
  name: string;
  description: string;
  tags: string[];
  categories: string[];
}

export default function CreateGroupModal({ isOpen, onClose, onSubmit }: CreateGroupModalProps) {
  const handleSuccess = async (groupId: string) => {
    // For now, we'll call onSubmit with empty data since the wizard handles the form
    // In a real implementation, we'd pass the form data from the wizard
    await onSubmit({
      name: '',
      description: '',
      tags: [],
      categories: []
    });
  };

  return (
    <CreateGroupWizard
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={handleSuccess}
    />
  );
}