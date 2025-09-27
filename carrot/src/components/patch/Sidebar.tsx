'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Upload, MessageSquare, Users, MessageSquare as Posts, Calendar, BookOpen } from 'lucide-react';

interface Patch {
  id: string;
  name: string;
  _count: {
    members: number;
    posts: number;
    events: number;
    sources: number;
  };
}

interface SidebarProps {
  patch: Patch;
}

export default function Sidebar({ patch }: SidebarProps) {
  return (
    <div className="space-y-6">
      {/* Quick Actions - Now at the top */}
      <Card className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#0B0B0F]">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors bg-transparent border-0 shadow-none h-auto justify-start">
            <div className="w-8 h-8 bg-[#FF6A00]/10 rounded-lg flex items-center justify-center">
              <Plus className="w-4 h-4 text-[#FF6A00]" />
            </div>
            <span className="text-sm font-medium text-[#0B0B0F]">Add to Timeline</span>
          </Button>
          <Button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors bg-transparent border-0 shadow-none h-auto justify-start">
            <div className="w-8 h-8 bg-[#0A5AFF]/10 rounded-lg flex items-center justify-center">
              <Upload className="w-4 h-4 text-[#0A5AFF]" />
            </div>
            <span className="text-sm font-medium text-[#0B0B0F]">Upload Resource</span>
          </Button>
          <Button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors bg-transparent border-0 shadow-none h-auto justify-start">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-sm font-medium text-[#0B0B0F]">Start Discussion</span>
          </Button>
        </CardContent>
      </Card>

      {/* Fact Sheet - Now below Quick Actions */}
      <Card className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#0B0B0F]">Fact Sheet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#60646C]">Total Members</span>
            <span className="font-semibold text-[#0B0B0F]">{patch._count.members.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#60646C]">Active Posts</span>
            <span className="font-semibold text-[#0B0B0F]">{patch._count.posts}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#60646C]">Resources</span>
            <span className="font-semibold text-[#0B0B0F]">{patch._count.sources}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#60646C]">Timeline Events</span>
            <span className="font-semibold text-[#0B0B0F]">{patch._count.events}</span>
          </div>
        </CardContent>
      </Card>

      {/* Top Contributors */}
      <Card className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#0B0B0F]">Top Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#FF6A00]/10 rounded-full flex items-center justify-center">
                <span className="text-xs font-semibold text-[#FF6A00]">JD</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-[#0B0B0F]">John Doe</div>
                <div className="text-xs text-[#60646C]">12 contributions</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#0A5AFF]/10 rounded-full flex items-center justify-center">
                <span className="text-xs font-semibold text-[#0A5AFF]">SM</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-[#0B0B0F]">Sarah Miller</div>
                <div className="text-xs text-[#60646C]">8 contributions</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-semibold text-green-600">AC</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-[#0B0B0F]">Alex Chen</div>
                <div className="text-xs text-[#60646C]">5 contributions</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
