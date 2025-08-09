import { Inter } from 'next/font/google';
import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import ClientSessionProvider from './components/ClientSessionProvider';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Widgets from './components/Widgets';
import MobileNav from './components/MobileNav';
import CreateCommitmentButton from './components/CreateCommitmentButton';
import { cookies, headers as nextHeaders } from 'next/headers';
import './dashboard-layout.css';

const inter = Inter({ subsets: ['latin'] });

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  return (
    <ClientSessionProvider>
      <div className={`flex w-full max-w-[1400px] mx-auto px-4 sm:px-6 gap-6 ${inter.className}`}>
        {/* LEFT SIDEBAR */}
        <aside className="hidden sm:flex w-[220px] max-lg:w-[80px] flex-shrink-0 z-10">
          <Sidebar />
        </aside>

        {/* Mobile hamburger menu */}
        <button id="menuBtn" className="sm:hidden fixed left-4 top-3 z-50 bg-white p-2 rounded-md shadow-md" aria-label="Open menu">&#9776;</button>
        <aside className="drawer sm:hidden">
          <Sidebar />
        </aside>
        <div id="scrim" className="sm:hidden fixed inset-0 bg-black/30 z-40 hidden"></div>
        <script dangerouslySetInnerHTML={{__html:`
          const btn = document.getElementById('menuBtn');
          const drawer = document.querySelector('.drawer');
          const scrim = document.getElementById('scrim');
          const open = () => { drawer.style.transform = 'translateX(0)'; scrim.classList.remove('hidden'); document.body.style.overflow='hidden'; }
          const close = () => { drawer.style.transform = 'translateX(-100%)'; scrim.classList.add('hidden'); document.body.style.overflow=''; }
          btn?.addEventListener('click', open);
          scrim?.addEventListener('click', close);
        `}} />

        {/* CENTER FEED */}
        <main className="flex-1 w-full max-w-[680px] ml-0 sm:ml-[220px] max-lg:ml-[80px] z-0">
          {children}
        </main>

        {/* RIGHT SIDEBAR - Hidden below 1200px */}
        <aside className="hidden min-[1200px]:block w-[300px] flex-shrink-0 z-10">
          <Widgets />
        </aside>
      </div>
    </ClientSessionProvider>
  );
}
