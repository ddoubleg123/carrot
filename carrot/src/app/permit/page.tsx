'use client';

import { useState, useEffect } from 'react';

const PHASES = [
  {
    id: 'phase0', label: 'Utilities', title: 'Utilities & Infrastructure',
    subtitle: 'Independent of architect — start now', color: '#f97316',
    items: [
      { id: 'u1', text: 'CCWSA — Water Service Connection', agency: 'CCWSA / Brad Payne', note: 'Payment made 7/13/2026. Service Request #425859. 1" meter. $4,675 paid by credit card ($100 deposit + $4,500 installation + $75 stand pipe). Account # assigned on first bill. Location of Water Service card received — must be posted at right-of-way on Sherwood Ln, visible from road, within 24 hours of purchase. CCWSA installs 2–4 weeks after card is posted. Contact Brad Payne (770) 479-1813 Ext. 1265 / bradp@ccwsa.com. No sewer on Sherwood Ln — septic is only path.', actionNow: '⚠️ URGENT — Post Location of Water Service card (#425859) on the right-of-way at Sherwood Ln NOW. Must be visible from road. 24-hour deadline from purchase 7/13/2026. Meter installed 2–4 weeks after posting.' },
      { id: 'u2', text: 'Sawnee EMC — Temporary & Permanent Power', agency: 'Sawnee EMC', note: 'Called Sawnee EMC 7/14/2026. (770) 887-2363. Two steps required before temporary meter can be ordered: (1) Install temporary pole and meter base on site. (2) Must have Cherokee County building permit in hand first — cannot start anything until permit is issued. Awaiting email from Sawnee EMC confirming whether 200-Amp Meter Socket is required.', actionNow: 'Awaiting Sawnee EMC email on 200-Amp socket confirmation. Both steps blocked until building permit is issued.' },
    ]
  },
  {
    id: 'phase1', label: 'Phase 1', title: 'Site Investigation',
    subtitle: 'Do these first — they govern everything else', color: '#0ea5e9',
    items: [
      { id: 'p1-1', text: 'Level 3 Soil Survey', agency: 'DES / Ben Moers', note: 'COMPLETE — Report #26.306.1, 6/9/2026. Soils: Cecil (A), Pacolet (A), Hard Labor II (P). All suitable for conventional septic. 4.21 acres, 3.54 evaluated.' },
      { id: 'p1-3', text: 'Combination Plat / Boundary Survey', agency: 'DES / Rebecca Martin', note: 'DRAFTED — CO#1 signed 6/12/2026. Submitted for Cherokee County review. Must be RECORDED before septic permit application can be processed.' },
      { id: 'p1-4', text: 'Topographic Survey', agency: 'DES', note: 'COMPLETE — Topo data collected as part of original contract scope. CAD file to be delivered at project end. Can be used by any engineer for plan production.' },
    ]
  },
  {
    id: 'phase2', label: 'Phase 2', title: 'Engineering & Design',
    subtitle: 'All items are one LGP package — DES (Payton Anderson)', color: '#8b5cf6',
    items: [
      { id: 'p2-sw', text: 'Cherokee County Stormwater — LGP Confirmation', agency: 'stormwater@cherokeecountyga.gov', note: 'Email sent 7/5/2026. Follow-up sent 7/17/2026. No response. Payton Anderson (DES) said he will get this confirmation once LGP is under contract. Still need official county response.', actionNow: 'Awaiting Cherokee County Stormwater response. DES will also chase once LGP contracted.' },
      { id: 'p2-2', text: 'Lot Grading Plan (LGP) — Full Package', agency: 'DES / Payton Anderson', note: 'Confirmed by Payton Anderson 7/18/2026: LGP is one document covering HLP, grading, drainage, stormwater, erosion control, driveway plan, and stream crossing. Blocked on: (1) Rashid exterior dimensions, (2) stormwater confirmation. Payton needs exterior shape/size only — interior doesn\'t matter. SEQUENCE: LGP first draft submitted → house staked → septic inspection → septic permit.', actionNow: 'Get Rashid exterior dimensions to Payton so DES can start LGP. This unlocks staking and septic.' },
      { id: 'p2-1', text: 'Stream / Drainage Crossing Design', agency: 'DES / Payton Anderson', note: 'LIKELY NOT NEEDED — 30" culvert already installed by prior owner. Prior owner is under stop work order from Cherokee County (not Daniel). County has not required culvert removal. If county allows it to stay in place, no new crossing design required. Payton confirmed: "the creek crossing is already in." Monitor stop work resolution with prior owner.', },
      { id: 'p2-5', text: 'House Location Plan (HLP)', agency: 'DES (Payton) + Rashid', note: 'Part of LGP package. Rashid exterior dimensions already delivered to DES. In progress — cannot stake house until LGP first draft submitted.' },
      { id: 'p2-6', text: 'GDOT / County Driveway Entrance Plan', agency: 'PE / DES', note: 'Part of LGP package. Driveway route discussed with Payton: cross existing culvert, turn left across cleared orchard area (A5/A6/A8/A9) to manage grade — avoids steep existing path. Sherwood Ln has no curb & gutter — separate driveway permit required.' },
    ]
  },
  {
    id: 'phase3', label: 'Phase 3', title: 'Pre-Permit Applications',
    subtitle: 'Must be approved before building permit is issued', color: '#f59e0b',
    items: [
      { id: 'p3-0a', text: 'Property Address Confirmed', agency: 'Owner', note: 'COMPLETE — 146 Sherwood Lane, Canton GA 30115 confirmed and used on all applications.' },
      { id: 'p3-0b', text: 'Combination Plat — Recorded', agency: 'DES / Rebecca Martin', note: 'DES draft submitted. Awaiting Cherokee County approval and recording. Lots 5 & 6. Daniel assigned this to DES (Item 7 in county checklist). Required before septic app can be processed.', actionNow: 'Follow up with DES on recording status — this is the critical blocker.' },
      { id: 'p3-0c', text: 'Hand-Signed Soil Report + House Location on Map', agency: 'DES / Ben Moers + Rashid', note: 'Ben Moers to provide original signed soil report with insurance page to CherokeeEH@dph.ga.gov (Item 2). Rashid to draw house location + driveway on copy of soil map (Item 4). Will not hold up site visit but required before permit is issued.', actionNow: 'Follow up with Ben and Rashid — both need to deliver their part of this.' },
      { id: 'p3-0d', text: 'Stake House + Property Lines', agency: 'DES / Payton Anderson', note: 'COMPLETE — Property lines and house staked. Rashid shared dimensions with DES.' },
      { id: 'p3-1', text: 'Septic Permit Application — In Process', agency: 'CherokeeEH@dph.ga.gov', note: 'Application submitted 7/6/2026. Payton confirmed 7/18/2026: cannot get septic permit until land disturbance permit (LGP) is obtained first. Septic field location: area A4, behind house between the two flow arrows — out of sight, no front clearing needed. 8 bedrooms total (main + ADU). Inspector walks site after house is staked.' },
      { id: 'p3-2', text: 'Erosion & Sedimentation Control Permit', agency: 'Cherokee County Engineering', note: 'Required before any ground disturbance. Blocked until grading plan is ready.' },
      { id: 'p3-3', text: 'Driveway Permit', agency: 'Cherokee County DSC', note: 'Sherwood Ln has no curb & gutter. Apply through DSC before building permit.' },
      { id: 'p3-4', text: 'NOI — Georgia EPD (if tertiary permittee)', agency: 'Georgia EPD', note: 'Required if lot was purchased from a larger previously permitted development.' },
    ]
  },
  {
    id: 'phase4', label: 'Phase 4', title: 'Building Permit Submittal',
    subtitle: 'Via CityView Portal — no cash as of Jan 1, 2026', color: '#22c55e',
    items: [
      { id: 'p4-1', text: 'Complete Residential Permit Application', agency: 'Cherokee County DSC', note: 'Submit via CityView Portal. Use physical address — P.O. Box causes rejection.' },
      { id: 'p4-2', text: 'Approved Septic Permit', agency: 'NGHD', note: 'Must be issued before DSC issues building permit.' },
      { id: 'p4-3', text: 'Approved Driveway Permit', agency: 'Cherokee County DSC', note: 'Must be pre-approved.' },
      { id: 'p4-4', text: 'House Location Plan (HLP)', agency: 'Licensed Surveyor', note: 'Not more than 2 years old. Use DSC template.' },
      { id: 'p4-5', text: 'Trade Affidavits — Electrical, Mechanical, Plumbing', agency: 'Subcontractors', note: 'Original and notarized. One per trade.' },
      { id: 'p4-6', text: 'Sewer Affidavit', agency: 'Contractor', note: 'Required per 2024 DSC update.' },
      { id: 'p4-7', text: 'Temp-to-Perm Power Affidavit', agency: 'Electrical Contractor', note: 'Required at permit submittal.' },
      { id: 'p4-8', text: "State Contractor's License", agency: 'GC', note: 'Georgia State Licensing Board. Verify at sos.ga.gov.' },
      { id: 'p4-9', text: 'Business License', agency: 'GC', note: "Copy of contractor's company license." },
      { id: 'p4-10', text: 'Authorized Permit Agent Form (if applicable)', agency: 'Agent', note: 'Required if someone other than the licensed contractor pulls the permit.' },
      { id: 'p4-11', text: 'Proof of Water Service', agency: 'Utility / Well Driller', note: 'Well permit or utility connection approval.' },
      { id: 'p4-12', text: 'Fee Payment', agency: 'Cherokee County DSC', note: 'Permit fee (sq ft) + Impact fee $2,560.59 + CO fee $50. 3% card surcharge. No cash.' },
    ]
  },
  {
    id: 'phase5', label: 'Phase 5', title: 'Construction Inspections',
    subtitle: 'Schedule via CityView Portal only', color: '#ef4444',
    items: [
      { id: 'p5-1', text: '① Erosion Control', agency: 'Cherokee County', note: 'FIRST. No work begins until this passes.' },
      { id: 'p5-2', text: '② Septic Pre-Construction Verification', agency: 'NGHD', note: 'Environmental Health verifies layout before construction starts.' },
      { id: 'p5-3', text: '③ Footings / Foundation', agency: 'Building Dept', note: 'Before concrete pour.' },
      { id: 'p5-4', text: '④ Rough Framing', agency: 'Building Dept', note: 'Before insulation or drywall.' },
      { id: 'p5-5', text: '⑤ Rough Electrical', agency: 'Building Dept', note: 'Before wall cover.' },
      { id: 'p5-6', text: '⑥ Rough Mechanical (HVAC)', agency: 'Building Dept', note: 'Before wall cover.' },
      { id: 'p5-7', text: '⑦ Rough Plumbing', agency: 'Building Dept', note: 'Before wall cover.' },
      { id: 'p5-8', text: '⑧ Insulation', agency: 'Building Dept', note: 'After rough approval, BEFORE wall/ceiling cover.' },
      { id: 'p5-9', text: '⑨ Foundation Survey', agency: 'Licensed Surveyor', note: 'Mid-construction as-built.' },
      { id: 'p5-10', text: '⑩ Septic Final — Pre-Backfill', agency: 'NGHD', note: 'Do not cover until passed.' },
      { id: 'p5-11', text: '⑪ Final Electrical', agency: 'Building Dept', note: '' },
      { id: 'p5-12', text: '⑫ Final Mechanical', agency: 'Building Dept', note: '' },
      { id: 'p5-13', text: '⑬ Final Plumbing', agency: 'Building Dept', note: '' },
      { id: 'p5-14', text: '⑭ Final Building Inspection', agency: 'Building Dept', note: 'Re-inspection fee: $25/$50/$100 for 1st/2nd/3rd failures.' },
    ]
  },
  {
    id: 'phase6', label: 'Phase 6', title: 'Certificate of Occupancy',
    subtitle: 'Issued only after all inspections pass', color: '#14b8a6',
    items: [
      { id: 'p6-1', text: 'All Inspections Approved', agency: 'Building Dept', note: 'Every inspection must show approved in CityView Portal.' },
      { id: 'p6-2', text: 'CO Fee Paid — $50.00', agency: 'Cherokee County DSC', note: '3% card surcharge applies.' },
      { id: 'p6-3', text: 'Certificate of Occupancy Issued', agency: 'Cherokee County DSC', note: 'Permit valid 1 yr; commence within 6 months.' },
    ]
  },
];

