export default function FundsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-orange-600">Carrots</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">Funds</h1>
        <p className="mt-1 text-sm text-gray-500">What you earn on Carrot will collect here.</p>
      </header>
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-4xl font-semibold text-gray-900">0</p>
        <p className="mt-1 text-sm text-gray-500">carrots available</p>
        <p className="mt-6 max-w-md text-sm leading-6 text-gray-600">
          Likes, posts, and patches still count. Moving carrots into a balance you can use is the next piece, and this page is where that balance will live.
        </p>
      </div>
    </div>
  );
}
