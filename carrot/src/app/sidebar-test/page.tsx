'use client';

import React from 'react';

// Mock icons for the vibrant sidebar test
const VibrantSidebarIcons = {
  Home: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#3B82F6"/>
      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 13l3-3 4 4" stroke="white" strokeWidth="1.5" fill="none"/>
    </svg>
  ),
  Search: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#10B981"/>
      <circle cx="11" cy="11" r="3" stroke="white" strokeWidth="1.5" fill="none"/>
      <path d="m21 21-4.35-4.35" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Notifications: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#EF4444"/>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke="white" strokeWidth="1.5" fill="none"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  CarrotPatch: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#F97316"/>
      <path d="M9 15c0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.66-1.34-3-3-3s-3 1.34-3 3z" fill="white"/>
      <path d="M11 9l1-2 1 2-1 1-1-1z" fill="#22C55E"/>
    </svg>
  ),
  Messages: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#8B5CF6"/>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" strokeWidth="1.5" fill="none"/>
    </svg>
  ),
  Rabbit: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#10B981"/>
      <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" fill="none"/>
      <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Funds: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#F59E0B"/>
      <line x1="12" y1="1" x2="12" y2="23" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Settings: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#6B7280"/>
      <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" fill="none"/>
      <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Logout: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="16,17 21,12 16,7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="21" y1="12" x2="9" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
};

const CarrotLogo = () => (
  <div className="flex items-center gap-2">
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#F97316"/>
      <path d="M9 15c0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.66-1.34-3-3-3s-3 1.34-3 3z" fill="white"/>
      <path d="M11 9l1-2 1 2-1 1-1-1z" fill="#22C55E"/>
    </svg>
    <span className="text-xl font-bold text-white">CARROT</span>
  </div>
);

