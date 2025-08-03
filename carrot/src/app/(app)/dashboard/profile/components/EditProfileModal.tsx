'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { XMarkIcon, PhotoIcon, UserIcon, MapPinIcon, EnvelopeIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

type UserProfile = {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  avatar: string | null;
  banner: string | null;
  bio: string;
  location: string;
};

type EditProfileModalProps = {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<UserProfile>) => void;
};

export default function EditProfileModal({ user, isOpen, onClose, onSave }: EditProfileModalProps) {
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    name: user.name,
    bio: user.bio,
    location: user.location,
    avatar: user.avatar,
    banner: user.banner,
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar);
  const [bannerPreview, setBannerPreview] = useState<string | null>(user.banner);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        setFormData(prev => ({
          ...prev,
          avatar: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
        setFormData(prev => ({
          ...prev,
          banner: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Edit Profile</h3>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Banner Upload */}
              <div className="mb-4">
                <div className="relative h-40 bg-gray-100 rounded-lg overflow-hidden">
                  {bannerPreview ? (
                    <Image
                      src={bannerPreview}
                      alt="Banner preview"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <PhotoIcon className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      className="bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 px-4 py-2 rounded-full text-sm font-medium flex items-center"
                    >
                      <PhotoIcon className="h-4 w-4 mr-2" />
                      {bannerPreview ? 'Change cover photo' : 'Add cover photo'}
                    </button>
                    <input
                      type="file"
                      ref={bannerInputRef}
                      onChange={handleBannerChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">Recommended size: 1500x500px</p>
              </div>

              {/* Avatar Upload */}
              <div className="flex -mt-16 pl-4">
                <div className="relative">
                  <div className="h-32 w-32 rounded-full border-4 border-white bg-white shadow-lg relative">
                    {avatarPreview ? (
                      <Image
                        src={avatarPreview}
                        alt="Profile preview"
                        fill
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 rounded-full flex items-center justify-center">
                        <UserIcon className="h-16 w-16 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-2 -right-2 bg-primary text-white p-2 rounded-full hover:bg-primary-dark transition-colors"
                  >
                    <PhotoIcon className="h-4 w-4" />
                  </button>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="name"
                      id="name"
                      value={formData.name || ''}
                      onChange={handleInputChange}
                      className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                    Bio
                  </label>
                  <div className="mt-1">
                    <textarea
                      id="bio"
                      name="bio"
                      rows={3}
                      value={formData.bio || ''}
                      onChange={handleInputChange}
                      className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border border-gray-300 rounded-md"
                      placeholder="Tell others about yourself..."
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                    Location
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPinIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                      type="text"
                      name="location"
                      id="location"
                      value={formData.location || ''}
                      onChange={handleInputChange}
                      className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                      placeholder="City, Country"
                    />
                  </div>
                </div>

                {/* Read-only fields */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center text-sm text-gray-500">
                    <EnvelopeIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <span>{user.email}</span>
                    <a 
                      href="/dashboard/settings" 
                      className="ml-2 text-primary hover:text-primary-dark text-sm font-medium"
                    >
                      Change
                    </a>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-500">
                    <DevicePhoneMobileIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <span>{user.phone || 'Not provided'}</span>
                    <a 
                      href="/dashboard/settings" 
                      className="ml-2 text-primary hover:text-primary-dark text-sm font-medium"
                    >
                      {user.phone ? 'Change' : 'Add'}
                    </a>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-500">
                    <UserIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <span>@{user.username}</span>
                    <a 
                      href="/dashboard/settings" 
                      className="ml-2 text-primary hover:text-primary-dark text-sm font-medium"
                    >
                      Change
                    </a>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  To update your username, email, or phone, go to Account Settings
                </p>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
