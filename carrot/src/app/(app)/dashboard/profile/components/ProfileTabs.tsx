'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { TabType, UserStats } from '../types';

interface ProfileTabsProps {
  userId: string;
  stats: UserStats;
  isCurrentUser: boolean;
}

interface TabItem {
  id: TabType;
  label: string;
  count: number;
}

export default function ProfileTabs({ userId, stats, isCurrentUser }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const pathname = usePathname();

  const tabs: TabItem[] = [
    { id: 'posts', label: 'Posts', count: 0 },
    { id: 'carrots', label: 'Carrots', count: stats.carrotsGiven },
    { id: 'sticks', label: 'Sticks', count: stats.sticksGiven },
  ];

  // Add Replies tab only for the current user
  if (isCurrentUser) {
    tabs.push({ id: 'replies', label: 'Replies', count: 0 });
  }

  const renderEmptyState = (message: string) => (
    <div className="py-12 text-center">
      <div className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true">
        <svg
          className="h-full w-full"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="mt-2 text-sm font-medium text-gray-900">No {message} yet</h3>
      <p className="mt-1 text-sm text-gray-500">
        Get started by creating a new {message === 'posts' ? 'post' : message}.
      </p>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'posts':
        return renderEmptyState('posts');
      case 'carrots':
        return renderEmptyState('carrots');
      case 'sticks':
        return renderEmptyState('sticks');
      case 'replies':
        return renderEmptyState('replies');
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  isActive
                    ? 'border-primary-500 text-primary-600 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-normal'
                } whitespace-nowrap py-4 px-1 border-b-2 text-base transition-colors duration-200`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="flex items-center">
                  <span className="relative top-px">{tab.label}</span>
                  {tab.count > 0 && (
                    <span 
                      className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        isActive 
                          ? 'bg-primary-100 text-primary-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {tab.count.toLocaleString()}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="py-6">
        {renderTabContent()}
      </div>
    </div>
  );
}
