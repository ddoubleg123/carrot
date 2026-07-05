'use client';

import { useState, useEffect } from 'react';

const PHASES = [
  {
    id: 'phase1', label: 'Phase 1', title: 'Site Investigation',
    subtitle: 'Do these first — they govern everything else', color: '#0ea5e9',
    items: [
      { id: 'p1-1', text: 'Level 3 Soil Survey', agency: 'Environmental Health / DES', note: 'Georgia DPH certified Soil Classifier. Required before septic permit. Determines septic field location across both lots. Borings to 6 ft, USDA Soil Series classification, suitability codes, and soil map.' },
      { id: 'p1-3', text: 'Combination Plat / Boundary Survey', agency: 'Licensed Surveyor / DES', note: 'Must be less than 2 years old for building permit submittal. Covers combined footprint of both lots.' },
      { id: 'p1-4', text: 'Topographic Survey', agency: 'Licensed Surveyor / DES', note: '2-foot contour intervals, NAVD 88 datum. Required on all grading and drainage submittals. Must show offsite drainage areas and flow arrows. Not included in soil report or combination plat — separate deliverable needed from DES.' },
      // Floodplain analysis removed — Andrea Yager (Cherokee County Stormwater) confirmed 7/5/2026: no floodplain on these parcels
    ]
  },
  {
    id: 'phase2', label: 'Phase 2', title: 'Engineering & Design',
    subtitle: 'All require Georgia-licensed PE stamp', color: '#8b5cf6',
    items: [
      { id: 'p2-1', text: 'Stream / Drainage Crossing Design', agency: 'PE / DES', note: 'If driveway crosses eastern drainage feature. PE must provide 100-yr storm calcs, pipe size, type, slope, length, and erosion control. Access must be 3 ft above FEMA 100-yr BFE.' },
      { id: 'p2-2', text: 'Lot Grading Plan (LGP) or Land Disturbance Permit (LDP)', agency: 'PE / DES', note: 'LGP if disturbance < 1 acre. LDP if ≥ 1 acre. DES to assess after footprint is set. Includes grading, drainage, stormwater to GSWMM standards.' },
      { id: 'p2-3', text: 'Stormwater Management Design', agency: 'PE / DES', note: 'Designed for 25-year storm event. Pre- vs. post-development runoff analysis. Slope toward eastern drainage is the key constraint.' },
      { id: 'p2-4', text: 'Erosion & Sedimentation Control Plan', agency: 'NPDES Certified / DES', note: 'Stabilized entrance, silt fencing, sediment controls, grassing/mulching every 7 days. NOI to Georgia EPD via GEOS if tertiary permittee.' },
      { id: 'p2-5', text: 'House Location Plan (HLP)', agency: 'PE / Surveyor', note: 'Scaled site drawing — property lines, setbacks, footprint, driveway, septic. Use Cherokee County DSC HLP template. Less than 2 years old.' },
      { id: 'p2-6', text: 'GDOT / County Driveway Entrance Plan', agency: 'PE / DES', note: 'Sherwood Ln has no curb & gutter — separate driveway permit required. GDOT Entrance Plan if applicable.' },
    ]
  },
  {
    id: 'phase3', label: 'Phase 3', title: 'Pre-Permit Applications',
    subtitle: 'Must be approved before building permit is issued', color: '#f59e0b',
    items: [
      { id: 'p3-1', text: 'Septic Permit — Environmental Health', agency: 'NGHD', note: 'Apply with NGHD before DSC building permit. Requires approved Level 3 Soil Survey. Two inspections: pre-construction and pre-backfill.' },
      { id: 'p3-2', text: 'Erosion & Sedimentation Control Permit', agency: 'Cherokee County Engineering', note: 'Must be in hand before any ground disturbance. Erosion control is the first construction inspection — no work begins until it passes.' },
      { id: 'p3-3', text: 'Driveway Permit', agency: 'Cherokee County DSC', note: 'Required — Sherwood Ln has no curb & gutter. Apply through DSC before building permit submittal.' },
      { id: 'p3-4', text: 'NOI — Georgia EPD (if tertiary permittee)', agency: 'Georgia EPD', note: 'Submit via GEOS system if lot was purchased from a previously permitted larger development.' },
    ]
  },
  {
    id: 'phase4', label: 'Phase 4', title: 'Building Permit Submittal',
    subtitle: 'Via CityView Portal — no cash as of Jan 1, 2026', color: '#22c55e',
    items: [
      { id: 'p4-1', text: 'Complete Residential Permit Application', agency: 'Cherokee County DSC', note: 'Submit via CityView Portal. P.O. Box instead of physical address is a common rejection reason.' },
      { id: 'p4-2', text: 'Approved Septic Permit', agency: 'NGHD', note: 'Must be issued by Environmental Health before DSC issues building permit.' },
      { id: 'p4-3', text: 'Approved Driveway Permit', agency: 'Cherokee County DSC', note: 'Must be pre-approved if not part of a larger common development.' },
      { id: 'p4-4', text: 'House Location Plan (HLP)', agency: 'Licensed Surveyor', note: 'Survey or plat, not more than 2 years old. Use DSC HLP template and checklist.' },
      { id: 'p4-5', text: 'Trade Affidavits — Electrical, Mechanical, Plumbing', agency: 'Subcontractors', note: 'Original and notarized. One per trade.' },
      { id: 'p4-6', text: 'Sewer Affidavit', agency: 'Contractor', note: 'Required per 2024 DSC update.' },
      { id: 'p4-7', text: 'Temp-to-Perm Power Affidavit', agency: 'Electrical Contractor', note: 'Required at time of permit submittal.' },
      { id: 'p4-8', text: 'State Contractor\'s License', agency: 'GC / Contractor', note: 'Georgia State Licensing Board license. Verify at sos.ga.gov.' },
      { id: 'p4-9', text: 'Business License', agency: 'GC / Contractor', note: 'Copy of contractor\'s company business license.' },
      { id: 'p4-10', text: 'Authorized Permit Agent Form (if applicable)', agency: 'Agent', note: 'One original per permit if someone other than the licensed contractor pulls the permit.' },
      { id: 'p4-11', text: 'Proof of Water Service', agency: 'Utility / Well Driller', note: 'Well permit or utility connection approval.' },
      { id: 'p4-12', text: 'Fee Payment', agency: 'Cherokee County DSC', note: 'Permit fee (sq ft based) + Impact fee $2,560.59 + CO fee $50.00. 3% card fee. No cash.' },
    ]
  },
  {
    id: 'phase5', label: 'Phase 5', title: 'Construction Inspections',
    subtitle: 'Schedule via CityView Portal only', color: '#ef4444',
    items: [
      { id: 'p5-1', text: '① Erosion Control', agency: 'Cherokee County', note: 'FIRST inspection. No work begins until this passes.' },
      { id: 'p5-2', text: '② Septic Pre-Construction Verification', agency: 'NGHD', note: 'Environmental Health verifies layout before construction starts.' },
      { id: 'p5-3', text: '③ Footings / Foundation', agency: 'Building Dept', note: 'Inspected before concrete pour.' },
      { id: 'p5-4', text: '④ Rough Framing', agency: 'Building Dept', note: 'Before insulation or drywall.' },
      { id: 'p5-5', text: '⑤ Rough Electrical', agency: 'Building Dept', note: 'Before wall cover.' },
      { id: 'p5-6', text: '⑥ Rough Mechanical (HVAC)', agency: 'Building Dept', note: 'Before wall cover.' },
      { id: 'p5-7', text: '⑦ Rough Plumbing', agency: 'Building Dept', note: 'Before wall cover.' },
      { id: 'p5-8', text: '⑧ Insulation', agency: 'Building Dept', note: 'Required after rough, BEFORE wall and ceiling cover. Mandatory since Jan 1, 2011.' },
      { id: 'p5-9', text: '⑨ Foundation Survey', agency: 'Licensed Surveyor', note: 'Mid-construction as-built survey.' },
      { id: 'p5-10', text: '⑩ Septic Final — Pre-Backfill', agency: 'NGHD', note: 'Do not cover system until this passes.' },
      { id: 'p5-11', text: '⑪ Final Electrical', agency: 'Building Dept', note: '' },
      { id: 'p5-12', text: '⑫ Final Mechanical', agency: 'Building Dept', note: '' },
      { id: 'p5-13', text: '⑬ Final Plumbing', agency: 'Building Dept', note: '' },
      { id: 'p5-14', text: '⑭ Final Building Inspection', agency: 'Building Dept', note: 'Re-inspection fee: $25/$50/$100 for 1st/2nd/3rd same-item failures.' },
    ]
  },
  {
    id: 'phase6', label: 'Phase 6', title: 'Certificate of Occupancy',
    subtitle: 'Issued only after all inspections pass', color: '#14b8a6',
    items: [
      { id: 'p6-1', text: 'All Inspection Approvals Confirmed', agency: 'Building Dept', note: 'Every inspection must show approved in CityView Portal.' },
      { id: 'p6-2', text: 'CO Fee Paid — $50.00', agency: 'Cherokee County DSC', note: '3% card fee applies.' },
      { id: 'p6-3', text: 'Certificate of Occupancy Issued', agency: 'Cherokee County DSC', note: 'Permit valid 1 year; must commence within 6 months or it lapses.' },
    ]
  },
];

