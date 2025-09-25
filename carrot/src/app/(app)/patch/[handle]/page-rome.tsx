import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getPatchThemeClass } from '@/lib/patch-theme'
import { 
  Calendar, 
  Users, 
  MessageSquare, 
  FileText, 
  Link, 
  Image, 
  Video, 
  Upload,
  Clock,
  BookOpen,
  Share2,
  Heart,
  MoreHorizontal,
  Plus,
  Search,
  Filter,
  Grid,
  MapPin,
  Crown,
  Sword,
  Building,
  Globe,
  Star,
  ChevronDown,
  ChevronUp,
  Eye,
  Bookmark
} from 'lucide-react'

interface PatchPageProps {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PatchPage({ params, searchParams }: PatchPageProps) {
  try {
    const { handle } = await params
    const search = await searchParams
    const activeTab = (search.tab as string) || 'timeline'

    console.log('[Rome Page] Loading patch with handle:', handle)

    // Get patch with timeline events and facts
    let patch = await prisma.patch.findUnique({
      where: { handle },
      select: {
        id: true,
        handle: true,
        name: true,
        description: true,
        theme: true,
        tags: true,
        createdBy: true,
        createdAt: true,
        events: {
          orderBy: { dateStart: 'asc' }
        },
        facts: true
      }
    });

    if (!patch) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-amber-50">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Empire Not Found</h1>
            <p className="text-gray-600">The realm "{handle}" does not exist in our records.</p>
          </div>
        </div>
      );
    }

    // Get theme class
    const themeClass = getPatchThemeClass(patch.theme as string | null);

