'use client';

  // Helper (kept for compatibility): avatar URL (fallback if none in metadata)
  const avatarFor = (name: string, url?: string) => {
    if (url) return url
    const seed = encodeURIComponent(name || 'Agent')
    return `https://api.dicebear.com/7.x/shapes/svg?seed=${seed}&radius=50&backgroundType=gradientLinear`
  }

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Users, Brain, BookOpen, Upload, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import MemoryViewer from '@/components/ai-agents/MemoryViewer';
import StudyRecord from '@/components/ai-agents/StudyRecord';
import BatchFeedModal from '@/components/ai-agents/BatchFeedModal';
import AgentTrainingWorkflow from '@/components/ai-agents/AgentTrainingWorkflow';
import AgentTrainingDashboard from '@/components/ai-agents/AgentTrainingDashboard';
import AgentSelfAssessmentChat from '@/components/ai-agents/AgentSelfAssessmentChat';
import DiscoveryHistoryViewer from '@/components/ai-agents/DiscoveryHistoryViewer';
import AgentsOverview from '@/components/ai-agents/AgentsOverview';
import { FEATURED_AGENTS } from '@/lib/agents';
import { OptimizedImage, AvatarImage } from '@/components/ui/OptimizedImage';

interface Agent {
  id: string;
  name: string;
  persona: string;
  domainExpertise: string[];
  associatedPatches: string[];
  metadata: {
    role?: string;
    expertise?: string[];
    avatar?: string;
    councilMembership?: string[];
    userVisibility?: string;
  };
  createdAt: string;
}

interface FeedPreview {
  content: string;
  sourceType: string;
  sourceTitle?: string;
  sourceAuthor?: string;
  chunks: string[];
  estimatedMemories: number;
}

