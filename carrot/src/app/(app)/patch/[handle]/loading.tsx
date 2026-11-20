export default function PatchLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="h-52 animate-pulse bg-gradient-to-r from-[#FF8A3D] to-[#FF5A7A]" />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="h-8 w-2/3 rounded bg-[#E7E5E4]" />
        <div className="mt-4 h-4 w-full rounded bg-[#F5F5F4]" />
        <div className="mt-2 h-4 w-5/6 rounded bg-[#F5F5F4]" />
      </div>
    </div>
  )
}