const STORAGE_KEY = 'permit-tracker-v1';

type State = {
  checked: Record<string, boolean>;
  notes: Record<string, string>;
  status: Record<string, string>;
  dates: Record<string, string>;
  assignee: Record<string, string>;
};

// Seed state for completed items — only applied on first load (no existing localStorage)
const INITIAL_STATE: State = {
  checked: {
    'p1-1': true,  // Level 3 Soil Survey — complete
    'p1-3': true,  // Boundary Survey — covered by combination plat
  },
  status: {
    'p1-1': 'done',
    'p1-3': 'done',
  },
  notes: {
    'p1-1': 'COMPLETE — DES Report #26.306.1, dated 6/9/2026. Study date 6/1/2026. Rep: Ben Moers. Soils: Cecil (A), Pacolet (A), Hard Labor II (P). All suitable for conventional septic. Parcels 03N18 168 & 03N18 169, 4.21 acres, 3.54 acres evaluated.',
    'p1-3': 'COMPLETE — Combination plat (Lots 5, 6 & portion of 7) drafted by DES, Project #26-306. Signed Change Order #1 on 6/12/2026. Plat in DRAFT, submitted for Cherokee County review. 4.22 acres total. Recording fee $35 included in CO#1.',
  },
  dates: {
    'p1-1': '2026-06-09',
    'p1-3': '2026-06-12',
  },
  assignee: {
    'p1-1': 'DES / Ben Moers',
    'p1-3': 'DES / Rebecca Martin',
  },
};