export default function FeedAgentsPage() {
  // Helper: avatar URL (fallback if none in metadata)
  const avatarFor = (name: string, url?: string) => {
    if (url) return url
    const seed = encodeURIComponent(name || 'Agent')
    return `https://api.dicebear.com/7.x/shapes/svg?seed=${seed}&radius=50&backgroundType=gradientLinear`
  }
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [feedContent, setFeedContent] = useState('');
  const [sourceType, setSourceType] = useState('manual');
  const [activeTab, setActiveTab] = useState<'agents'|'feed'|'memories'|'training'|'dashboard'|'discoveries'>('agents');
  const [showTrainingWorkflow, setShowTrainingWorkflow] = useState(false);
  // Restored state
  const isProduction = typeof window !== 'undefined' && window.location.hostname.includes('onrender.com');
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceAuthor, setSourceAuthor] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  // Learn topics modal & tracker
  const [showLearnModal, setShowLearnModal] = useState(false);
  const [assessmentText, setAssessmentText] = useState('');
  const [lastPlanId, setLastPlanId] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<any>(null);
  const [topicsFromDeepseek, setTopicsFromDeepseek] = useState<string[]>([]);
  const [auditResult, setAuditResult] = useState<any | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  // Toast banner (simple)
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<'info'|'success'|'error'>('info');
  // Bulk assessment status tracker
  const [assessmentStatuses, setAssessmentStatuses] = useState<Record<string, { status: 'in_queue'|'in_process'|'completed'|'error'; planId?: string; error?: string }>>({});
  // Batch API integration
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<any | null>(null);
  // Cache of planId -> { plan, tasks }
  const [plansById, setPlansById] = useState<Record<string, any>>({});
  // Discoveries viewer state
  const [discoveries, setDiscoveries] = useState<any[]>([]);
  const [discTopic, setDiscTopic] = useState<string>('__all__');
  const [discStatus, setDiscStatus] = useState<string>('__all__');
  // Global training focus (0 = discovery, 100 = feeding)
  const [focusPercent, setFocusPercent] = useState<number>(() => {
    if (typeof window === 'undefined') return 50;
    const v = parseInt(localStorage.getItem('carrot_training_focus') || '50', 10);
    return isFinite(v) ? Math.max(0, Math.min(100, v)) : 50;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('carrot_training_focus', String(focusPercent));
    let done = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/agents/training/focus', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ percent: focusPercent })
        });
        const j = await r.json();
        if (!r.ok || !j.ok) showToast(j.message || 'Failed to update focus', 'error');
      } catch (e:any) {
        showToast(e?.message || 'Error updating focus', 'error');
      } finally { done = true; }
    }, 300);
    return () => { if (!done) clearTimeout(t); };
  }, [focusPercent]);

  // Learn topics: parse + create training plan
  const extractTopicsFromAssessment = (text: string): string[] => {
    // Collect bullet lines and headings as topics; simple heuristic
    const lines = text.split(/\r?\n/);
    const topics: string[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (/^[-*•]\s+/.test(line)) {
        const t = line.replace(/^[-*•]\s+/, '').replace(/^[**_`\-\d.\)]+\s*/, '').trim();
        if (t) topics.push(t);
      } else if (/^##?\s+/.test(line)) {
        // Include H2/H3 section titles as higher-level topics optionally
        const t = line.replace(/^##?\s+/, '').trim();
        if (t && !/^recommended resources|professional|how to use/i.test(t)) topics.push(t);
      }
    }
    // Normalize, dedupe, limit length
    const norm = topics
      .map(t => t.replace(/[:\-–—]+$/, '').trim())
      .filter(Boolean)
      .map(t => t.length > 140 ? t.slice(0, 140) : t);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of norm) {
      const key = t.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(t); }
    }
    return out;
  };

  const submitTrainingPlan = async () => {
    if (!selectedAgent) return;
    const topics = extractTopicsFromAssessment(assessmentText);
    if (!topics.length) { alert('No topics detected. Paste the self-assessment text.'); return; }
    try {
      const res = await fetch(`/api/agents/${selectedAgent.id}/training-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics, options: { perTopicMax: 200, throttleMs: 6000, maxTasksPerTick: 1, verifyWithDeepseek: true, verificationMode: 'advisory' } }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { alert('Failed to create training plan: ' + (data.error || res.statusText)); return; }
      setLastPlanId(data.planId);
      setShowLearnModal(false);
      alert(`Training plan created with ${topics.length} topics. Tracking progress in Training tab.`);
    } catch (e) {
      alert('Error creating training plan');
    }
  };

  const pauseSelectedDiscovery = async (pause: boolean) => {
    if (selectedAgentIds.length === 0) {
      showToast('No agents selected', 'error');
      return;
    }

    try {
      // Pause discovery for each selected agent's active training plan
      const results = await Promise.allSettled(
        selectedAgentIds.map(async (agentId) => {
          // Get the agent's active training plan
          const agent = agents.find(a => a.id === agentId);
          if (!agent) return;

          // Find active plan for this agent from plansById
          const activePlan = Object.values(plansById).find((p: any) => 
            p.plan?.agentId === agentId && (p.plan?.status === 'running' || p.plan?.status === 'pending')
          );

          if (activePlan) {
            const response = await fetch(`/api/agents/training/plan/${activePlan.plan.id}/pause-discovery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pause }),
            });

            if (!response.ok) {
              throw new Error(`Failed to ${pause ? 'pause' : 'resume'} discovery for ${agent.name}`);
            }
          }
        })
      );

      const failed = results.filter(r => r.status === 'rejected').length;
      const succeeded = results.length - failed;

      if (succeeded > 0) {
        showToast(`${pause ? 'Paused' : 'Resumed'} discovery for ${succeeded} agent(s)`, 'success');
      }
      if (failed > 0) {
        showToast(`Failed to update ${failed} agent(s)`, 'error');
      }

      // Refresh plan status
      if (lastPlanId) {
        setTimeout(() => fetchPlanStatus(lastPlanId), 500);
      }
    } catch (error) {
      console.error('Error updating selected agents discovery:', error);
      showToast(`Failed to ${pause ? 'pause' : 'resume'} selected agents`, 'error');
    }
  };

  const pauseAllDiscovery = async (pause: boolean) => {
    try {
      // Get all active training plans (running, pending, or active)
      const allActivePlans = Object.values(plansById).filter((p: any) => 
        p.plan?.status === 'running' || p.plan?.status === 'pending'
      );

      console.log('[FeedAgents] Found active plans:', allActivePlans.length);
      
      if (allActivePlans.length === 0) {
        // Try to fetch fresh data and retry once
        console.log('[FeedAgents] No active plans found, fetching fresh data...');
        
        // Refresh plans data by re-fetching from batch status
        if (batchStatus?.tasks) {
          const toFetch: { agentId: string; planId: string }[] = [];
          for (const t of batchStatus.tasks as any[]) {
            if (t.planId) {
              toFetch.push({ agentId: t.agentId, planId: t.planId });
            }
          }
          
          const fetched: Record<string, any> = {};
          for (const { agentId, planId } of toFetch) {
            try {
              const r = await fetch(`/api/agents/${agentId}/training-plan/${planId}`, { cache: 'no-store' });
              const j = await r.json();
              if (j.ok) { fetched[planId] = j; }
            } catch (error) {
              console.error(`[FeedAgents] Failed to fetch plan ${planId}:`, error);
            }
          }
          
          if (Object.keys(fetched).length) {
            setPlansById(prev => ({ ...prev, ...fetched }));
            
            // Check again for active plans after refresh
            const refreshedPlans = Object.values(fetched).filter((p: any) => 
              p.plan?.status === 'running' || p.plan?.status === 'pending'
            );
            
            if (refreshedPlans.length > 0) {
              allActivePlans.push(...refreshedPlans);
            }
          }
        }
        
        if (allActivePlans.length === 0) {
          showToast('No active training plans found. Please ensure agents have active training plans.', 'error');
          return;
        }
      }

      // Pause discovery for all active plans
      const results = await Promise.allSettled(
        allActivePlans.map(async (planData: any) => {
          console.log(`[FeedAgents] ${pause ? 'Pausing' : 'Resuming'} discovery for plan:`, planData.plan.id);
          
          const response = await fetch(`/api/agents/training/plan/${planData.plan.id}/pause-discovery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pause }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[FeedAgents] API error for plan ${planData.plan.id}:`, errorText);
            throw new Error(`Failed to ${pause ? 'pause' : 'resume'} plan ${planData.plan.id}: ${errorText}`);
          }
          
          const result = await response.json();
          console.log(`[FeedAgents] Successfully ${pause ? 'paused' : 'resumed'} plan:`, planData.plan.id, result);
          return result;
        })
      );

      const failed = results.filter(r => r.status === 'rejected').length;
      const succeeded = results.length - failed;

      if (succeeded > 0) {
        showToast(`${pause ? 'Paused' : 'Resumed'} discovery for ${succeeded} training plan(s)`, 'success');
      }
      if (failed > 0) {
        const failedReasons = results
          .filter(r => r.status === 'rejected')
          .map(r => (r as any).reason?.message || 'Unknown error')
          .join(', ');
        console.error('[FeedAgents] Failed operations:', failedReasons);
        showToast(`Failed to update ${failed} training plan(s): ${failedReasons}`, 'error');
      }

      // Refresh plan status for all plans
      if (succeeded > 0) {
        // Refresh the current plan status
        if (lastPlanId) {
          setTimeout(() => fetchPlanStatus(lastPlanId), 500);
        }
        // Also refresh all plans to update the UI
        setTimeout(() => fetchCurrentTrainingStatus(), 500);
      }
    } catch (error) {
      console.error('Error updating all discovery:', error);
      showToast(`Failed to ${pause ? 'pause' : 'resume'} all discovery`, 'error');
    }
  };

  const focusOnFeeding = async () => {
    try {
      console.log('[FeedAgents] Focus on Feeding - pausing discovery and prioritizing feeding...');
      
      // First pause all discovery
      await pauseAllDiscovery(true);
      
      // Show a message about what's happening
      showToast('🍽️ Focusing on feeding existing discoveries to agents. Discovery paused.', 'success');
      
      // Switch to Training Tracker tab to show feeding progress
      setActiveTab('training');
      
    } catch (error) {
      console.error('Error focusing on feeding:', error);
      showToast('Failed to focus on feeding', 'error');
    }
  };

  const submitTrainingPlanFromTopics = async () => {
    if (!selectedAgent) return;
    const topics = topicsFromDeepseek;
    if (!topics || !topics.length) { setShowLearnModal(true); return; }
    try {
      const res = await fetch(`/api/agents/${selectedAgent.id}/training-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics, options: { perTopicMax: 200, throttleMs: 6000, maxTasksPerTick: 1, verifyWithDeepseek: true, verificationMode: 'advisory' } }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { alert('Failed to create training plan: ' + (data.error || res.statusText)); return; }
      setLastPlanId(data.planId);
      alert(`Training plan created with ${topics.length} topics from Deepseek. Tracking progress in Training tab.`);
    } catch (e) {
      alert('Error creating training plan');
    }
  };

  // Poll plan status when lastPlanId is set
  useEffect(() => {
    if (!selectedAgent || !lastPlanId) return;
    let t: any;
    const poll = async () => {
      try {
        const r = await fetch(`/api/agents/${selectedAgent.id}/training-plan/${lastPlanId}`, { cache: 'no-store' });
        const j = await r.json();
        if (j.ok) setPlanStatus(j); else setPlanStatus(null);
      } catch {}
      t = setTimeout(poll, 3000);
    };
    poll();
    return () => { if (t) clearTimeout(t); };
  }, [selectedAgent?.id, lastPlanId]);

  const runAudit = async () => {
    if (!selectedAgent || !lastPlanId) return;
    setIsAuditing(true);
    setAuditResult(null);
    try {
      const r = await fetch(`/api/agents/${selectedAgent.id}/training-plan/${lastPlanId}/audit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 20 })
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { alert('Audit failed: ' + (j.error || r.statusText)); return; }
      setAuditResult(j);
    } catch {
      alert('Audit error');
    } finally {
      setIsAuditing(false);
    }
  };

  // Fetch plan status for the current agent and plan
  const fetchPlanStatus = async (planId: string) => {
    if (!selectedAgent || !planId) return;
    try {
      const r = await fetch(`/api/agents/${selectedAgent.id}/training-plan/${planId}`, { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setPlanStatus(j); else setPlanStatus(null);
    } catch (error) {
      console.error('Failed to fetch plan status:', error);
      setPlanStatus(null);
    }
  };

  // Pause/Resume discovery for the current plan
  const togglePauseDiscovery = async (pause: boolean) => {
    if (!lastPlanId) return;
    try {
      const r = await fetch(`/api/agents/training/plan/${lastPlanId}/pause-discovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pause }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        showToast(j.message || 'Failed to update discovery state', 'error');
        return;
      }
      if (selectedAgent) {
        try {
          const r2 = await fetch(`/api/agents/${selectedAgent.id}/training-plan/${lastPlanId}`, { cache: 'no-store' });
          const j2 = await r2.json();
          if (j2.ok) setPlanStatus(j2);
        } catch {}
      }
      
      // Also refresh all plans to update the UI
      setTimeout(() => fetchCurrentTrainingStatus(), 500);
      
      showToast(pause ? 'Discovery paused' : 'Discovery resumed', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Error updating discovery state', 'error');
    }
  };

  // Check server info on mount and fetch current training status
  useEffect(() => {
    if (isProduction) {
      // Try to get server info by making a test request
      fetch('/api/agents/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          operation: 'feed',
          agentIds: ['test'],
          feedItem: { content: 'test', sourceType: 'manual' }
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.results?.serverInfo) {
          setServerInfo(data.results.serverInfo);
        }
      })
      .catch(() => {
        // Ignore errors - just means we can't get server info
      });
    }

    // Fetch current training status on mount
    fetchCurrentTrainingStatus();
  }, [isProduction]);

  // Fetch current training status from all active plans
  const fetchCurrentTrainingStatus = async () => {
    try {
      // Get all agents first
      const agentsRes = await fetch('/api/agents', { cache: 'no-store' });
      const agentsData = await agentsRes.json();
      if (agentsData.agents) {
        setAgents(agentsData.agents);
      }

      // Try to get current batch status if there's an active batch
      // This will help us get the real numbers from the logs
      const batchRes = await fetch('/api/agents/training-records', { cache: 'no-store' });
      const batchData = await batchRes.json();
      if (batchData.ok && batchData.batch) {
        setBatchStatus(batchData.batch);
        setBatchId(batchData.batch.id);
      }
    } catch (error) {
      console.error('Error fetching current training status:', error);
    }
  };
  const [selectedAgentForTraining, setSelectedAgentForTraining] = useState<Agent | null>(null);
  const [preview, setPreview] = useState<FeedPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFeeding, setIsFeeding] = useState(false);
  const [retrievalQuery, setRetrievalQuery] = useState('');
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [retrievalResults, setRetrievalResults] = useState<any[]>([]);
  // Feed Topic PDFs pipeline
  const [pdfTopic, setPdfTopic] = useState('');
  const [pdfMax, setPdfMax] = useState(3);
  const [pdfPreferRaw, setPdfPreferRaw] = useState(true);
  const [isFeedingPdfs, setIsFeedingPdfs] = useState(false);
  const [pdfFeedResults, setPdfFeedResults] = useState<any[]>([]);

  // Load agents on component mount
  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      // Load database agents
      const response = await fetch('/api/agents');
      const data = await response.json();
      const dbAgents: Agent[] = ((data.agents || []) as Agent[]).filter((a:any)=> a.isActive !== false);
      const byNameDB = new Map<string, Agent>();
      const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, ' ').trim();
      for (const a of dbAgents) byNameDB.set(norm(a.name), a);

      // Build the canonical 20 strictly from FEATURED_AGENTS ids, hydrating from DB by name only
      const allAgents: Agent[] = FEATURED_AGENTS.map(f => {
        const hydrated = byNameDB.get(norm(f.name));
        const base: Agent = {
          id: hydrated?.id || f.id, // use database ID if exists, otherwise use canonical ID
          name: f.name,
          persona: f.personality.approach,
          domainExpertise: f.domains,
          associatedPatches: [],
          metadata: {
            role: f.personality.expertise,
            expertise: f.strengths,
            avatar: f.avatar,
            councilMembership: [],
            userVisibility: 'public',
            trainingEnabled: true
          } as any,
          createdAt: new Date().toISOString()
        } as Agent;
        if (hydrated) {
          // merge non-id fields from DB and use database ID
          base.id = hydrated.id; // Use the actual database ID
          base.domainExpertise = Array.from(new Set([...(base.domainExpertise||[]), ...(hydrated.domainExpertise||[])]));
          base.metadata = {
            ...(base.metadata||{}),
            ...(hydrated.metadata||{}),
            avatar: (hydrated.metadata as any)?.avatar || (base.metadata as any)?.avatar,
            role: (hydrated.metadata as any)?.role || (base.metadata as any)?.role,
          } as any;
        }
        return base;
      }).sort((a,b)=> a.name.localeCompare(b.name));
      setAgents(allAgents);
      
      // Auto-select the first agent if none is selected
      if (allAgents.length > 0 && !selectedAgent) {
        setSelectedAgent(allAgents[0]);
      }
      // Keep selection coherent if Select All was previously used
      setSelectedAgentIds(prev => prev.filter(id => allAgents.some(a => a.id === id)));
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  // Selection helpers
  const toggleSelectAll = () => {
    if (selectedAgentIds.length === filteredAgents.length) {
      setSelectedAgentIds([]);
    } else {
      setSelectedAgentIds(filteredAgents.map(a => a.id));
    }
  };
  const toggleSelectAgent = (id: string) => {
    setSelectedAgentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Simple toast helper
  const showToast = (msg: string, kind: 'info'|'success'|'error' = 'info') => {
    setToastKind(kind);
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Bulk Assess Knowledge via batch API
  const assessKnowledgeForSelected = async () => {
    if (selectedAgentIds.length === 0) return;
    try {
      showToast('Assessment started for selected agents', 'info');
      setActiveTab('training');
      const res = await fetch('/api/agents/batch/assess', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentIds: selectedAgentIds })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) { showToast(j.message || 'Failed to start batch', 'error'); return; }
      setBatchId(j.batch.id);

      // NEW: Kick off gap-driven feeding across PDFs/Wikipedia/Books for all selected agents
      try {
        await fetch('/api/agents/batch/feed-gaps', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentIds: selectedAgentIds, perAgent: { maxTopics: 4, maxPdfsPerTopic: 2 } })
        });
        showToast('Started gap-based feeding for selected agents (PDFs, books, Wikipedia).', 'info');
      } catch {}
    } catch (e:any) {
      showToast(e?.message || 'Error starting assessment batch', 'error');
    }
  };

  // Poll batch status
  useEffect(() => {
    if (!batchId) return;
    let timer: any;
    const poll = async () => {
      try {
        const r = await fetch(`/api/agents/batch/${batchId}/status`, { cache: 'no-store' });
        const j = await r.json();
        if (j.ok) setBatchStatus(j.batch);
      } catch {}
      timer = setTimeout(poll, 3000);
    };
    poll();
    return () => timer && clearTimeout(timer);
  }, [batchId]);

  // When batchStatus updates, fetch any missing plan details for tasks that have a planId
  useEffect(() => {
    const run = async () => {
      if (!batchStatus?.tasks) return;
      const toFetch: { agentId: string; planId: string }[] = [];
      for (const t of batchStatus.tasks as any[]) {
        if (t.planId && !plansById[t.planId]) {
          toFetch.push({ agentId: t.agentId, planId: t.planId });
        }
      }
      if (!toFetch.length) return;
      const fetched: Record<string, any> = {};
      for (const { agentId, planId } of toFetch) {
        try {
          const r = await fetch(`/api/agents/${agentId}/training-plan/${planId}`, { cache: 'no-store' });
          const j = await r.json();
          if (j.ok) { fetched[planId] = j; }
        } catch {}
      }
      if (Object.keys(fetched).length) {
        setPlansById(prev => ({ ...prev, ...fetched }));
      }
    };
    run();
  }, [batchStatus]);

  // One-time: auto-dedupe duplicates on load (silent)
  useEffect(() => {
    const onceKey = 'carrot_dedupe_ran';
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(onceKey) === '1') return;
    (async () => {
      try { await fetch('/api/agents/dedupe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apply: true }) }); } catch {}
      localStorage.setItem(onceKey, '1');
      // reload agents list after dedupe
      try { await loadAgents(); } catch {}
    })();
  }, []);

  // Poll discoveries for active plan with filters
  useEffect(() => {
    if (!lastPlanId) { setDiscoveries([]); return; }
    let timer: any;
    const fetchDiscoveries = async () => {
      try {
        const params = new URLSearchParams();
        if (discTopic && discTopic !== '__all__') params.set('topic', discTopic);
        if (discStatus && discStatus !== '__all__') params.set('status', discStatus);
        params.set('limit', '200');
        const r = await fetch(`/api/agents/training/plan/${lastPlanId}/discoveries?${params.toString()}`, { cache: 'no-store' });
        const j = await r.json();
        if (j.ok) setDiscoveries(j.items || []);
      } catch {}
      timer = setTimeout(fetchDiscoveries, 4000);
    };
    fetchDiscoveries();
    return () => timer && clearTimeout(timer);
  }, [lastPlanId, discTopic, discStatus]);

  // Parse comma/newline separated tags, dedupe while preserving order
  const parseTags = (raw: string): string[] => {
    try {
      const items = raw
        .split(/[\n,]/g)
        .map(s => s.trim())
        .filter(Boolean)
      const seen = new Set<string>()
      const out: string[] = []
      for (const t of items) {
        const key = t.toLowerCase()
        if (!seen.has(key)) { seen.add(key); out.push(t) }
      }
      return out
    } catch {
      return []
    }
  }

  const handlePreview = async () => {
    if (!selectedAgent || !feedContent.trim()) return;

    setIsLoading(true);
    try {
      const tags = parseTags(tagsInput);
      const response = await fetch(`/api/agents/${selectedAgent.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: feedContent,
          sourceType,
          sourceTitle: sourceTitle || undefined,
          sourceAuthor: sourceAuthor || undefined,
          sourceUrl: sourceUrl || undefined,
          tags,
        }),
      });

      const data = await response.json();
      setPreview(data.preview);
    } catch (error) {
      console.error('Error previewing feed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeed = async () => {
    if (!selectedAgent || !feedContent.trim()) return;

    setIsFeeding(true);
    try {
      const tags = parseTags(tagsInput);
      const response = await fetch(`/api/agents/${selectedAgent.id}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: feedContent,
          sourceType,
          sourceTitle: sourceTitle || undefined,
          sourceAuthor: sourceAuthor || undefined,
          sourceUrl: sourceUrl || undefined,
          tags,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Reset form
        setFeedContent('');
        setSourceTitle('');
        setSourceAuthor('');
        setSourceUrl('');
        setTagsInput('');
        setPreview(null);
        alert(`Successfully fed ${data.result.chunkCount} memory chunks to ${selectedAgent.name}`);
      } else {
        alert('Error feeding agent: ' + data.error);
      }
    } catch (error) {
      console.error('Error feeding agent:', error);
      alert('Error feeding agent');
    } finally {
      setIsFeeding(false);
    }
  };

  const handleAutoRetrieve = async () => {
    if (!retrievalQuery.trim() || !selectedAgent) return;

    setIsRetrieving(true);
    try {
      const response = await fetch(`/api/agents/${selectedAgent.id}/retrieve-specific`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: retrievalQuery,
          sourceTypes: ['wikipedia', 'arxiv', 'news', 'academic', 'pubmed', 'stackoverflow', 'github', 'books'],
          maxResults: 20, // Increased from 5 to 20
          openAccessOnly: true,
          autoFeed: true
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setRetrievalResults(data.results || []);
        alert(`Successfully retrieved and fed ${data.results?.length || 0} pieces of content to ${selectedAgent.name}`);
        setRetrievalQuery('');
      } else {
        alert('Error retrieving content: ' + data.error);
      }
    } catch (error) {
      console.error('Error in auto-retrieve:', error);
      alert('Error retrieving content');
    } finally {
      setIsRetrieving(false);
    }
  };

  // Feed Topic PDFs end-to-end pipeline trigger
  const handleFeedTopicPdfs = async () => {
    if (!selectedAgent || !pdfTopic.trim()) return;
    setIsFeedingPdfs(true);
    try {
      const res = await fetch(`/api/agents/${selectedAgent.id}/feed-topic-pdfs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: pdfTopic, maxPdfs: pdfMax, preferRaw: pdfPreferRaw, tags: ['pdf', pdfTopic] })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        showToast(j.error || 'Failed to feed PDFs', 'error');
      } else {
        setPdfFeedResults(j.results || []);
        showToast(`Fed ${j.totals?.succeeded || 0}/${j.totals?.requested || 0} PDFs to ${selectedAgent.name}`, 'success');
      }
    } catch (e:any) {
      showToast(e?.message || 'Error feeding PDFs', 'error');
    } finally {
      setIsFeedingPdfs(false);
    }
  };

  const handleDeepLearning = async () => {
    if (!selectedAgent) return;

    setIsRetrieving(true);
    try {
      // Deep learning mode: comprehensive training across all expertise areas
      const response = await fetch(`/api/agents/${selectedAgent.id}/deep-learning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTypes: ['wikipedia', 'arxiv', 'news', 'academic', 'pubmed', 'stackoverflow', 'github', 'books', 'papers'],
          maxResults: 50, // Much more comprehensive
          openAccessOnly: true,
          autoFeed: true
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setRetrievalResults(data.results || []);
        alert(`Deep learning complete! Fed ${data.results?.length || 0} pieces of content to ${selectedAgent.name}`);
      } else {
        alert('Error in deep learning: ' + data.error);
      }
    } catch (error) {
      console.error('Error in deep learning:', error);
      alert('Error in deep learning');
    } finally {
      setIsRetrieving(false);
    }
  };

  const handleWikipediaDeepLearning = async () => {
    if (!selectedAgent) return;

    // Get a Wikipedia page suggestion based on agent expertise
    const pageTitle = getWikipediaSuggestion(selectedAgent);
    
    setIsRetrieving(true);
    try {
      const response = await fetch(`/api/agents/${selectedAgent.id}/wikipedia-deep-learning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageTitle,
          includeReferences: true,
          maxReferences: 15,
          minReliability: 'medium'
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(`Wikipedia deep learning complete! Processed ${data.result?.processedReferences || 0} references for ${selectedAgent.name} from "${pageTitle}"`);
      } else {
        alert('Error in Wikipedia deep learning: ' + data.error);
      }
    } catch (error) {
      console.error('Error in Wikipedia deep learning:', error);
      alert('Error in Wikipedia deep learning');
    } finally {
      setIsRetrieving(false);
    }
  };

  const getWikipediaSuggestion = (agent: any): string => {
    // Generate a Wikipedia page suggestion based on agent expertise
    for (const domain of agent.domainExpertise) {
      switch (domain.toLowerCase()) {
        case 'physics':
          return 'Quantum mechanics';
        case 'economics':
          return 'Economics';
        case 'computer science':
          return 'Artificial intelligence';
        case 'biology':
          return 'Evolution';
        case 'civil rights':
          return 'Civil rights movement';
        case 'politics':
          return 'Democracy';
        default:
          return 'Science';
      }
    }
    return 'Science';
  };

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.domainExpertise.some(expertise => 
      expertise.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* AI Training Status Banner */}
        {isProduction && (
          <div className={`mb-6 p-4 rounded-lg border ${
            'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Zap className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-green-800">
                  AI Training Available
                </h3>
                <p className="text-sm mt-1 text-green-700">
                  AI agent training is now enabled on this server. You can use all training features with improved memory management.
                </p>
                {serverInfo && (
                  <div className="mt-2 text-xs text-gray-600">
                    Server: {serverInfo.isRender ? 'Render' : 'Unknown'} | 
                    Memory: {serverInfo.memoryUsage} / {serverInfo.totalMemory} | 
                    Tier: {serverInfo.isFreeTier ? 'Free' : 'Paid'}
                  </div>
                )}
                {serverInfo?.isFreeTier && (
                  <div className="mt-2">
                    <a 
                      href="/AI_TRAINING_SETUP.md" 
                      className="text-sm text-yellow-800 underline hover:text-yellow-900"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View setup instructions →
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Agent Training</h1>
              <p className="text-gray-600">Feed knowledge to AI agents and manage their memories</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowBatchModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                disabled={isProduction && serverInfo?.isFreeTier}
              >
                <Zap className="w-4 h-4" />
                Batch Feed
              </Button>
              <Button
                onClick={assessKnowledgeForSelected}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                disabled={selectedAgentIds.length === 0}
                title={selectedAgentIds.length === 0 ? 'Select agents first' : 'Assess Knowledge for selected agents'}
              >
                Assess Knowledge
              </Button>
            </div>
          </div>
          {toastMsg && (
            <div className={`mt-3 p-3 rounded border ${toastKind==='error' ? 'bg-red-50 border-red-200 text-red-800' : toastKind==='success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
              {toastMsg}
            </div>
          )}

          {/* Agent Selector */}
          <div className="mt-6 mb-6">
            <Label htmlFor="agent-select" className="text-sm font-medium text-gray-700 mb-2 block">
              Select Agent to Train
            </Label>
            <Select
              value={selectedAgent?.id || ''}
              onValueChange={(agentId) => {
                const agent = agents.find(a => a.id === agentId);
                setSelectedAgent(agent || null);
              }}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Choose an agent to train..." />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 shadow-lg">
                {filteredAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id} className="bg-white hover:bg-gray-50 focus:bg-gray-50">
                    <div className="flex items-center gap-2 w-full">
                      <AvatarImage
                        src={(agent.metadata as any)?.avatar || '/avatar-placeholder.svg'}
                        alt={agent.name}
                        size={32}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{agent.name}</div>
                        <div className="text-xs text-gray-500 truncate">{agent.domainExpertise.slice(0, 2).join(', ')}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Admin Bar (simplified) */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border rounded p-3 flex items-center gap-3 flex-wrap">
          <Button onClick={toggleSelectAll} variant="outline">
            {selectedAgentIds.length === filteredAgents.length && filteredAgents.length>0 ? 'Clear All' : 'Select All'}
          </Button>
          <Button
            onClick={assessKnowledgeForSelected}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            disabled={selectedAgentIds.length === 0}
            title={selectedAgentIds.length === 0 ? 'Select agents first' : 'Assess Knowledge for selected agents'}
          >
            Assess Knowledge
          </Button>
          <div className="h-5 w-px bg-gray-200 mx-1" />
          <Button variant="outline" onClick={()=> pauseAllDiscovery(true)}>Pause All Discovery</Button>
          <Button variant="outline" onClick={()=> pauseAllDiscovery(false)}>Resume All</Button>
          <Button 
            variant="primary" 
            onClick={() => focusOnFeeding()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            🍽️ Focus on Feeding
          </Button>
          <div className="ml-auto text-xs text-gray-600">{selectedAgentIds.length} selected</div>
        </div>

        <Tabs value={activeTab} onValueChange={(v)=> setActiveTab(v as any)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="agents">Agent Registry</TabsTrigger>
            <TabsTrigger value="feed">Feed Content</TabsTrigger>
            <TabsTrigger value="memories">Memory Viewer</TabsTrigger>
            <TabsTrigger value="training">Training Tracker</TabsTrigger>
            <TabsTrigger value="dashboard">Training Dashboard</TabsTrigger>
            <TabsTrigger value="overview">Agents Overview</TabsTrigger>
            <TabsTrigger value="discoveries">Discovery History</TabsTrigger>
          </TabsList>

          {/* Agent Registry Tab */}
          <TabsContent value="agents" className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search agents by name or expertise..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button onClick={toggleSelectAll} variant="outline">
                {selectedAgentIds.length === filteredAgents.length && filteredAgents.length>0 ? 'Clear All' : 'Select All'}
              </Button>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAgents.map((agent) => (
                <Card key={agent.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedAgentIds.includes(agent.id)}
                        onChange={() => toggleSelectAgent(agent.id)}
                        className="w-4 h-4 accent-blue-600"
                        aria-label={`Select ${agent.name}`}
                      />
                      <AvatarImage
                        src={(agent.metadata as any)?.avatar || '/avatar-placeholder.svg'}
                        alt={agent.name}
                        size={48}
                      />
                      <div>
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <CardDescription>
                          {agent.metadata.role || 'AI Agent'}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {(agent.metadata as any)?.role || agent.persona}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {agent.domainExpertise.slice(0, 3).map((expertise) => (
                        <Badge key={expertise} variant="secondary" className="text-xs">
                          {expertise}
                        </Badge>
                      ))}
                      {agent.domainExpertise.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{agent.domainExpertise.length - 3} more
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSelectedAgent(agent); setActiveTab('feed'); }}
                        title="Feed content to this agent"
                      >
                        <Brain className="w-4 h-4 mr-1" />
                        Feed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSelectedAgent(agent); setActiveTab('memories'); }}
                        title="Open memory viewer for this agent"
                      >
                        <BookOpen className="w-4 h-4 mr-1" />
                        View Memories
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Agents Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <AgentsOverview />
          </TabsContent>

          {/* Feed Content Tab */}
          <TabsContent value="feed" className="space-y-6">
            {selectedAgent ? (
              <>
                {/* Agent Context Header */}
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                        {selectedAgent.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-xl text-blue-900">
                          Training {selectedAgent.name}
                        </CardTitle>
                        <CardDescription className="text-blue-700">
                          {selectedAgent.metadata.role || 'AI Agent'} • {selectedAgent.domainExpertise.slice(0, 3).join(', ')}
                          {selectedAgent.domainExpertise.length > 3 && ` +${selectedAgent.domainExpertise.length - 3} more`}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-blue-600">Expertise Areas</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedAgent.domainExpertise.slice(0, 4).map((expertise) => (
                            <Badge key={expertise} variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                              {expertise}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Agent Self-Assessment Chat */}
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-lg text-green-800 flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      {selectedAgent.name} Self-Assessment Chat
                    </CardTitle>
                    <CardDescription className="text-green-700">
                      {selectedAgent.name} analyzes their current knowledge and identifies areas for deeper learning
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AgentSelfAssessmentChat key={selectedAgent.id} agent={selectedAgent} onTopics={(t)=> setTopicsFromDeepseek(t)} />
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xs text-green-800">
                        {topicsFromDeepseek.length > 0 ? `${topicsFromDeepseek.length} topics detected from Deepseek` : 'No topics detected yet'}
                      </div>
                      <Button className="bg-green-600 hover:bg-green-700" onClick={submitTrainingPlanFromTopics}>
                        {topicsFromDeepseek.length > 0 ? 'Learn these topics' : 'Parse & Learn topics'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Agent-Specific Automated Content Retrieval */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="w-5 h-5" />
                      Smart Content Retrieval for {selectedAgent.name}
                    </CardTitle>
                    <CardDescription>
                      Automatically find and feed content relevant to {selectedAgent.name}'s expertise areas
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder={`Search for content relevant to ${selectedAgent.name} (e.g., '${selectedAgent.domainExpertise[0] || 'quantum mechanics'}')`}
            value={retrievalQuery}
            onChange={(e) => setRetrievalQuery(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={handleAutoRetrieve}
            disabled={!retrievalQuery.trim() || isRetrieving}
            className="bg-green-600 hover:bg-green-700"
          >
            {isRetrieving ? 'Retrieving...' : `Auto-Feed ${selectedAgent.name}`}
          </Button>
          <Button
            onClick={handleDeepLearning}
            disabled={isRetrieving}
            className="bg-blue-600 hover:bg-blue-700"
            title="Comprehensive learning with 50+ sources"
          >
            {isRetrieving ? 'Learning...' : 'Deep Learning'}
          </Button>
          <Button
            onClick={handleWikipediaDeepLearning}
            disabled={isRetrieving}
            className="bg-purple-600 hover:bg-purple-700"
            title="Deep Wikipedia learning with all references"
          >
            {isRetrieving ? 'Learning...' : 'Wikipedia Deep'}
          </Button>
        </div>
                    {retrievalResults.length > 0 && (
                      <div className="mt-4 p-3 bg-green-50 rounded-lg">
                        <h4 className="font-medium text-green-800 mb-2">Retrieval Results</h4>
                        <div className="text-sm text-green-700">
                          Successfully fed {retrievalResults.length} pieces of content to {selectedAgent.name}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select an Agent to Begin Training
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Choose an agent from the registry to start feeding content and training
                  </p>
                  <Button onClick={() => setSelectedAgent(agents[0])}>
                    Select First Agent
                  </Button>
                </CardContent>
              </Card>
            )}

            {selectedAgent ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Feed Form */}
                <Card>
                  <CardHeader>
                    <CardTitle>Feed Content to {selectedAgent.name}</CardTitle>
                    <CardDescription>
                      Add new knowledge to this agent's memory
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="sourceType">Source Type</Label>
                      <Select value={sourceType} onValueChange={setSourceType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual Input</SelectItem>
                          <SelectItem value="url">Web URL</SelectItem>
                          <SelectItem value="file">File Upload</SelectItem>
                          <SelectItem value="post">Carrot Post</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {sourceType === 'url' && (
                      <div>
                        <Label htmlFor="sourceUrl">Source URL</Label>
                        <Input
                          id="sourceUrl"
                          value={sourceUrl}
                          onChange={(e) => setSourceUrl(e.target.value)}
                          placeholder="https://example.com/article"
                        />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="sourceTitle">Title (Optional)</Label>
                      <Input
                        id="sourceTitle"
                        value={sourceTitle}
                        onChange={(e) => setSourceTitle(e.target.value)}
                        placeholder="Article or document title"
                      />
                    </div>

                    <div>
                      <Label htmlFor="sourceAuthor">Author (Optional)</Label>
                      <Input
                        id="sourceAuthor"
                        value={sourceAuthor}
                        onChange={(e) => setSourceAuthor(e.target.value)}
                        placeholder="Author name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="tagsInput">Tags (comma or newline separated)</Label>
                      <Textarea
                        id="tagsInput"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="Paste tags separated by commas or newlines"
                        rows={4}
                      />
                      <div className="text-xs text-gray-500 mt-1">We split on commas/newlines and remove duplicates.</div>
                    </div>

                    <div>
                      <Label htmlFor="content">Content</Label>
                      <Textarea
                        id="content"
                        value={feedContent}
                        onChange={(e) => setFeedContent(e.target.value)}
                        placeholder="Enter the content to feed to the agent..."
                        rows={8}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handlePreview}
                        disabled={!feedContent.trim() || isLoading}
                        variant="outline"
                      >
                        {isLoading ? 'Previewing...' : 'Preview'}
                      </Button>
                      <Button
                        onClick={handleFeed}
                        disabled={!feedContent.trim() || isFeeding}
                      >
                        {isFeeding ? 'Feeding...' : 'Feed Agent'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Preview Panel */}
                <Card>
                  <CardHeader>
                    <CardTitle>Feed Preview</CardTitle>
                    <CardDescription>
                      See how the content will be processed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {preview ? (
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Content Summary</h4>
                          <p className="text-sm text-gray-600 line-clamp-3">
                            {preview.content}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Processing Details</h4>
                          <div className="text-sm space-y-1">
                            <p><strong>Source Type:</strong> {preview.sourceType}</p>
                            {preview.sourceTitle && (
                              <p><strong>Title:</strong> {preview.sourceTitle}</p>
                            )}
                            {preview.sourceAuthor && (
                              <p><strong>Author:</strong> {preview.sourceAuthor}</p>
                            )}
                            <p><strong>Chunks:</strong> {preview.chunks.length}</p>
                            <p><strong>Estimated Memories:</strong> {preview.estimatedMemories}</p>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Content Chunks</h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {preview.chunks.map((chunk, index) => (
                              <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                                <strong>Chunk {index + 1}:</strong> {chunk.substring(0, 100)}...
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">
                        Click "Preview" to see how the content will be processed
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select an Agent
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Choose an agent from the registry to start feeding content
                  </p>
                  <Button onClick={() => setSelectedAgent(agents[0])}>
                    Select First Agent
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Memory Viewer Tab */}
          <TabsContent value="memories" className="space-y-6">
            {selectedAgent ? (
              <div className="space-y-6">
                <MemoryViewer agentId={selectedAgent.id} agentName={selectedAgent.name} />
                <StudyRecord agentId={selectedAgent.id} agentName={selectedAgent.name} />
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select an Agent
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Choose an agent from the registry to view their memories and study record
                  </p>
                  <Button onClick={() => setSelectedAgent(agents[0])}>
                    Select First Agent
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Training Tracker Tab (single-agent focus) */}
          <TabsContent value="training" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Training Tracker {selectedAgent ? `• ${selectedAgent.name}` : ''}</h3>
                <Button 
                  onClick={fetchCurrentTrainingStatus}
                  variant="outline"
                  size="sm"
                >
                  Refresh Status
                </Button>
              </div>
              {!selectedAgent && (
                <p className="text-gray-600">Select an agent to view their training progress.</p>
              )}

              {/* Bulk Assessment Status (multi-agent) */}
              {batchStatus && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span>Bulk Assessment Status</span>
                        {/* Plan-level error summary */}
                        {Array.isArray(batchStatus.tasks) && batchStatus.tasks.some((x:any)=> !!x.lastError) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-700 text-[11px] font-medium" title="One or more tasks failed. Hover tasks to see error.">
                            Errors: {batchStatus.tasks.filter((x:any)=> !!x.lastError).length}
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-normal text-gray-500">Batch <span className="font-mono">{batchStatus.id}</span> • {batchStatus.status}</span>
                    </CardTitle>
                    <CardDescription>
                      {batchStatus.agentIds?.length || 0} agents • discovered {batchStatus.totals?.discovered || 0} • fed {batchStatus.totals?.fed || 0}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {(batchStatus.tasks || []).map((t: any) => {
                        const planned = t.itemsPlanned || 0;
                        const fed = t.itemsFed || 0;
                        const pct = planned > 0 ? Math.min(100, Math.round((fed / planned) * 100)) : 0;
                        const agent = agents.find(a => a.id === t.agentId);
                        return (
                          <div key={t.id} className="p-2 border rounded bg-white">
                            <div className="flex items-center justify-between text-sm">
                              <div className="truncate mr-3">
                                <span className="font-medium">{agent?.name || t.agentId}</span>
                                <span className="ml-2 text-gray-600">stage: {t.stage}</span>
                                <span className="ml-2 text-gray-600">status: {t.status}</span>
                              </div>
                              {(t.planId) && (
                                <div className="flex items-center gap-2">
                                  <div className="text-xs text-gray-500">plan <span className="font-mono">{t.planId}</span></div>
                                  {plansById[t.planId]?.plan && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={`h-6 px-2 ${plansById[t.planId].plan.options?.pauseDiscovery ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700' : ''}`}
                                      onClick={() => togglePauseDiscovery(!plansById[t.planId].plan.options?.pauseDiscovery)}
                                      title={plansById[t.planId].plan.options?.pauseDiscovery ? 'Resume discovery' : 'Pause discovery'}
                                    >
                                      {plansById[t.planId].plan.options?.pauseDiscovery ? 'Resume' : 'Pause'}
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="mt-2">
                              <div className="w-full h-2 bg-gray-100 rounded">
                                <div className={`h-2 rounded ${pct===100? 'bg-green-500':'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <div className="mt-1 text-xs text-gray-600">{fed} fed / {planned} discovered ({pct}%)</div>
                              {t.lastError && (
                                <div className="mt-1">
                                  <span
                                    className="inline-flex items-center px-2 py-[2px] rounded bg-red-100 text-red-700 border border-red-200 text-[11px]"
                                    title={t.lastError}
                                  >
                                    Error
                                  </span>
                                </div>
                              )}
                            </div>
                            {t.planId && plansById[t.planId] && (
                              <div className="mt-2 text-xs text-gray-700">
                                <div className="flex flex-wrap gap-2">
                                  <span className="px-2 py-1 bg-gray-50 rounded border">queued {plansById[t.planId].plan.totals.queued}</span>
                                  <span className="px-2 py-1 bg-gray-50 rounded border">running {plansById[t.planId].plan.totals.running}</span>
                                  <span className="px-2 py-1 bg-gray-50 rounded border">done {plansById[t.planId].plan.totals.done}</span>
                                  <span className="px-2 py-1 bg-gray-50 rounded border">failed {plansById[t.planId].plan.totals.failed}</span>
                                  <span className="px-2 py-1 bg-gray-50 rounded border">skipped {plansById[t.planId].plan.totals.skipped}</span>
                                  <span className="px-2 py-1 bg-gray-50 rounded border">fed {plansById[t.planId].plan.totals.fed}</span>
                                </div>
                                {/* Plan topics preview */}
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {((plansById[t.planId].plan.topics as string[]) || []).slice(0, 6).map((topic: string, idx: number) => (
                                    <span key={idx} className="inline-flex items-center px-2 py-[2px] rounded-full border bg-white text-[11px] text-gray-700" title={topic}>
                                      {topic}
                                    </span>
                                  ))}
                                  {((plansById[t.planId].plan.topics as string[]) || []).length > 6 && (
                                    <span className="inline-flex items-center px-2 py-[2px] rounded-full border bg-white text-[11px] text-gray-500">
                                      +{(plansById[t.planId].plan.topics as string[]).length - 6} more
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 max-h-24 overflow-y-auto">
                                  {(plansById[t.planId].tasks || []).slice(0, 8).map((pt: any) => (
                                    <div key={pt.id} className="flex items-center justify-between">
                                      <span className="truncate mr-2" title={`${pt.topic} (page ${pt.page})`}>{pt.topic}</span>
                                      <span className="text-gray-500">pg {pt.page} • {pt.status} • fed {pt.itemsFed||0}</span>
                                    </div>
                                  ))}
                                  {(plansById[t.planId].tasks || []).length > 8 && (
                                    <div className="text-[11px] text-gray-500 mt-1">and more…</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedAgent && !lastPlanId && (
                <p className="text-gray-600">Create a training plan from the self-assessment to see live progress here.</p>
              )}

              {selectedAgent && planStatus && (
                <>
                  <div className="text-sm">
                    <div className="mb-2 flex items-center gap-3 flex-wrap">
                      <div>
                        Plan: <span className="font-mono">{lastPlanId}</span> • Status: <span className="font-medium">{planStatus.plan.status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className={planStatus?.plan?.options?.pauseDiscovery ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700' : ''}
                          onClick={() => togglePauseDiscovery(!planStatus?.plan?.options?.pauseDiscovery)}
                        >
                          {planStatus?.plan?.options?.pauseDiscovery ? 'Resume Discovery' : 'Pause Discovery'}
                        </Button>
                        {planStatus?.plan?.options?.pauseDiscovery && (
                          <span className="text-xs text-amber-700">Discovery paused — feeding continues</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                      <div className="p-2 bg-gray-50 rounded">Queued: {planStatus.plan.totals.queued}</div>
                      <div className="p-2 bg-gray-50 rounded">Running: {planStatus.plan.totals.running}</div>
                      <div className="p-2 bg-gray-50 rounded">Done: {planStatus.plan.totals.done}</div>
                      <div className="p-2 bg-gray-50 rounded">Failed: {planStatus.plan.totals.failed}</div>
                      <div className="p-2 bg-gray-50 rounded">Skipped: {planStatus.plan.totals.skipped}</div>
                      <div className="p-2 bg-gray-50 rounded">Fed: {planStatus.plan.totals.fed}</div>
                    </div>
                  </div>

                  {/* Per-topic progress list */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Trainable topics</h4>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {planStatus.tasks?.map((t: any) => (
                        <div key={t.id} className="text-sm flex items-center justify-between border rounded px-2 py-1 bg-white">
                          <div className="truncate mr-3" title={`${t.topic} (page ${t.page})`}>{t.topic}</div>
                          <div className="text-xs text-gray-600">pg {t.page} • {t.status} • fed {t.itemsFed||0}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Discoveries panel (tasks act as discovered pages) */}
                  <div className="space-y-2 mt-4">
                    <h4 className="font-medium">Discoveries</h4>
                    <div className="text-xs text-gray-600">These are discovered pages by topic. Pausing discovery stops adding new pages; feeding continues for queued ones.</div>
                    <div className="flex items-center gap-2 text-sm">
                      <label className="text-gray-700">Filter:</label>
                      <select
                        className="border rounded px-2 py-1"
                        onChange={(e)=>{
                          const v = e.target.value;
                          const el = document.getElementById('discoveries-list');
                          if (!el) return;
                          for (const child of Array.from(el.children)) {
                            const topic = (child as HTMLElement).getAttribute('data-topic')||'';
                            (child as HTMLElement).style.display = (!v || v==='__all__' || v===topic) ? '' : 'none';
                          }
                        }}
                      >
                        <option value="__all__">All topics</option>
                        {Array.from(new Set((planStatus.tasks||[]).map((t:any)=> t.topic))).map((topic: any)=> (
                          <option key={topic} value={topic}>{topic}</option>
                        ))}
                      </select>
                    </div>
                    <div id="discoveries-list" className="space-y-1 max-h-64 overflow-y-auto">
                      {(planStatus.tasks||[]).map((t:any)=> (
                        <div key={`disc-${t.id}`} data-topic={t.topic} className="text-xs flex items-center justify-between border rounded px-2 py-1 bg-white">
                          <div className="truncate mr-3" title={`${t.topic} (page ${t.page})`}>{t.topic} • pg {t.page}</div>
                          <div className="text-gray-600">{t.status}{typeof t.itemsFed==='number' ? ` • fed ${t.itemsFed}`:''}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Audit section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Audit (Deepseek)</h4>
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={runAudit} disabled={isAuditing}>
                        {isAuditing ? 'Auditing…' : 'Run Audit'}
                      </Button>
                    </div>
                    {!auditResult && (
                      <div className="text-xs text-gray-500">Audits validate whether fed sources truly support the topics. Click Run Audit.</div>
                    )}
                    {auditResult && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-2 bg-green-50 border border-green-200 rounded">
                          <div className="text-sm font-medium text-green-800 mb-1">Approved ({auditResult.approved?.length || 0})</div>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {(auditResult.approved || []).map((a: any) => (
                              <div key={a.id} className="text-xs">
                                <div className="font-medium truncate" title={a.title}>{a.title}</div>
                                <div className="text-green-700 truncate" title={a.url}>{a.url}</div>
                                <div className="text-[11px] text-green-800">{a.topic} • {typeof a.quality==='number'? `q=${a.quality.toFixed(2)}`: ''}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="p-2 bg-red-50 border border-red-200 rounded">
                          <div className="text-sm font-medium text-red-800 mb-1">Flagged ({auditResult.flagged?.length || 0})</div>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {(auditResult.flagged || []).map((a: any) => (
                              <div key={a.id} className="text-xs">
                                <div className="font-medium truncate" title={a.title}>{a.title}</div>
                                <div className="text-red-700 truncate" title={a.url}>{a.url}</div>
                                <div className="text-[11px] text-red-800">{a.topic} • {a.reason || 'not relevant'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reuse dashboard chart for the single agent */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Coverage by expertise</h4>
                    <AgentTrainingDashboard 
                      selectedAgentId={selectedAgent?.id}
                      refreshToken={batchStatus?.updatedAt || (batchStatus ? JSON.stringify(batchStatus.totals||{}) : undefined)}
                      onAgentSelect={(agentId)=>{
                        const a = agents.find(a=> a.id===agentId); setSelectedAgent(a||null);
                      }}
                    />
                  </div>
                </>
              )}

            </div>
          </TabsContent>

          {/* Training Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Training Dashboard</h3>
                  <p className="text-gray-600 text-sm">Cumulative stats and per-agent overview. Always populated from historical data.</p>
                </div>
                <Button variant="outline" onClick={() => setActiveTab('discoveries')}>View Discoveries</Button>
              </div>

              <AgentTrainingDashboard 
                selectedAgentId={selectedAgent?.id}
                refreshToken={batchStatus?.updatedAt || (batchStatus ? JSON.stringify(batchStatus.totals||{}) : undefined)}
                onAgentSelect={(agentId:string)=>{
                  const a = agents.find(x=> x.id===agentId) || null;
                  setSelectedAgent(a);
                }}
              />
            </div>
          </TabsContent>

          {/* Discovery History Tab */}
          <TabsContent value="discoveries" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Discovery History</h3>
                  <p className="text-sm text-gray-600">
                    View all content discovered during agent training sessions
                  </p>
                </div>
                {selectedAgent && (
                  <div className="text-sm text-gray-600">
                    Viewing discoveries for: <span className="font-medium">{selectedAgent.name}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Discovery History - All Agents</h3>
                    <p className="text-sm text-gray-600">Viewing discoveries for all agents across all training plans</p>
                  </div>
                  <Button 
                    onClick={fetchCurrentTrainingStatus}
                    variant="outline"
                    size="sm"
                  >
                    Refresh Data
                  </Button>
                </div>
                <DiscoveryHistoryViewer 
                  planId={undefined}
                  agentId={undefined}
                  className="w-full"
                  showAllAgents={true}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Batch Feed Modal */}
      <BatchFeedModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        agents={agents}
      />

      {/* Agent Training Workflow Modal */}
      {selectedAgentForTraining && (
        <AgentTrainingWorkflow
          agent={selectedAgentForTraining}
          onClose={() => {
            setShowTrainingWorkflow(false);
            setSelectedAgentForTraining(null);
          }}
        />
      )}

      {/* Learn Topics Modal */}
      <Sheet open={showLearnModal} onOpenChange={setShowLearnModal}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Learn these topics</SheetTitle>
            <SheetDescription>Paste the self-assessment text. We will extract topics and create a durable training plan (200 items per topic by default).</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Label htmlFor="assessmentText">Self-assessment text</Label>
            <Textarea id="assessmentText" rows={14} value={assessmentText} onChange={(e)=> setAssessmentText(e.target.value)} placeholder="Paste the self-assessment here…" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=> setShowLearnModal(false)}>Cancel</Button>
              <Button onClick={submitTrainingPlan} className="bg-green-600 hover:bg-green-700">Create Training Plan</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
