'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  MapPin, 
  Trophy, 
  Users, 
  Star, 
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Share2,
  Heart,
  MessageSquare,
  BookOpen,
  Clock,
  Target,
  Zap,
  Award,
  TrendingUp,
  BarChart3,
  FileText,
  Image as ImageIcon,
  Video,
  Link as LinkIcon,
  Plus,
  Settings,
  MoreHorizontal
} from 'lucide-react';

interface AstrosPageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default function AstrosPage({ params, searchParams }: AstrosPageProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isTimelineLoaded, setIsTimelineLoaded] = useState(false);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [timelineError, setTimelineError] = useState(false);

  // Load Timeline.js dynamically
  useEffect(() => {
    const loadTimeline = async () => {
      try {
        // Create Timeline.js data for Astros history
        const astrosTimelineData = {
          title: {
            media: {
              url: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=1200&h=600&fit=crop",
              caption: "Houston Astros at Minute Maid Park"
            },
            text: {
              headline: "Houston Astros History",
              text: "From the Colt .45s to World Series Champions - A journey through Space City's baseball legacy."
            }
          },
          events: [
            {
              media: {
                url: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800",
                caption: "The first Houston Colt .45s game"
              },
              start_date: {
                year: "1962",
                month: "4",
                day: "10"
              },
              text: {
                headline: "Franchise Founded",
                text: "Houston Colt .45s play their first game in the National League, defeating the Chicago Cubs 11-2 at Colt Stadium."
              }
            },
            {
              media: {
                url: "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=800",
                caption: "The Astrodome - Eighth Wonder of the World"
              },
              start_date: {
                year: "1965",
                month: "4",
                day: "9"
              },
              text: {
                headline: "Astrodome Opens",
                text: "The 'Eighth Wonder of the World' opens as the first domed stadium in baseball, revolutionizing the sport."
              }
            },
            {
              media: {
                url: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800",
                caption: "Nolan Ryan in action"
              },
              start_date: {
                year: "1980"
              },
              end_date: {
                year: "1988"
              },
              text: {
                headline: "Nolan Ryan Era",
                text: "The Ryan Express dominates with multiple no-hitters and strikeout records, becoming a Houston legend."
              }
            },
            {
              media: {
                url: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800",
                caption: "Jeff Bagwell and Craig Biggio"
              },
              start_date: {
                year: "1991"
              },
              end_date: {
                year: "2005"
              },
              text: {
                headline: "Killer B's Era",
                text: "Jeff Bagwell and Craig Biggio lead the team to multiple playoff appearances and establish a winning culture."
              }
            },
            {
              media: {
                url: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800",
                caption: "2017 World Series celebration"
              },
              start_date: {
                year: "2017",
                month: "11",
                day: "1"
              },
              text: {
                headline: "First World Series Championship",
                text: "Astros win their first World Series, defeating the Los Angeles Dodgers in a thrilling 7-game series."
              }
            },
            {
              media: {
                url: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800",
                caption: "2022 World Series celebration"
              },
              start_date: {
                year: "2022",
                month: "11",
                day: "5"
              },
              text: {
                headline: "Second World Series Championship",
                text: "Astros capture their second World Series title, defeating the Philadelphia Phillies in 6 games."
              }
            }
          ]
        };

        setTimelineData(astrosTimelineData);
        setIsTimelineLoaded(true);
      } catch (error) {
        console.error('Error loading timeline:', error);
      }
    };

    loadTimeline();
  }, []);

  // Initialize Timeline.js when data is ready AND timeline tab is active
  useEffect(() => {
    if (isTimelineLoaded && timelineData && activeTab === 'timeline' && typeof window !== 'undefined') {
      // Check if Timeline.js is already loaded
      if ((window as any).TL) {
        initializeTimeline();
        return;
      }

      // Load Timeline.js CSS first
      const existingCSS = document.querySelector('link[href*="timeline.css"]');
      if (!existingCSS) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.knightlab.com/libs/timeline3/latest/css/timeline.css';
        document.head.appendChild(link);
      }

      // Load Timeline.js script
      const existingScript = document.querySelector('script[src*="timeline-min.js"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://cdn.knightlab.com/libs/timeline3/latest/js/timeline-min.js';
        script.onload = () => {
          console.log('Timeline.js loaded successfully');
          initializeTimeline();
        };
        script.onerror = () => {
          console.error('Failed to load Timeline.js');
          setTimelineError(true);
        };
        document.head.appendChild(script);
      } else {
        // Script already exists, try to initialize
        setTimeout(initializeTimeline, 100);
      }
    }
  }, [isTimelineLoaded, timelineData, activeTab]);

  // Initialize timeline when user switches to timeline tab
  useEffect(() => {
    if (activeTab === 'timeline' && isTimelineLoaded && timelineData && (window as any).TL) {
      // Small delay to ensure DOM is ready
      setTimeout(initializeTimeline, 100);
    }
  }, [activeTab]);

  const initializeTimeline = () => {
    const timelineContainer = document.getElementById('timeline-embed');
    if (timelineContainer && (window as any).TL && timelineData) {
      try {
        // Clear any existing timeline
        timelineContainer.innerHTML = '';
        
        // Initialize new timeline
        new (window as any).TL.Timeline(timelineContainer, timelineData);
        console.log('Timeline initialized successfully');
      } catch (error) {
        console.error('Error initializing timeline:', error);
        setTimelineError(true);
      }
    } else {
      console.log('Timeline container or TL not ready:', {
        container: !!timelineContainer,
        TL: !!(window as any).TL,
        data: !!timelineData
      });
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'roster', label: 'Current Roster', icon: Users },
    { id: 'stats', label: 'Statistics', icon: TrendingUp },
    { id: 'discussion', label: 'Discussion', icon: MessageSquare }
  ];

  const stats = [
    { label: 'World Series Titles', value: '2', icon: Trophy, color: 'text-yellow-500' },
    { label: 'Playoff Appearances', value: '12', icon: Target, color: 'text-blue-500' },
    { label: 'Division Titles', value: '8', icon: Award, color: 'text-green-500' },
    { label: 'Franchise Years', value: '62', icon: Calendar, color: 'text-purple-500' }
  ];

  const currentRoster = [
    { name: 'José Altuve', position: '2B', number: '27', status: 'Active' },
    { name: 'Alex Bregman', position: '3B', number: '2', status: 'Active' },
    { name: 'Yordan Álvarez', position: 'LF', number: '44', status: 'Active' },
    { name: 'Kyle Tucker', position: 'RF', number: '30', status: 'Active' },
    { name: 'Framber Valdez', position: 'P', number: '59', status: 'Active' },
    { name: 'Cristian Javier', position: 'P', number: '53', status: 'Active' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Hero Section with Baseball Theme */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-blue-600 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-white">H</span>
              </div>
              <div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                  Houston Astros
                </h1>
                <p className="text-xl text-gray-600 mt-2">Space City Baseball Excellence</p>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {['baseball', 'mlb', 'houston', 'championships', 'history'].map((tag) => (
                <span key={tag} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                  #{tag}
                </span>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4">
              <button className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-200 flex items-center gap-2">
                <Heart className="w-5 h-5" />
                Join Astros Nation
              </button>
              <button className="px-8 py-3 bg-white border-2 border-orange-200 text-orange-600 rounded-full font-semibold hover:bg-orange-50 transition-all duration-200 flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Share
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 text-center border border-orange-100 hover:shadow-lg transition-all duration-200">
                <stat.icon className={`w-8 h-8 mx-auto mb-3 ${stat.color}`} />
                <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-orange-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'overview' && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Quick Facts */}
              <div className="bg-white rounded-2xl p-8 border border-orange-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-orange-500" />
                  Quick Facts
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Founded</span>
                      <span className="font-semibold">1962 (as Colt .45s)</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Home Stadium</span>
                      <span className="font-semibold">Minute Maid Park</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Division</span>
                      <span className="font-semibold">AL West</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Notable Players</span>
                      <span className="font-semibold">Nolan Ryan, Bagwell, Biggio</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Current Stars</span>
                      <span className="font-semibold">Altuve, Bregman, Álvarez</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Unique Features</span>
                      <span className="font-semibold">Crawford Boxes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-2xl p-8 border border-orange-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Zap className="w-6 h-6 text-orange-500" />
                  Recent Activity
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 bg-orange-50 rounded-xl">
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">José Altuve's 3,000th Hit</h3>
                      <p className="text-gray-600 text-sm">José Altuve becomes the first Astros player to reach 3,000 career hits.</p>
                      <span className="text-xs text-orange-600">2 days ago</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-xl">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">New Discussion Started</h3>
                      <p className="text-gray-600 text-sm">"2024 Season Predictions" - What are your thoughts on the upcoming season?</p>
                      <span className="text-xs text-blue-600">1 week ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-2xl p-6 border border-orange-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-orange-50 rounded-lg transition-colors">
                    <Plus className="w-5 h-5 text-orange-500" />
                    <span className="text-gray-700">Add Event</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-orange-50 rounded-lg transition-colors">
                    <FileText className="w-5 h-5 text-orange-500" />
                    <span className="text-gray-700">Add Fact</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-orange-50 rounded-lg transition-colors">
                    <LinkIcon className="w-5 h-5 text-orange-500" />
                    <span className="text-gray-700">Add Source</span>
                  </button>
                </div>
              </div>

              {/* Top Contributors */}
              <div className="bg-white rounded-2xl p-6 border border-orange-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Top Contributors</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-semibold">D</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">daniel</div>
                      <div className="text-sm text-gray-500">12 contributions</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="bg-white rounded-2xl p-8 border border-orange-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-orange-500" />
              Astros Timeline
            </h2>
            <div className="relative">
              <div id="timeline-embed" className="w-full" style={{ height: '600px' }} />
              {!isTimelineLoaded && !timelineError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading Timeline...</p>
                  </div>
                </div>
              )}
              {timelineError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">Timeline.js failed to load. Showing fallback timeline:</p>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {timelineData?.events?.map((event: any, index: number) => (
                        <div key={index} className="flex items-start gap-4 p-4 bg-white rounded-lg border border-orange-100">
                          <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-sm">{event.start_date?.year || 'N/A'}</span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1">{event.text?.headline}</h3>
                            <p className="text-gray-600 text-sm">{event.text?.text}</p>
                            {event.start_date && (
                              <p className="text-xs text-orange-600 mt-2">
                                {event.start_date.month && event.start_date.day 
                                  ? `${event.start_date.month}/${event.start_date.day}/${event.start_date.year}`
                                  : event.start_date.year
                                }
                                {event.end_date && ` - ${event.end_date.year}`}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'roster' && (
          <div className="bg-white rounded-2xl p-8 border border-orange-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Users className="w-6 h-6 text-orange-500" />
              Current Roster
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentRoster.map((player, index) => (
                <div key={index} className="p-4 border border-orange-100 rounded-xl hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">{player.number}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{player.name}</div>
                      <div className="text-sm text-gray-600">{player.position}</div>
                      <div className="text-xs text-green-600">{player.status}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="bg-white rounded-2xl p-8 border border-orange-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-orange-500" />
              Team Statistics
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center p-6 bg-orange-50 rounded-xl">
                <div className="text-3xl font-bold text-orange-600 mb-2">.267</div>
                <div className="text-sm text-gray-600">Team Batting Average</div>
              </div>
              <div className="text-center p-6 bg-blue-50 rounded-xl">
                <div className="text-3xl font-bold text-blue-600 mb-2">3.94</div>
                <div className="text-sm text-gray-600">Team ERA</div>
              </div>
              <div className="text-center p-6 bg-green-50 rounded-xl">
                <div className="text-3xl font-bold text-green-600 mb-2">95</div>
                <div className="text-sm text-gray-600">Wins (2023)</div>
              </div>
              <div className="text-center p-6 bg-purple-50 rounded-xl">
                <div className="text-3xl font-bold text-purple-600 mb-2">67</div>
                <div className="text-sm text-gray-600">Losses (2023)</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'discussion' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-8 border border-orange-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-orange-500" />
                Community Discussion
              </h2>
              <div className="space-y-4">
                <div className="p-6 border border-orange-100 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold">D</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900">daniel</span>
                        <span className="text-sm text-gray-500">2 hours ago</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">Welcome to Astros Nation!</h3>
                      <p className="text-gray-600 mb-4">Join the conversation about Houston's beloved baseball team. From the Killer B's to the current championship era, share your favorite Astros memories and moments.</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <button className="flex items-center gap-1 hover:text-orange-600">
                          <Heart className="w-4 h-4" />
                          42
                        </button>
                        <button className="flex items-center gap-1 hover:text-orange-600">
                          <MessageSquare className="w-4 h-4" />
                          8
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