const STATUS_CYCLE = ['todo', 'progress', 'blocked'];
const STATUS_LABELS: Record<string, string> = { todo: 'To Do', progress: 'In Progress', blocked: 'Blocked', done: 'Done' };
const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-800 text-slate-500 border border-slate-700',
  progress: 'bg-blue-950 text-blue-400 border border-blue-800',
  blocked: 'bg-red-950 text-red-400 border border-red-900',
  done: 'bg-green-950 text-green-400 border border-green-900',
};

export default function PermitPage() {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({});
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STATE));
    } catch {}
  }, []);

  const save = (next: State) => {
    setState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const allItems = PHASES.flatMap(p => p.items);
  const totalDone = allItems.filter(i => state.checked[i.id]).length;
  const pct = Math.round((totalDone / allItems.length) * 100);

  const phaseDone = (phase: typeof PHASES[0]) => phase.items.filter(i => state.checked[i.id]).length;

  const toggleCheck = (id: string) => {
    const next = { ...state, checked: { ...state.checked, [id]: !state.checked[id] } };
    if (next.checked[id]) next.status = { ...next.status, [id]: 'done' };
    else if (next.status[id] === 'done') next.status = { ...next.status, [id]: 'todo' };
    save(next);
  };

  const cycleStatus = (id: string) => {
    if (state.checked[id]) return;
    const cur = state.status[id] || 'todo';
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
    save({ ...state, status: { ...state.status, [id]: next } });
  };

  const updateNote = (id: string, val: string) => save({ ...state, notes: { ...state.notes, [id]: val } });
  const updateDate = (id: string, val: string) => save({ ...state, dates: { ...state.dates, [id]: val } });
  const updateAssignee = (id: string, val: string) => save({ ...state, assignee: { ...state.assignee, [id]: val } });

  const togglePhase = (id: string) => setOpenPhases(p => ({ ...p, [id]: p[id] === false ? true : false }));
  const toggleItem = (id: string) => setOpenItems(p => ({ ...p, [id]: !p[id] }));

  const isPhaseOpen = (id: string) => openPhases[id] !== false;

  const visibleItems = (phase: typeof PHASES[0]) =>
    phase.items.filter(item => {
      if (search) {
        const q = search.toLowerCase();
        if (!item.text.toLowerCase().includes(q) && !item.agency.toLowerCase().includes(q)) return false;
      }
      if (filter === 'all') return true;
      const s = state.status[item.id] || 'todo';
      const done = !!state.checked[item.id];
      if (filter === 'done') return done;
      if (filter === 'todo') return !done && s !== 'progress' && s !== 'blocked';
      if (filter === 'progress') return s === 'progress';
      if (filter === 'blocked') return s === 'blocked';
      return true;
    });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-gray-500 tracking-widest uppercase mb-1">Cherokee County, GA · New SFR Construction</p>
            <h1 className="text-2xl font-bold text-white">Permit Tracker</h1>
            <p className="text-sm text-gray-400 mt-1">146 & 148 Sherwood Ln, Canton, GA 30115 · ~4 acres · DES Project #26-306</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-extrabold text-green-400">{pct}%</div>
            <div className="text-xs text-gray-500">{totalDone} of {allItems.length} complete</div>
            {saved && <div className="text-xs text-green-400 mt-1">Saved ✓</div>}
          </div>
        </div>
        <div className="max-w-4xl mx-auto mt-4">
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Filters + Search */}
        <div className="flex gap-2 mb-5 flex-wrap items-center">
          {['all','todo','progress','blocked','done'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize
                ${filter === f ? 'bg-gray-700 border-gray-500 text-white' : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'}`}>
              {f === 'all' ? 'All' : STATUS_LABELS[f] || f}
            </button>
          ))}
          <input
            className="ml-auto bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-blue-500 w-48 placeholder-gray-600"
            placeholder="Search items…"
            value={search}
            onChange={e => { setSearch(e.target.value); if (e.target.value) setOpenPhases({}); }}
          />
          <button onClick={() => setOpenPhases({})} className="text-xs text-gray-500 hover:text-gray-300 px-2">Expand all</button>
          <button onClick={() => { const c: Record<string,boolean> = {}; PHASES.forEach(p => c[p.id] = false); setOpenPhases(c); }}
            className="text-xs text-gray-500 hover:text-gray-300 px-2">Collapse all</button>
        </div>

        {/* Phase blocks */}
        {PHASES.map(phase => {
          const done = phaseDone(phase);
          const items = visibleItems(phase);
          const phasePct = Math.round((done / phase.items.length) * 100);
          if (items.length === 0 && (search || filter !== 'all')) return null;

          return (
            <div key={phase.id} className="mb-4 rounded-xl border border-gray-800 overflow-hidden">
              {/* Phase header */}
              <button onClick={() => togglePhase(phase.id)} className="w-full bg-gray-900 hover:bg-gray-800 transition-colors px-5 py-4 flex items-center gap-4 text-left">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{ background: `${phase.color}18`, border: `1.5px solid ${phase.color}44`, color: phase.color }}>
                  {done === phase.items.length ? '✓' : done > 0 ? '◑' : '○'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold tracking-widest uppercase" style={{ color: phase.color }}>{phase.label}</span>
                    <span className="text-sm font-semibold text-gray-100">{phase.title}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{phase.subtitle}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-semibold" style={{ color: done === phase.items.length ? phase.color : '#e2e8f0' }}>
                    {done}/{phase.items.length}
                  </div>
                  <div className="h-1 w-16 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${phasePct}%`, background: phase.color }} />
                  </div>
                </div>
                <span className={`text-gray-500 text-xs transition-transform duration-200 ${isPhaseOpen(phase.id) ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {/* Items */}
              {isPhaseOpen(phase.id) && (
                <div>
                  {items.map((item, idx) => {
                    const done = !!state.checked[item.id];
                    const s = done ? 'done' : (state.status[item.id] || 'todo');
                    const expanded = !!openItems[item.id];
                    return (
                      <div key={item.id} className={`border-t border-gray-800 ${idx % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/50'} ${done ? 'opacity-60' : ''}`}>
                        <div className="px-5 py-3 flex items-start gap-3">
                          {/* Checkbox */}
                          <button onClick={() => toggleCheck(item.id)}
                            className="w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border-2 transition-all"
                            style={{ borderColor: done ? phase.color : '#374151', background: done ? phase.color : 'transparent' }}>
                            {done && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <span className={`text-sm font-medium ${done ? 'line-through text-gray-600' : 'text-gray-100'}`}>{item.text}</span>
                              <div className="flex gap-2 items-center flex-shrink-0 flex-wrap">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700 whitespace-nowrap">{item.agency}</span>
                                <button onClick={() => cycleStatus(item.id)}
                                  className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap transition-colors ${STATUS_COLORS[s]}`}>
                                  {STATUS_LABELS[s]}
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <button onClick={() => toggleItem(item.id)}
                                className={`text-xs transition-colors ${expanded ? 'text-blue-400' : 'text-gray-600 hover:text-gray-400'}`}>
                                {expanded ? '▲ hide' : '▼ details & notes'}
                              </button>
                              {state.dates[item.id] && <span className="text-xs text-gray-600">· Due {state.dates[item.id]}</span>}
                              {state.assignee[item.id] && <span className="text-xs text-gray-600">· {state.assignee[item.id]}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {expanded && (
                          <div className="px-5 pb-4 pl-13" style={{ paddingLeft: '3.25rem' }}>
                            {item.note && (
                              <p className="text-xs text-gray-500 leading-relaxed border-l-2 border-gray-700 pl-3 mb-3">{item.note}</p>
                            )}
                            <div className="mb-3">
                              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1.5">Your Notes</label>
                              <textarea
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-700 outline-none focus:border-blue-500 resize-y min-h-[60px] leading-relaxed"
                                placeholder="Add notes, contacts, quotes, timeline…"
                                value={state.notes[item.id] || ''}
                                onChange={e => updateNote(item.id, e.target.value)}
                              />
                            </div>
                            <div className="flex gap-4 flex-wrap">
                              <div>
                                <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Due Date</label>
                                <input type="date" value={state.dates[item.id] || ''} onChange={e => updateDate(item.id, e.target.value)}
                                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-blue-500 [color-scheme:dark]" />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Assignee</label>
                                <input type="text" value={state.assignee[item.id] || ''} onChange={e => updateAssignee(item.id, e.target.value)}
                                  placeholder="e.g. Davis Eng, GC…"
                                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-blue-500 w-44" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Footer */}
        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900 px-5 py-4 text-xs text-gray-500 leading-7">
          <span className="text-gray-400 font-medium">Contacts: </span>
          DSC (770) 721-7810 · Becky Kerstetter bkerstetter@cherokeecountyga.gov ·
          Stormwater stormwater@cherokeecountyga.gov · Davis Engineering (706) 265-1234 ·
          NGHD Environmental Health: nghd.org · CityView: cityview.cherokeega.com
          <br/>
          <span className="text-gray-400 font-medium">Notes: </span>
          2024 I-Codes in effect Jan 1 2026 · Permit valid 1 yr, commence within 6 mo · Hours 7am–7pm · Lot combination must be done before all other activities
        </div>
      </div>
    </div>
  );
}
