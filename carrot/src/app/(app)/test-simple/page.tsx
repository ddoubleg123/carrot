import { auth } from '../../../auth';
import { Suspense } from 'react';
import type { CommitmentCardProps } from '../dashboard/components/CommitmentCard';
import { redirect } from 'next/navigation';
import DashboardClient from '../dashboard/DashboardClient';
import ClientSessionProvider from '../dashboard/components/ClientSessionProvider';
import MinimalNav from '../../../components/MinimalNav';
import Widgets from '../dashboard/components/Widgets';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

// Server-side data fetching from database (exact copy of main dashboard)
async function getCommitments(): Promise<CommitmentCardProps[]> {
  // Beautiful fixed examples following design framework principles
  // Social Feed Module: async function getCommitments(): Promise<CommitmentCardProps[]> {
  return [
    {
      id: 'prototype-showcase',
      content: "🚀 Just launched our revolutionary AI-powered sustainability platform! After 18 months of development, we're finally ready to change how companies approach carbon neutrality.\n\nThe beta testing results have been incredible:\n• 89% reduction in energy waste\n• 67% decrease in carbon emissions\n• $2.3M saved across pilot programs\n\nSpecial thanks to my amazing team @alexchen @mariarodriguez and our incredible investors who believed in this vision from day one. This is just the beginning! 🌱💚",
      carrotText: '🏝️ All-expenses-paid retreat to Bali eco-resort + $15K sustainability bonus + Tesla Model Y',
      stickText: '🚫 No social media for 6 months + bike to work daily (rain or shine) + plant-based diet only',
      author: {
        name: 'Dr. Sarah Chen',
        username: 'sarahc',
        avatar: '/avatar-placeholder.svg',
        flag: '🇺🇸',
      },
      location: {
        zip: '10001',
        city: 'New York',
        state: 'NY',
      },
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      stats: { likes: 2847, comments: 312, reposts: 456, views: 28450 },
      userVote: null,
      emoji: '🚀',
      
      // Rich Media Content - Just image and text (realistic)
      imageUrls: [
        'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1200&q=85'
      ],
      
      // Beautiful Gradient Design - Enhanced sustainability theme
      gradientFromColor: '#10b981', // Emerald
      gradientToColor: '#3b82f6',   // Blue  
      gradientViaColor: '#06b6d4',  // Cyan
      gradientDirection: 'to-br',
      
      // Upload Status (simulating recent post)
      uploadStatus: 'ready',
      uploadProgress: 100,
    },
    {
      id: 'demo-2',
      content: "🤖 Launching AI that reads human emotions in real-time! Our breakthrough neural interface detects:\n\n• Micro-expressions (99.7% accuracy)\n• Voice pattern analysis\n• Biometric emotional signals\n• Real-time empathy mapping\n\nThis will revolutionize human-computer interaction forever. Beta testing starts next month! 🧠✨",
      carrotText: '🏎️ Tesla Model S Plaid + Big Sur luxury resort weekend + $25K tech bonus',
      stickText: '😴 Sleep 4 hours daily for 3 months + no weekends + cold showers only',
      author: {
        name: 'Marcus Johnson',
        username: 'mjohnson',
        avatar: '/avatar-placeholder.svg',
        flag: '🇺🇸',
      },
      location: {
        zip: '94102',
        city: 'San Francisco',
        state: 'CA',
      },
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      stats: { likes: 1834, comments: 267, reposts: 189, views: 15670 },
      userVote: null,
      emoji: '🤖',
      gradientFromColor: '#3b82f6',
      gradientToColor: '#1e3a8a',
      gradientViaColor: '#2563eb',
      gradientDirection: 'to-tr',
      innerBoxColor: 'bg-blue-50',
    },
    {
      id: 'demo-3',
      content: "✨ Creating the first quantum-powered design system! Imagine:\n\n🎨 Infinite color palettes that adapt to user mood\n🔄 Self-optimizing layouts based on usage patterns\n🧬 Components that evolve and learn from interactions\n🌈 Real-time aesthetic personalization\n\nThe future of design is here, and it's beautiful! Ready to break every design rule? 🚀",
      carrotText: '🎨 Month-long creative sabbatical in Tokyo + $75K art budget + gallery exhibition',
      stickText: '⌨️ Hand-code everything without frameworks + no design tools + pixel-perfect precision',
      author: {
        name: 'Elena Rodriguez',
        username: 'erodriguez',
        avatar: '/avatar-placeholder.svg',
        flag: '🇪🇸',
      },
      location: {
        zip: '02101',
        city: 'Boston',
        state: 'MA',
      },
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      stats: { likes: 2156, comments: 389, reposts: 298, views: 18920 },
      userVote: null,
      emoji: '✨',
      gradientFromColor: '#8b5cf6',
      gradientToColor: '#5b21b6',
      gradientViaColor: '#7c3aed',
      gradientDirection: 'to-bl',
      innerBoxColor: 'bg-purple-50',
    },
    {
      id: 'demo-4',
      content: "🚀 Building holographic collaboration spaces! The future of remote work:\n\n🌍 Virtual reality meets physical presence\n👋 Advanced haptic feedback (feel virtual handshakes!)\n🎧 Spatial audio that adapts to room acoustics\n🤝 Truly immersive teamwork experiences\n\nSay goodbye to Zoom fatigue forever! Who wants to beta test? 🎆",
      carrotText: '✈️ Private jet to Maldives + underwater hotel suite + $30K vacation budget',
      stickText: '🧑 Work standing up for 6 months + no coffee/energy drinks + meditation daily',
      author: {
        name: 'David Kim',
        username: 'dkim',
        avatar: '/avatar-placeholder.svg',
        flag: '🇰🇷',
      },
      location: {
        zip: '98101',
        city: 'Seattle',
        state: 'WA',
      },
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      stats: { likes: 1567, comments: 234, reposts: 178, views: 12890 },
      userVote: null,
      emoji: '🚀',
      gradientFromColor: '#f59e0b',
      gradientToColor: '#92400e',
      gradientViaColor: '#d97706',
      gradientDirection: 'to-r',
      innerBoxColor: 'bg-amber-50',
    },
    {
      id: 'demo-5',
      content: "⚡ Developing self-healing code architecture! Imagine code that:\n\n🤖 Writes and debugs itself autonomously\n🔒 Maintains perfect security at all times\n🚀 Optimizes performance in real-time\n🌌 Scales infinitely without breaking\n🔄 Evolves and adapts to new requirements\n\nThe end of bugs and technical debt is here! 🎉",
      carrotText: '🏠 Custom-built dream home studio + lifetime creative freedom + $100K equipment',
      stickText: '🐛 Debug legacy code 16 hours daily + mentor 50 junior devs + no Stack Overflow',
      author: {
        name: 'Alex Chen',
        username: 'alexchen',
        avatar: '/avatar-placeholder.svg',
        flag: '🇨🇦',
      },
      location: {
        zip: '78701',
        city: 'Austin',
        state: 'TX',
      },
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      stats: { likes: 2234, comments: 445, reposts: 367, views: 19750 },
      userVote: null,
      emoji: '⚡',
      gradientFromColor: '#ef4444',
      gradientToColor: '#991b1b',
      gradientViaColor: '#dc2626',
      gradientDirection: 'to-tl',
      innerBoxColor: 'bg-red-50',
    }
  ];
}

export default async function TestSimplePage() {
  const session = await auth();
  
  // Temporarily bypass authentication for testing gradient changes
  // if (!session) {
  //   redirect('/login');
  // }

  // Use our test data with gradients instead of database data
  const commitments = await getCommitments();

  return (
    <ClientSessionProvider>
      <Suspense fallback={
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      }>
        <div className={`min-h-screen flex ${inter.className}`}>
          {/* Left nav: fixed width, stays in-flow */}
          <aside className="w-20 shrink-0 sticky top-0 self-start h-screen bg-gray-50 border-r border-gray-200">
            <MinimalNav />
          </aside>

          {/* Main content area with feed and right rail */}
          <main className="flex-1 min-w-0 flex">
            {/* Feed column - positioned close to nav */}
            <div className="w-full min-w-[320px] max-w-[720px] px-6" style={{ marginTop: -20, paddingTop: 0 }}>

              <DashboardClient initialCommitments={commitments} isModalComposer={true} />
            </div>
            
            {/* Right rail / Third column */}
            <aside className="w-80 shrink-0 px-4 py-6">
              <Widgets />
            </aside>
          </main>
        </div>
      </Suspense>
    </ClientSessionProvider>
  );
}
