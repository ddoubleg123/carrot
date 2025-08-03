'use client';

// Using the correct import pattern for Heroicons v2
import { 
  ArrowTrendingUpIcon as TrendingUpIcon,
  MapPinIcon as MapIcon,
  ClockIcon 
} from '@heroicons/react/24/outline';

// Simple error message component
function ErrorMessage() {
  return (
    <div className="p-4 bg-red-50 text-red-700 rounded-lg">
      <p>Something went wrong loading this widget.</p>
    </div>
  );
}

// Helper component to safely render widgets with error boundaries
function SafeWidget({ children }: { children: React.ReactNode }) {
  try {
    return <>{children}</>;
  } catch (error) {
    console.error('Widget error:', error);
    return <ErrorMessage />;
  }
}

// Widget components
function TrendingWidget() {
  const trendingCommitments = [
    { id: 1, text: 'End foreign aid to Israel', carrotCount: 1243, stickCount: 321 },
    { id: 2, text: 'Universal basic income pilot', carrotCount: 892, stickCount: 145 },
    { id: 3, text: 'Term limits for Congress', carrotCount: 2103, stickCount: 87 },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center mb-4">
        <TrendingUpIcon className="h-5 w-5 text-primary mr-2" />
        <h2 className="font-semibold text-gray-900">Trending Commitments</h2>
      </div>
      <div className="space-y-4">
        {trendingCommitments.map((item) => (
          <div key={item.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
            <p className="text-sm text-gray-800 mb-2">{item.text}</p>
            <div className="flex justify-between text-xs text-gray-500">
              <span className="text-green-600">👍 {item.carrotCount} Carrots</span>
              <span className="text-red-600">👎 {item.stickCount} Sticks</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LocalActivityWidget() {
  const localCommitments = [
    { id: 1, text: 'New bike lanes downtown', zip: '10001', carrotCount: 42, stickCount: 3 },
    { id: 2, text: 'Renewable energy initiative', zip: '10001', carrotCount: 87, stickCount: 5 },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center mb-4">
        <MapIcon className="h-5 w-5 text-primary mr-2" />
        <h2 className="font-semibold text-gray-900">Local Activity</h2>
      </div>
      <div className="space-y-3">
        {localCommitments.map((item) => (
          <div key={item.id} className="text-sm">
            <p className="text-gray-800">{item.text}</p>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>ZIP: {item.zip}</span>
              <span className="flex items-center">
                <span className="text-green-600 mr-3">+{item.carrotCount}</span>
                <span className="text-red-600">-{item.stickCount}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpcomingVotesWidget() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center mb-4">
        <ClockIcon className="h-5 w-5 text-primary mr-2" />
        <h2 className="font-semibold text-gray-900">Upcoming Votes</h2>
      </div>
      <p className="text-sm text-gray-500">No upcoming votes in your area.</p>
    </div>
  );
}

export default function Widgets() {
  return (
    <div className="space-y-6">
      <SafeWidget>
        <TrendingWidget />
      </SafeWidget>
      
      <SafeWidget>
        <LocalActivityWidget />
      </SafeWidget>
      
      <SafeWidget>
        <UpcomingVotesWidget />
      </SafeWidget>
    </div>
  );
}