export default function SidebarTest() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex w-full max-w-[1400px] mx-auto px-4 sm:px-6 gap-6">
        {/* VIBRANT SIDEBAR - Test Version */}
        <aside className="w-[220px] flex-shrink-0 sticky top-0 h-screen overflow-hidden">
          <div 
            className="flex flex-col h-screen w-full overflow-hidden relative"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}
          >
            {/* OBVIOUS Wave Animation Overlay */}
            <div className="absolute inset-0 z-0">
              {/* Wave Layer 1 - Very Visible */}
              <div 
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.3) 30%, transparent 60%)',
                  animation: 'waveFloat 4s ease-in-out infinite'
                }}
              />
              
              {/* Wave Layer 2 - Very Visible */}
              <div 
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 35%, transparent 65%)',
                  animation: 'waveDrift 5s ease-in-out infinite'
                }}
              />
              
              {/* Wave Layer 3 - Very Visible */}
              <div 
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 40%, transparent 70%)',
                  animation: 'waveFlow 6s ease-in-out infinite reverse'
                }}
              />
            </div>
            
            {/* CSS Keyframes - Added to document head */}
            <style dangerouslySetInnerHTML={{
              __html: `
                @keyframes testBounce {
                  0%, 100% { transform: translateY(0px) scale(1); }
                  50% { transform: translateY(-10px) scale(1.1); }
                }
                @keyframes waveFloat {
                  0%, 100% { transform: translateY(0px) translateX(0px); }
                  25% { transform: translateY(-15px) translateX(5px); }
                  50% { transform: translateY(-8px) translateX(-3px); }
                  75% { transform: translateY(-20px) translateX(2px); }
                }
                @keyframes waveDrift {
                  0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
                  33% { transform: translateY(-12px) translateX(-4px) rotate(1deg); }
                  66% { transform: translateY(-18px) translateX(3px) rotate(-0.5deg); }
                }
                @keyframes waveFlow {
                  0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
                  25% { transform: translateY(-10px) translateX(2px) rotate(0.5deg); }
                  50% { transform: translateY(-5px) translateX(-2px) rotate(-0.3deg); }
                  75% { transform: translateY(-15px) translateX(1px) rotate(0.2deg); }
                }
              `
            }} />
            
            {/* Top Section: Logo */}
            <div className="flex-shrink-0 px-4 pt-4">
              <div className="flex items-center justify-center py-3">
                <CarrotLogo />
              </div>
            </div>
            
            {/* Middle Section: Navigation */}
            <div className="flex-1 flex flex-col justify-between min-h-0 px-4">
              <nav className="flex-1">
                <div className="nav-section flex flex-col space-y-2">
                  {/* Home */}
                  <div className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-all duration-200 text-white font-medium text-[16px] cursor-pointer transform hover:scale-105">
                    <span className="icon flex-shrink-0"><VibrantSidebarIcons.Home /></span>
                    <span className="label">Home</span>
                  </div>
                  
                  {/* Search - NEW */}
                  <div className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-all duration-200 text-white font-medium text-[16px] cursor-pointer transform hover:scale-105">
                    <span className="icon flex-shrink-0"><VibrantSidebarIcons.Search /></span>
                    <span className="label">Search</span>
                  </div>
                  
                  {/* Notifications */}
                  <div className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-all duration-200 text-white font-medium text-[16px] cursor-pointer transform hover:scale-105">
                    <span className="icon flex-shrink-0"><VibrantSidebarIcons.Notifications /></span>
                    <span className="label">Notifications</span>
                  </div>
                  
                  {/* Carrot Patch */}
                  <div className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-all duration-200 text-white font-medium text-[16px] cursor-pointer transform hover:scale-105">
                    <span className="icon flex-shrink-0"><VibrantSidebarIcons.CarrotPatch /></span>
                    <span className="label">Carrot Patch</span>
                  </div>
                  
                  {/* Messages */}
                  <div className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-all duration-200 text-white font-medium text-[16px] cursor-pointer transform hover:scale-105">
                    <span className="icon flex-shrink-0"><VibrantSidebarIcons.Messages /></span>
                    <span className="label">Messages</span>
                  </div>
                  
                  {/* Rabbit (AI) */}
                  <div className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-all duration-200 text-white font-medium text-[16px] cursor-pointer transform hover:scale-105">
                    <span className="icon flex-shrink-0"><VibrantSidebarIcons.Rabbit /></span>
                    <span className="label">Rabbit (AI)</span>
                  </div>
                  
                  {/* Funds */}
                  <div className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-all duration-200 text-white font-medium text-[16px] cursor-pointer transform hover:scale-105">
                    <span className="icon flex-shrink-0"><VibrantSidebarIcons.Funds /></span>
                    <span className="label">Funds</span>
                  </div>
                  
                  {/* Settings */}
                  <div className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-all duration-200 text-white font-medium text-[16px] cursor-pointer transform hover:scale-105">
                    <span className="icon flex-shrink-0"><VibrantSidebarIcons.Settings /></span>
                    <span className="label">Settings</span>
                  </div>
                </div>
              </nav>
              
              {/* Stats Section */}
              <div className="flex-shrink-0 mt-4">
                <hr className="border-white/20 mb-3" />
                <div className="px-4 text-[14px] text-white/80 font-normal mb-3">
                  1,859 Carrots Earned
                </div>
              </div>
            </div>
            
            {/* Bottom Section: Profile & Logout */}
            <div className="flex-shrink-0 px-4 pb-4">
              <div className="flex flex-col items-center">
                {/* Avatar */}
                <div className="w-[60px] h-[60px] rounded-full bg-white/20 mb-2 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="8.5" r="4"/>
                    <ellipse cx="12" cy="17" rx="6.5" ry="4.5"/>
                  </svg>
                </div>
                
                {/* Username */}
                <p className="text-sm font-medium text-center mb-2 w-full text-white">
                  @daniel
                </p>
                
                {/* Logout Button */}
                <button className="bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-xl py-2.5 px-4 flex items-center justify-center gap-2 font-bold shadow w-full transition-all duration-200 transform hover:scale-105">
                  <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <VibrantSidebarIcons.Logout />
                  </span>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER FEED - Mock Content */}
        <main className="flex-1 w-full max-w-[680px]">
          <div className="space-y-6 py-8">
            {/* Mock Composer */}
            <div className="bg-gradient-to-br from-orange-400 via-pink-400 to-purple-500 rounded-2xl p-6 shadow-lg">
              <div className="bg-white/90 rounded-xl p-4 mb-4">
                <textarea 
                  className="w-full bg-transparent border-none outline-none resize-none text-lg placeholder-gray-500"
                  placeholder="What's happening?"
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
                  <div className="w-8 h-8 bg-purple-500 rounded-full"></div>
                  <div className="w-8 h-8 bg-yellow-500 rounded-full"></div>
                  <div className="w-8 h-8 bg-red-500 rounded-full"></div>
                  <div className="w-8 h-8 bg-orange-500 rounded-full"></div>
                  <div className="w-8 h-8 bg-yellow-400 rounded-full"></div>
                </div>
                <button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-6 rounded-full">
                  Post
                </button>
              </div>
            </div>

            {/* Mock Posts */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">@username</span>
                      <span className="text-gray-500 text-sm">2h ago</span>
                    </div>
                    <p className="text-gray-800 mb-3">
                      This is a mock post to show how the new vibrant sidebar looks alongside the existing dashboard content. The colorful design creates a cohesive visual experience!
                    </p>
                    <div className="flex items-center gap-4 text-gray-500">
                      <button className="flex items-center gap-1 hover:text-blue-500">
                        <span>💬</span> 12
                      </button>
                      <button className="flex items-center gap-1 hover:text-green-500">
                        <span>🔄</span> 5
                      </button>
                      <button className="flex items-center gap-1 hover:text-red-500">
                        <span>❤️</span> 24
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* RIGHT RAIL - Mock Widgets */}
        <aside className="hidden min-[1200px]:block w-[300px] flex-shrink-0 sticky top-0 h-screen overflow-y-auto">
          <div className="space-y-4 py-8">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg mb-3">🔥 Trending Commitments</h3>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">End foreign aid to Israel</div>
                <div className="text-sm text-gray-600">Universal basic income pilot</div>
                <div className="text-sm text-gray-600">Term limits for Congress</div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg mb-3">📍 Local Activity</h3>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">New bike lanes downtown</div>
                <div className="text-sm text-gray-600">Renewable energy initiative</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
