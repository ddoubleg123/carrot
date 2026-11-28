import MinimalNav from '@/components/MinimalNav';
import Messenger from '@/components/messaging/Messenger';

export default function MessagesPage() {
  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50">
      <aside className="hidden h-screen w-20 shrink-0 border-r border-gray-200 bg-gray-50 sm:block">
        <MinimalNav />
      </aside>
      <Messenger />
    </div>
  );
}