    return (
      <div className={`min-h-screen bg-gradient-to-br from-red-50 via-amber-50 to-orange-50`}>
        {/* Hero Header with Roman Theme */}
        <div className="relative bg-gradient-to-r from-red-900 via-red-800 to-amber-800 text-white overflow-hidden">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-16">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl">
                      <Crown className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-5xl font-bold mb-2">{patch.name}</h1>
                      <p className="text-xl text-amber-200">Eternal City • Eternal Legacy</p>
                    </div>
                  </div>
                  <p className="text-lg text-red-100 max-w-4xl mb-8 leading-relaxed">{patch.description}</p>
                  <div className="flex items-center gap-6">
                    <div className="flex gap-3">
                      {patch.tags.map((tag) => (
                        <span key={tag} className="px-4 py-2 bg-amber-500/20 text-amber-200 rounded-full text-sm font-medium border border-amber-400/30">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-8 text-amber-200">
                      <div className="flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        <span>2.5M sq mi</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        <span>1M+ citizens</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        <span>1,000+ years</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button className="px-6 py-3 border border-amber-400/50 text-amber-200 rounded-xl hover:bg-amber-400/10 transition-all duration-300 flex items-center gap-2 backdrop-blur-sm">
                    <Share2 className="w-5 h-5" />
                    Share Empire
                  </button>
                  <button className="px-6 py-3 bg-gradient-to-r from-amber-500 to-red-500 text-white rounded-xl hover:from-amber-600 hover:to-red-600 transition-all duration-300 flex items-center gap-2 shadow-lg">
                    <Plus className="w-5 h-5" />
                    Join Legion
                  </button>
                  <button className="p-3 text-amber-200 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-300">
                    <MoreHorizontal className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Roman Style */}
        <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8">
              {[
                { id: 'timeline', label: 'Timeline', icon: Calendar, desc: 'Chronological History' },
                { id: 'achievements', label: 'Achievements', icon: Star, desc: 'Great Works' },
                { id: 'culture', label: 'Culture', icon: BookOpen, desc: 'Arts & Society' },
                { id: 'discussions', label: 'Forum', icon: MessageSquare, desc: 'Community' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`py-6 px-2 border-b-3 font-semibold text-sm flex flex-col items-center gap-1 transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-600 hover:text-red-500 hover:border-red-300'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                  <span className="text-xs font-normal opacity-75">{tab.desc}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            {/* Main Timeline Area */}
            <div className="lg:col-span-3">
              {activeTab === 'timeline' && (
                <div className="space-y-12">
                  {/* Timeline Header */}
                  <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-amber-500 rounded-full flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <h2 className="text-4xl font-bold text-gray-900">Chronicles of Rome</h2>
                    </div>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                      Journey through the rise and fall of one of history's greatest civilizations. 
                      Explore key moments that shaped Western civilization.
                    </p>
                  </div>

                  {/* Timeline Events */}
                  <div className="relative">
                    {/* Enhanced Timeline Line with Gradient */}
                    <div className="absolute left-12 top-0 bottom-0 w-2 bg-gradient-to-b from-red-600 via-amber-500 to-red-600 rounded-full shadow-lg"></div>
                    
                    {/* Timeline Filter Controls */}
                    <div className="flex items-center justify-between mb-12">
                      <div className="flex items-center gap-4">
                        <button className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2">
                          <Filter className="w-4 h-4" />
                          Filter Era
                        </button>
                        <button className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                          <Search className="w-4 h-4" />
                          Search Events
                        </button>
                      </div>
                      <div className="text-sm text-gray-500">
                        {patch.events.length} Historical Events
                      </div>
                    </div>
                    
                    <div className="space-y-16">
                      {patch.events.length > 0 ? patch.events.map((event, index) => (
                        <div key={event.id} className="relative flex items-start gap-12">
                          {/* Enhanced Timeline Dot */}
                          <div className="relative z-10 flex-shrink-0">
                            <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-xl bg-gradient-to-br from-red-500 to-amber-500 border-4 border-white">
                              <span className="text-white font-bold text-lg">
                                {new Date(event.dateStart).getFullYear()}
                              </span>
                            </div>
                            {/* Decorative ring */}
                            <div className="absolute inset-0 rounded-full border-2 border-red-200 animate-pulse"></div>
                          </div>

                          {/* Enhanced Event Card */}
                          <div className="flex-1 bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]">
                            <div className="p-10">
                              <div className="flex items-start justify-between mb-6">
                                <div className="flex-1">
                                  <div className="flex items-center gap-4 mb-4">
                                    <span className="px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-red-100 to-amber-100 text-red-800">
                                      Historical Milestone
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      {new Date(event.dateStart).toLocaleDateString('en-US', { 
                                        year: 'numeric', 
                                        month: 'long', 
                                        day: 'numeric' 
                                      })}
                                    </span>
                                  </div>
                                  <h3 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">{event.title}</h3>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200 hover:scale-110">
                                    <Bookmark className="w-5 h-5" />
                                  </button>
                                  <button className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200 hover:scale-110">
                                    <Share2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                              
                              <p className="text-gray-700 text-lg mb-6 leading-relaxed">{event.summary}</p>
                              
                              <div className="flex flex-wrap gap-3">
                                {event.tags.map((tag) => (
                                  <span key={tag} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )) : (
                        /* Sample Timeline Events for Demo */
                        <>
                          <div className="relative flex items-start gap-12">
                            <div className="relative z-10 flex-shrink-0">
                              <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-xl bg-gradient-to-br from-red-500 to-amber-500 border-4 border-white">
                                <span className="text-white font-bold text-lg">753</span>
                              </div>
                              <div className="absolute inset-0 rounded-full border-2 border-red-200 animate-pulse"></div>
                            </div>
                            <div className="flex-1 bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]">
                              <div className="p-10">
                                <div className="flex items-center gap-4 mb-4">
                                  <span className="px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-red-100 to-amber-100 text-red-800">
                                    Foundation
                                  </span>
                                  <span className="text-sm text-gray-500">753 BCE</span>
                                </div>
                                <h3 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">Foundation of Rome</h3>
                                <p className="text-gray-700 text-lg mb-6 leading-relaxed">
                                  According to legend, Rome was founded by Romulus and Remus on the Palatine Hill. 
                                  This marked the beginning of what would become one of history's greatest empires.
                                </p>
                                <div className="flex flex-wrap gap-3">
                                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">Foundation</span>
                                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">Legend</span>
                                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">Romulus</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="relative flex items-start gap-12">
                            <div className="relative z-10 flex-shrink-0">
                              <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-xl bg-gradient-to-br from-red-500 to-amber-500 border-4 border-white">
                                <span className="text-white font-bold text-lg">509</span>
                              </div>
                              <div className="absolute inset-0 rounded-full border-2 border-red-200 animate-pulse"></div>
                            </div>
                            <div className="flex-1 bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]">
                              <div className="p-10">
                                <div className="flex items-center gap-4 mb-4">
                                  <span className="px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-red-100 to-amber-100 text-red-800">
                                    Republic
                                  </span>
                                  <span className="text-sm text-gray-500">509 BCE</span>
                                </div>
                                <h3 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">Roman Republic Established</h3>
                                <p className="text-gray-700 text-lg mb-6 leading-relaxed">
                                  The Roman Republic was established after the overthrow of the last Roman king, 
                                  Tarquin the Proud. This marked the beginning of representative government in Rome.
                                </p>
                                <div className="flex flex-wrap gap-3">
                                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">Republic</span>
                                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">Government</span>
                                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">Democracy</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="relative flex items-start gap-12">
                            <div className="relative z-10 flex-shrink-0">
                              <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-xl bg-gradient-to-br from-red-500 to-amber-500 border-4 border-white">
                                <span className="text-white font-bold text-lg">27</span>
                              </div>
                              <div className="absolute inset-0 rounded-full border-2 border-red-200 animate-pulse"></div>
                            </div>
                            <div className="flex-1 bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]">
                              <div className="p-10">
                                <div className="flex items-center gap-4 mb-4">
                                  <span className="px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-red-100 to-amber-100 text-red-800">
                                    Empire
                                  </span>
                                  <span className="text-sm text-gray-500">27 BCE</span>
                                </div>
                                <h3 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">Augustus Becomes First Emperor</h3>
                                <p className="text-gray-700 text-lg mb-6 leading-relaxed">
                                  Octavian, later known as Augustus, became the first Roman Emperor, 
                                  marking the end of the Republic and the beginning of the Roman Empire.
                                </p>
                                <div className="flex flex-wrap gap-3">
                                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">Empire</span>
                                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">Augustus</span>
                                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">Imperial</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Achievements Tab */}
              {activeTab === 'achievements' && (
                <div className="space-y-8">
                  <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Roman Achievements</h2>
                    <p className="text-lg text-gray-600">The lasting legacy of Roman innovation and engineering</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6">
                        <Building className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-4">Engineering Marvels</h3>
                      <p className="text-gray-700 mb-4">Roman roads, aqueducts, and buildings that still stand today.</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span>50,000+ miles of roads</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Building className="w-4 h-4" />
                          <span>11 major aqueducts</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Star className="w-4 h-4" />
                          <span>Colosseum, Pantheon, Forum</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                        <BookOpen className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-4">Legal System</h3>
                      <p className="text-gray-700 mb-4">Roman law forms the foundation of modern legal systems.</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <FileText className="w-4 h-4" />
                          <span>Twelve Tables</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <BookOpen className="w-4 h-4" />
                          <span>Justinian Code</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Star className="w-4 h-4" />
                          <span>Innocent until proven guilty</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Culture Tab */}
              {activeTab === 'culture' && (
                <div className="space-y-8">
                  <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Roman Culture</h2>
                    <p className="text-lg text-gray-600">The arts, philosophy, and daily life of ancient Rome</p>
                  </div>
                  
                  <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">Coming Soon</h3>
                    <p className="text-gray-600">Rich content about Roman art, literature, philosophy, and daily life will be added here.</p>
                  </div>
                </div>
              )}

              {/* Forum Tab */}
              {activeTab === 'discussions' && (
                <div className="space-y-8">
                  <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">The Forum</h2>
                    <p className="text-lg text-gray-600">Join the discussion about Roman history and culture</p>
                  </div>
                  
                  <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">Coming Soon</h3>
                    <p className="text-gray-600">Community discussions about Roman history will be available here.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              {/* Quick Facts */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Star className="w-6 h-6 text-amber-500" />
                  Quick Facts
                </h3>
                <div className="space-y-4">
                  {patch.facts.map((fact) => (
                    <div key={fact.id} className="border-l-4 border-red-500 pl-4">
                      <div className="font-semibold text-gray-900">{fact.label}</div>
                      <div className="text-lg font-bold text-red-600">{fact.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Legion Actions</h3>
                <div className="space-y-3">
                  <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-red-50 rounded-xl transition-colors border border-gray-200 hover:border-red-200">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-amber-500 rounded-xl flex items-center justify-center">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-medium text-gray-900">Add to Timeline</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-blue-50 rounded-xl transition-colors border border-gray-200 hover:border-blue-200">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <Upload className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-medium text-gray-900">Share Artifact</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-green-50 rounded-xl transition-colors border border-gray-200 hover:border-green-200">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-medium text-gray-900">Start Discussion</span>
                  </button>
                </div>
              </div>

              {/* Empire Stats */}
              <div className="bg-gradient-to-br from-red-500 to-amber-500 rounded-2xl shadow-lg p-6 text-white">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Crown className="w-6 h-6" />
                  Empire Statistics
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-red-100">Timeline Events</span>
                    <span className="font-bold text-xl">{patch.events.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-red-100">Key Facts</span>
                    <span className="font-bold text-xl">{patch.facts.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-red-100">Legion Members</span>
                    <span className="font-bold text-xl">2,847</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-red-100">Forum Posts</span>
                    <span className="font-bold text-xl">156</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Rome page error:', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-amber-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Empire</h1>
          <p className="text-gray-600 mb-4">There was an error loading this Roman page.</p>
          <p className="text-sm text-gray-500">Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }
}

export async function generateMetadata({ params }: PatchPageProps): Promise<Metadata> {
  const { handle } = await params;

  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: {
      name: true,
      description: true,
      tags: true,
    }
  });

  if (!patch) {
    return {
      title: 'Empire Not Found',
    };
  }

  return {
    title: `${patch.name} - Eternal Legacy`,
    description: patch.description,
    keywords: patch.tags.join(', '),
  };
}
