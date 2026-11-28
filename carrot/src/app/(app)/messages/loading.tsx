export default function MessagesLoading() {
  return (
    <div className="flex h-dvh overflow-hidden bg-white">
      <aside className="hidden h-screen w-20 shrink-0 border-r border-gray-200 bg-gray-50 sm:block" />
      <div className="flex min-w-0 flex-1">
        <div className="flex w-full max-w-[380px] flex-col border-r border-gray-200 px-4 pt-4">
          <div className="grid grid-cols-2 rounded-full bg-gray-100 p-1 text-sm">
            <span className="rounded-full bg-white py-1.5 text-center font-medium text-gray-900 shadow-sm">Messages</span>
            <span className="py-1.5 text-center text-gray-500">Mail</span>
          </div>
          <p className="px-2 py-8 text-sm text-gray-400">Opening your messages.</p>
        </div>
        <div className="hidden flex-1 bg-[#f7f7f8] md:block" />
      </div>
    </div>
  )
}