const STORAGE_KEY = 'permit-tracker-v11';

type Item = { id: string; text: string; agency: string; note: string; actionNow?: string };
type State = {
  checked: Record<string, boolean>;
  notes: Record<string, string>;
  status: Record<string, string>;
  dates: Record<string, string>;
  assignee: Record<string, string>;
};

const INITIAL_STATE: State = {
  checked: {
    'p1-1': true,
    'p1-3': false,
    'p1-4': true,
    'p3-0a': true,
    'p3-0d': true,
  },
  status: {
    'u1': 'progress',
    'u2': 'progress',
    'p1-1': 'done',
    'p1-3': 'progress',
    'p1-4': 'done',
    'p2-sw': 'progress',
    'p2-2': 'blocked',
    'p2-1': 'progress',
    'p2-5': 'progress',
    'p2-6': 'todo',
    'p3-0a': 'done',
    'p3-0b': 'progress',
    'p3-0c': 'progress',
    'p3-0d': 'done',
    'p3-1': 'progress',
  },
  notes: {
    'u1': '⚠️ URGENT — Post Location of Water Service card (#425859) on Sherwood Ln right-of-way NOW. Must be visible from road. 24-hour deadline from purchase 7/13/2026. $4,675 paid. SR#425859. CCWSA installs 2–4 weeks after posting.',
    'u2': 'Called 7/14/2026. Blocked on building permit. Need to: (1) install temp pole + meter base, (2) get building permit. Awaiting Sawnee EMC email on 200-Amp socket requirement.',
    'p1-1': 'COMPLETE — DES Report #26.306.1, 6/9/2026. Ben Moers. Cecil (A), Pacolet (A), Hard Labor II (P).',
    'p1-3': 'DRAFT submitted Cherokee County. Must be RECORDED (Lots 5 & 6) before septic app accepted.',
    'p1-4': 'COMPLETE — Topo collected in original scope per Austin McKinney 7/6/2026. CAD file at project end.',
    'p2-5': 'IN PROGRESS — Austin (DES) reached out to Rashid 7/6/2026 for drawings. Rashid confirmed delivery once plans stable. Priority: first floor + ADU.',
    'p3-0a': 'COMPLETE — 146 Sherwood Lane, Canton GA 30115 confirmed on all applications.',
    'p3-0b': 'DES responsible (Daniel Item 7). Draft submitted, awaiting county recording. Critical blocker for septic permit.',
    'p3-0c': 'Ben Moers: signed soil report + insurance page → CherokeeEH@dph.ga.gov (Item 2). Rashid: draw house location + driveway on soil map copy (Item 4). Both in progress.',
    'p3-0d': 'COMPLETE — Property lines and house staked. Rashid shared staking information with DES.',
    'p3-1': 'Application submitted 7/6/2026. County 8-item checklist assigned to Daniel (1,3 ✅), Ben (2), Rashid (4), DES+Rashid (5,6), DES (7). No lot disturbance until permit issued.',
    'p2-sw': 'Email sent 7/5/2026. Follow-up sent 7/17/2026. No response. Payton Anderson said DES will chase confirmation once LGP is under contract.',
    'p2-2': 'Rashid exterior dimensions delivered to DES. Only blocker: Cherokee County stormwater confirmation. Payton ready to proceed.',
    'p2-1': 'LIKELY NOT NEEDED — 30" culvert already in place by prior owner. Prior owner under stop work order, county not requiring removal. Payton confirmed: no new design needed if county allows culvert to stay.',
    'p2-5': 'Part of LGP. Payton needs exterior dimensions from Rashid. Interior changes irrelevant.',
  },
  dates: {
    'p1-1': '2026-06-09',
    'p1-3': '2026-06-12',
    'p3-1': '2026-07-06',
    'p2-sw': '2026-07-05',
  },
  assignee: {
    'p1-1': 'DES / Ben Moers',
    'p1-3': 'DES / Rebecca Martin',
    'p2-sw': 'stormwater@cherokeecountyga.gov',
    'p2-2': 'DES (Austin)',
    'p2-1': 'DES (Austin) — verify 7/22',
    'p2-5': 'DES (Austin) + Rashid Garuba',
    'p3-0b': 'DES / Rebecca Martin',
    'p3-0c': 'Ben Moers + Rashid Garuba',
    'p3-0d': 'DES + Rashid Garuba',
    'p3-1': 'CherokeeEH@dph.ga.gov',
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
    save({ ...state, status: { ...state.status, [id]: STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length] } });
  };

  const updateNote = (id: string, val: string) => save({ ...state, notes: { ...state.notes, [id]: val } });
  const updateDate = (id: string, val: string) => save({ ...state, dates: { ...state.dates, [id]: val } });
  const updateAssignee = (id: string, val: string) => save({ ...state, assignee: { ...state.assignee, [id]: val } });
  const togglePhase = (id: string) => setOpenPhases(p => ({ ...p, [id]: p[id] === false ? true : false }));
  const toggleItem = (id: string) => setOpenItems(p => ({ ...p, [id]: !p[id] }));
  const isPhaseOpen = (id: string) => openPhases[id] !== false;

  const visibleItems = (phase: typeof PHASES[0]) =>
    phase.items.filter((item: Item) => {
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
            <p className="text-sm text-gray-400 mt-1" suppressHydrationWarning>146 & 148 Sherwood Ln, Canton GA 30115 · 4.22 acres · DES Project #26-306</p>
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

        {/* Filters */}
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
            placeholder="Search…"
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
                  <div className="text-sm font-semibold" style={{ color: done === phase.items.length ? phase.color : '#e2e8f0' }}>{done}/{phase.items.length}</div>
                  <div className="h-1 w-16 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${phasePct}%`, background: phase.color }} />
                  </div>
                </div>
                <span className={`text-gray-500 text-xs transition-transform duration-200 ${isPhaseOpen(phase.id) ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {isPhaseOpen(phase.id) && (
                <div>
                  {items.map((item: Item, idx: number) => {
                    const done = !!state.checked[item.id];
                    const s = done ? 'done' : (state.status[item.id] || 'todo');
                    const expanded = !!openItems[item.id];
                    return (
                      <div key={item.id} className={`border-t border-gray-800 ${idx % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/50'} ${done ? 'opacity-60' : ''}`}>
                        <div className="px-5 py-3 flex items-start gap-3">
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

                            {/* Action Now callout — always visible */}
                            {item.actionNow && !done && (
                              <div className="mt-2 flex items-start gap-2 bg-orange-950 border border-orange-700 rounded-lg px-3 py-2">
                                <span className="text-orange-400 text-xs font-bold uppercase tracking-wide mt-0.5 whitespace-nowrap">Do now</span>
                                <span className="text-orange-200 text-xs leading-relaxed">{item.actionNow}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-3 mt-1.5">
                              <button onClick={() => toggleItem(item.id)}
                                className={`text-xs transition-colors ${expanded ? 'text-blue-400' : 'text-gray-600 hover:text-gray-400'}`}>
                                {expanded ? '▲ hide' : '▼ notes'}
                              </button>
                              {state.dates[item.id] && <span className="text-xs text-gray-600">· Due {state.dates[item.id]}</span>}
                              {state.assignee[item.id] && <span className="text-xs text-gray-600">· {state.assignee[item.id]}</span>}
                            </div>
                          </div>
                        </div>

                        {expanded && (
                          <div className="px-5 pb-4" style={{ paddingLeft: '3.25rem' }}>
                            {item.note && (
                              <p className="text-xs text-gray-500 leading-relaxed border-l-2 border-gray-700 pl-3 mb-3">{item.note}</p>
                            )}
                            <div className="mb-3">
                              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1.5">Your Notes</label>
                              <textarea
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-700 outline-none focus:border-blue-500 resize-y min-h-[60px] leading-relaxed"
                                placeholder="Notes…"
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
                                  placeholder="e.g. DES, GC…"
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

        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900 px-5 py-4 text-xs text-gray-500 leading-7">
          <span className="text-gray-400 font-medium">Contacts: </span>
          DSC (770) 721-7810 · Becky Kerstetter bkerstetter@cherokeecountyga.gov · Stormwater stormwater@cherokeecountyga.gov · Andrea Yager adyager@cherokeecountyga.gov · NGHD Env. Health 770-479-0444 · DES Austin McKinney amckinney@davisengineers.com · DES Payton Anderson (engineer) · Ben Moers bmoers@davisengineers.com · (706) 265-1234 · Rashid Garuba (architect) rashidgaruba@gmail.com 770-242-7809 · CCWSA Brad Payne 770-479-1813 Ext.1265 bradp@ccwsa.com · Sawnee EMC Morgan Bennett morgan.bennett@sawnee.coop 770-887-2363 · CityView cityview.cherokeega.com
          <br/>
          <span className="text-gray-400 font-medium">Notes: </span>
          50-ft undisturbed buffer + 75-ft impervious setback from eastern stream · No floodplain on parcels (confirmed 7/5/2026) · Lot combination must precede all other activities · 2024 I-Codes in effect Jan 1 2026 · No cash at DSC
        </div>
      </div>
    </div>
  );
}
