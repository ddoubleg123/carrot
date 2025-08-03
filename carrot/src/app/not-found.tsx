// Custom 404 Not Found page for Next.js App Router
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F2] px-4">
      <h1 className="text-4xl font-bold text-[#1F2C3A] mb-4">404 – Page Not Found</h1>
      <p className="text-[#8B97A2] mb-6">Sorry, the page you are looking for does not exist.</p>
      <Link
        href="/"
        className="rounded-full bg-[#F47C23] hover:bg-[#E03D3D] text-white px-8 py-3 font-semibold transition-colors shadow-lg"
      >
        Go Home
      </Link>
    </div>
  );
}
