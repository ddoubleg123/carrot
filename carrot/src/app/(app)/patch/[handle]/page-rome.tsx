import React from 'react';
import { prisma } from '@/lib/prisma';
import { getPatchThemeClass } from '@/lib/patchThemes';
import { Metadata } from 'next';
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
  Share2, 
  Heart, 
  MoreHorizontal, 
  Plus, 
  Search, 
  Filter, 
  Grid,
  Crown,
  Bookmark,
  Star,
  BookOpen,
  Target,
  Settings,
  Palette
} from 'lucide-react';

interface PatchPageProps {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function RomePatchPage({ params, searchParams }: PatchPageProps) {
  try {
    const { handle } = await params
    const search = await searchParams
    const activeTab = (search.tab as string) || 'timeline'

    console.log('[RomePatchPage] Loading Rome patch with handle:', handle)

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
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Rome Not Found</h1>
            <p className="text-gray-600">The city of "{handle}" does not exist in our records.</p>
          </div>
        </div>
      );
    }

    const themeClass = getPatchThemeClass(patch.theme as string | null);

    return (
      <div className={`min-h-screen bg-gray-50`}>
        {/* Simplified Header */}
        <div className="bg-gradient-to-r from-red-800 to-amber-700 text-white border-b border-red-900">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
            <div className="py-12">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-8">
                  <div className="flex items-center gap-6 mb-6">
                    <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center shadow-inner">
                      <Crown className="w-10 h-10 text-white" />
                    </div>
                    <div>
                      <h1 className="text-5xl font-extrabold tracking-tight mb-2">{patch.name}</h1>
                      <p className="text-red-100 text-xl leading-relaxed max-w-3xl">{patch.description}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button className="px-6 py-3 border border-red-300 text-red-100 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2">
                    <Share2 className="w-5 h-5" />
                    Share
                  </button>
                  <button className="px-6 py-3 bg-amber-400 text-red-900 rounded-lg hover:bg-amber-300 transition-colors flex items-center gap-2 font-semibold">
                    <Plus className="w-5 h-5" />
                    Join
                  </button>
                  <button className="p-3 text-red-200 hover:text-white hover:bg-red-700 rounded-lg transition-colors">
                    <Settings className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            {/* Main Content Area */}
            <div className="lg:col-span-3">
              {activeTab === 'timeline' && (
                <div className="space-y-12">
                  {/* Timeline Header */}
                  <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-2xl p-8 border border-amber-200">
                    <div className="text-center mb-8">
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
                      <div className="absolute left-12 top-16 bottom-0 w-2 bg-gradient-to-b from-red-600 via-amber-500 to-red-600 rounded-full shadow-lg"></div>
                      
                      {/* Timeline Filter Controls */}
                      <div className="flex items-center justify-between mb-12 pl-20">
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
                      
                      <div className="space-y-16 pl-20">
                        {patch.events.length > 0 ? patch.events.map((event, index) => (
                          <div key={event.id} className="relative flex items-start gap-12">
                            {/* Enhanced Timeline Dot */}
                            <div className="relative z-10 flex-shrink-0 -ml-8">
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
                              <div className="relative z-10 flex-shrink-0 -ml-8">
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
                              <div className="relative z-10 flex-shrink-0 -ml-8">
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
                              <div className="relative z-10 flex-shrink-0 -ml-8">
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
                </div>
              )}

              {activeTab === 'achievements' && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10">
                  <h2 className="text-3xl font-extrabold text-gray-900 mb-8 flex items-center gap-3">
                    <Star className="w-8 h-8 text-amber-600" />
                    Roman Achievements
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                      <h3 className="text-xl font-bold text-gray-900 mb-3">Engineering Marvels</h3>
                      <p className="text-gray-700">Aqueducts, roads, and monumental architecture like the Colosseum and Pantheon.</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                      <h3 className="text-xl font-bold text-gray-900 mb-3">Legal System</h3>
                      <p className="text-gray-700">Foundations of modern law, including concepts of justice, property, and citizenship.</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                      <h3 className="text-xl font-bold text-gray-900 mb-3">Military Prowess</h3>
                      <p className="text-gray-700">Disciplined legions and strategic conquests that built a vast empire.</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                      <h3 className="text-xl font-bold text-gray-900 mb-3">Art & Literature</h3>
                      <p className="text-gray-700">Epic poetry, historical writings, and realistic sculptures that influenced Western art.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'culture' && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10">
                  <h2 className="text-3xl font-extrabold text-gray-900 mb-8 flex items-center gap-3">
                    <BookOpen className="w-8 h-8 text-blue-600" />
                    Roman Culture
                  </h2>
                  <div className="space-y-6 text-lg text-gray-700">
                    <p>Roman culture was a blend of influences, primarily from the Greeks, Etruscans, and various conquered peoples. It was characterized by a strong emphasis on family (familia), duty (pietas), and civic virtue (virtus).</p>
                    <p>Public life revolved around the Forum, baths, and gladiatorial games. Roman art, architecture, and literature left an indelible mark on Western civilization, with Latin becoming the lingua franca of the Western world for centuries.</p>
                    <p>Key aspects included: **Religion** (polytheistic, state-sponsored cults), **Philosophy** (Stoicism, Epicureanism), **Education** (rhetoric, law), and **Entertainment** (chariot races, theater).</p>
                  </div>
                </div>
              )}

              {activeTab === 'forum' && (
                <div className="space-y-12">
                  {/* Discussion Input */}
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10">
                    <div className="flex items-start gap-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-amber-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-xl">U</span>
                      </div>
                      <div className="flex-1">
                        <textarea
                          placeholder="Share your thoughts on Rome's legacy..."
                          className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none text-lg"
                          rows={4}
                        />
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center gap-3">
                            <button className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Image className="w-5 h-5" />
                            </button>
                            <button className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Video className="w-5 h-5" />
                            </button>
                            <button className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <FileText className="w-5 h-5" />
                            </button>
                            <button className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Link className="w-5 h-5" />
                            </button>
                          </div>
                          <button className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold text-lg">
                            Post to Forum
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Discussion Feed */}
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10">
                      <div className="flex items-start gap-6">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-xl">LC</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="font-bold text-gray-900 text-lg">Lucius Cassius</span>
                            <span className="text-sm text-gray-500">3 hours ago</span>
                          </div>
                          <p className="text-gray-800 text-lg mb-5">The engineering of Roman aqueducts still amazes me. What do you think was their most impressive feat?</p>
                          <div className="flex items-center gap-5">
                            <button className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition-colors">
                              <Heart className="w-5 h-5" />
                              <span className="text-base">42</span>
                            </button>
                            <button className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition-colors">
                              <MessageSquare className="w-5 h-5" />
                              <span className="text-base">15 replies</span>
                            </button>
                            <button className="text-gray-600 hover:text-red-600 transition-colors">
                              <Share2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="space-y-8">
              {/* Navigation Tabs */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Navigation</h3>
                <div className="space-y-2">
                  {[
                    { id: 'timeline', label: 'Timeline', icon: Calendar, desc: 'Chronological History' },
                    { id: 'achievements', label: 'Achievements', icon: Star, desc: 'Great Works' },
                    { id: 'culture', label: 'Culture', icon: BookOpen, desc: 'Arts & Society' },
                    { id: 'forum', label: 'Forum', icon: MessageSquare, desc: 'Community' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <tab.icon className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">{tab.label}</div>
                        <div className="text-xs opacity-75">{tab.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Legion Actions */}
              <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-2xl shadow-lg p-8 text-white">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Target className="w-6 h-6 text-amber-400" />
                  Legion Actions
                </h3>
                <div className="space-y-4">
                  <button className="w-full flex items-center gap-4 p-4 text-left hover:bg-red-700 rounded-xl transition-colors">
                    <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                      <Plus className="w-5 h-5 text-amber-400" />
                    </div>
                    <span className="text-lg font-medium">Add to Timeline</span>
                  </button>
                  <button className="w-full flex items-center gap-4 p-4 text-left hover:bg-red-700 rounded-xl transition-colors">
                    <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                      <FileText className="w-5 h-5 text-amber-400" />
                    </div>
                    <span className="text-lg font-medium">Share Artifact</span>
                  </button>
                  <button className="w-full flex items-center gap-4 p-4 text-left hover:bg-red-700 rounded-xl transition-colors">
                    <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-amber-400" />
                    </div>
                    <span className="text-lg font-medium">Start Discussion</span>
                  </button>
                </div>
              </div>

              {/* Quick Facts */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
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

              {/* Empire Statistics */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Crown className="w-6 h-6" />
                  Empire Statistics
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Timeline Events</span>
                    <span className="font-bold text-xl text-red-600">{patch.events.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Key Facts</span>
                    <span className="font-bold text-xl text-red-600">{patch.facts.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Legion Members</span>
                    <span className="font-bold text-xl text-red-600">2,847</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Forum Posts</span>
                    <span className="font-bold text-xl text-red-600">156</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Rome patch page error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      handle: await params.then(p => p.handle).catch(() => 'unknown')
    });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Rome</h1>
          <p className="text-gray-600 mb-4">There was an error loading the Rome page.</p>
          <p className="text-sm text-gray-500">Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
          <p className="text-sm text-gray-500">Please try refreshing the page or contact support if the issue persists.</p>
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
      title: 'Rome Not Found',
    };
  }

  return {
    title: `${patch.name} - Carrot Rome`,
    description: patch.description,
    keywords: patch.tags.join(', '),
  };
}