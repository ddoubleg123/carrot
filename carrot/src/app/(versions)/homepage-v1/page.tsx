import Link from 'next/link';
import { FaCarrot } from 'react-icons/fa';
import '@fontsource/poppins/700.css';
import '@fontsource/dm-sans/400.css';

export default function HomepageV1() {
  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
        {/* Hero Section */}
        <section className="relative flex flex-col items-center justify-center text-center py-20 md:py-28 bg-gradient-to-b from-[#FFF8F2] to-[#F5F5F2] rounded-3xl shadow-md mb-24 overflow-hidden">
          {/* Subtle logo background */}
          <div className="absolute inset-0 flex justify-center items-center opacity-10 pointer-events-none select-none z-0">
            <span className="text-[18rem] md:text-[24rem] text-primary">🥕</span>
          </div>
          <div className="relative z-10">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-secondary font-sans tracking-tight drop-shadow-md">
              Turn Public Pressure Into Real Change.
            </h1>
            <p className="text-xl text-secondary-light mb-10 max-w-2xl mx-auto font-sans">
              Propose a Commitment. Rally support. Reward action—or hold leaders accountable.
            </p>
            <div className="flex justify-center">
              <Link 
                href="/commitments/new" 
                className="rounded-full bg-primary hover:bg-accent text-white text-lg px-10 py-4 font-semibold transition-colors shadow-xl border-2 border-[#F47C23]"
              >
                <span className="mr-2">🥕</span> Create a Commitment
              </Link>
            </div>
          </div>
        </section>

        {/* Commitment Feed Preview */}
        <section className="mb-24">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-secondary font-sans text-center">Popular Commitments</h2>
          <div className="flex gap-8 overflow-x-auto pb-6 px-1 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible">
            {/* Commitment Card 1 */}
            <div className="min-w-[320px] bg-white rounded-2xl shadow-xl p-7 flex flex-col gap-3 border border-background hover:scale-105 transition-transform duration-200 mx-auto md:mx-0">
              <div className="flex items-center gap-2 mb-1"><FaCarrot className="text-primary text-xl" /> <span className="font-bold text-lg">End Foreign Aid to Israel</span></div>
              <div className="text-xs text-secondary-light">432 signed | ZIPs: 90210, 30303</div>
              <div className="flex items-center gap-2 text-sm"><span className="text-primary">🍊 Carrot:</span> I will vote for you</div>
              <div className="flex items-center gap-2 text-sm"><span className="text-accent">🔴 Stick:</span> I will vote against you</div>
            </div>
            {/* Commitment Card 2 */}
            <div className="min-w-[320px] bg-white rounded-2xl shadow-xl p-7 flex flex-col gap-3 border border-background hover:scale-105 transition-transform duration-200 mx-auto md:mx-0">
              <div className="flex items-center gap-2 mb-1"><FaCarrot className="text-primary text-xl" /> <span className="font-bold text-lg">Enact Ranked-Choice Voting</span></div>
              <div className="text-xs text-secondary-light">211 signed | Top ZIPs: 10001, 78704</div>
              <div className="flex items-center gap-2 text-sm"><span className="text-primary">🍊 Carrot:</span> I'll volunteer for your reelection</div>
              <div className="flex items-center gap-2 text-sm"><span className="text-accent">🔴 Stick:</span> I'll join a PAC to unseat you</div>
            </div>
            {/* Commitment Card 3 */}
            <div className="min-w-[320px] bg-white rounded-2xl shadow-xl p-7 flex flex-col gap-3 border border-background hover:scale-105 transition-transform duration-200 mx-auto md:mx-0">
              <div className="flex items-center gap-2 mb-1"><FaCarrot className="text-primary text-xl" /> <span className="font-bold text-lg">Protect Abortion Rights in Georgia</span></div>
              <div className="text-xs text-secondary-light">1,004 signed | ZIPs: 30342, 30306</div>
              <div className="flex items-center gap-2 text-sm"><span className="text-primary">🍊 Carrot:</span> I'll bring three friends to vote</div>
              <div className="flex items-center gap-2 text-sm"><span className="text-accent">🔴 Stick:</span> I'll organize a protest in your district</div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="mb-24 bg-background py-16 px-2 rounded-3xl shadow-inner">
          <h2 className="text-2xl md:text-3xl font-bold mb-10 text-secondary font-sans text-center">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="card p-8 rounded-2xl shadow-lg bg-white flex flex-col items-center border border-background">
              <div className="text-4xl mb-4">✏️</div>
              <h3 className="text-xl font-semibold mb-2 font-sans text-secondary">Write a Commitment</h3>
              <p className="text-secondary-light text-center">Craft your ask and choose carrot & stick options.</p>
            </div>
            <div className="card p-8 rounded-2xl shadow-lg bg-white flex flex-col items-center border border-background">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="text-xl font-semibold mb-2 font-sans text-secondary">People Join In</h3>
              <p className="text-secondary-light text-center">Supporters add their voices and ZIPs, building momentum.</p>
            </div>
            <div className="card p-8 rounded-2xl shadow-lg bg-white flex flex-col items-center border border-background">
              <div className="text-4xl mb-4">📣</div>
              <h3 className="text-xl font-semibold mb-2 font-sans text-secondary">Collective Leverage</h3>
              <p className="text-secondary-light text-center">Public tallies and maps drive accountability and action.</p>
            </div>
          </div>
        </section>

        {/* Privacy Notice */}
        <section className="mb-24 flex items-center justify-center">
          <div className="flex items-center gap-4 bg-background rounded-2xl px-8 py-5 shadow-md border border-background">
            <span className="text-2xl">🔒</span>
            <span className="text-secondary font-medium">Your full address stays private. Only your ZIP and screen name are public.</span>
          </div>
        </section>

        {/* Call-to-Action Footer */}
        <footer className="text-center py-16 border-t border-background bg-white rounded-2xl shadow-lg mt-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-secondary font-sans">Build pressure. Claim your power. Start a Commitment today.</h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-4">
            <Link 
              href="/commitments/new" 
              className="rounded-full bg-primary hover:bg-accent text-white px-8 py-3 font-semibold transition-colors shadow-lg"
            >
              <span className="mr-2">🔶</span> Create Now
            </Link>
            <Link 
              href="/commitments" 
              className="rounded-full border-2 border-[#1F2C3A] text-secondary hover:bg-background px-8 py-3 font-semibold transition-colors"
            >
              <span className="mr-2">🔍</span> Browse by Issue
            </Link>
          </div>
          <div className="text-secondary-light text-sm mt-2">No campaign donations. No full addresses. People-powered, not PAC-driven.</div>
        </footer>
      </main>
    </>
  );
}
