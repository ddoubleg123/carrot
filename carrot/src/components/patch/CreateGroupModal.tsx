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
    // The group has already been created successfully by the wizard
    // We don't need to call onSubmit again - just close the modal
    console.log('[CreateGroupModal] Group created successfully, closing modal');
    onClose();
  };

  return (
    <CreateGroupWizard
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={handleSuccess}
    />
  );
}