'use client';

// Modular right-rail cards
import CarrotsCard from './Widgets/CarrotsCard';
import TrendingTopicsCard from './Widgets/TrendingTopicsCard';
import NewConnectionsCard from './Widgets/NewConnectionsCard';
import WeekInReviewCard from './Widgets/WeekInReviewCard';

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

export default function Widgets() {
  return (
    <div className="space-y-6">
      <SafeWidget>
        <CarrotsCard />
      </SafeWidget>
      
      <SafeWidget>
        <TrendingTopicsCard />
      </SafeWidget>
      
      <SafeWidget>
        <NewConnectionsCard />
      </SafeWidget>

      <SafeWidget>
        <WeekInReviewCard />
      </SafeWidget>
    </div>
  );
}
