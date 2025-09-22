import Fuse from 'fuse.js';

// Enhanced agent data with expanded keywords for better matching
export const ENHANCED_AGENTS = [
  {
    id: 'madison',
    name: 'James Madison',
    role: 'Democracy',
    avatar: '/agents/James Madison.png',
    expertise: ['Constitution', 'Federalism', 'Democracy'],
    expandedKeywords: [
      'constitution', 'federalism', 'democracy', 'republic', 'government',
      'founding fathers', 'bill of rights', 'separation of powers', 'checks and balances',
      'constitutional law', 'political theory', 'governance', 'civic rights'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'mlk',
    name: 'MLK',
    role: 'Black Liberation',
    avatar: '/agents/MLK.png',
    expertise: ['Civil Rights', 'Nonviolence', 'Equality'],
    expandedKeywords: [
      'civil rights', 'nonviolence', 'equality', 'justice', 'freedom',
      'discrimination', 'racism', 'protest', 'activism', 'social justice',
      'human rights', 'liberation', 'equality', 'dignity', 'respect'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'mandela',
    name: 'Nelson Mandela',
    role: 'Colonialism',
    avatar: '/agents/Nelson Mandela.png',
    expertise: ['Liberation', 'Reconciliation', 'Social Justice'],
    expandedKeywords: [
      'liberation', 'reconciliation', 'social justice', 'apartheid', 'freedom',
      'colonialism', 'oppression', 'resistance', 'unity', 'forgiveness',
      'human rights', 'equality', 'democracy', 'peace', 'transformation'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'brzezinski',
    name: 'Zbigniew Brzezinski',
    role: 'Geopolitics',
    avatar: '/agents/Zbigniew Brzezinski.png',
    expertise: ['Geopolitics', 'International Relations', 'Strategy'],
    expandedKeywords: [
      'geopolitics', 'international relations', 'strategy', 'foreign policy',
      'diplomacy', 'global affairs', 'world politics', 'security', 'alliances',
      'conflict', 'war', 'peace', 'international law', 'globalization'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'keynes',
    name: 'John Maynard Keynes',
    role: 'Keynesian Economics',
    avatar: '/agents/John Maynard Keynes.png',
    expertise: ['Macroeconomics', 'Fiscal Policy', 'Government Intervention'],
    expandedKeywords: [
      'macroeconomics', 'fiscal policy', 'government intervention', 'keynesian',
      'economics', 'recession', 'depression', 'stimulus', 'public spending',
      'aggregate demand', 'multiplier effect', 'deficit spending', 'monetary policy'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'friedman',
    name: 'Milton Friedman',
    role: 'Free Market Economics',
    avatar: '/agents/Milton Friedman.png',
    expertise: ['Economics', 'Monetarism', 'Free Markets'],
    expandedKeywords: [
      'economics', 'monetarism', 'free markets', 'libertarian', 'capitalism',
      'money', 'finance', 'inflation', 'interest rates', 'price stability',
      'federal reserve', 'budget', 'macroeconomics', 'supply-side', 'deregulation'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'finney',
    name: 'Hal Finney',
    role: 'Cryptocurrency',
    avatar: '/agents/Hal Finney.png',
    expertise: ['Cryptocurrency', 'Blockchain', 'Digital Security'],
    expandedKeywords: [
      'cryptocurrency', 'blockchain', 'digital security', 'bitcoin', 'crypto',
      'digital currency', 'decentralized', 'mining', 'wallet', 'trading',
      'defi', 'nft', 'smart contracts', 'ethereum', 'digital assets'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'graham',
    name: 'Benjamin Graham',
    role: 'Investing',
    avatar: '/agents/Benjamin Graham.png',
    expertise: ['Value Investing', 'Security Analysis', 'Financial Markets'],
    expandedKeywords: [
      'value investing', 'security analysis', 'financial markets', 'stocks',
      'investment', 'portfolio', 'dividends', 'earnings', 'valuation',
      'market analysis', 'financial planning', 'wealth building', 'asset allocation'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'jones',
    name: 'Mother Jones',
    role: 'Unions',
    avatar: '/agents/Mother Jones.png',
    expertise: ['Labor Rights', 'Workers', 'Social Justice'],
    expandedKeywords: [
      'labor rights', 'workers', 'social justice', 'unions', 'labor unions',
      'workers rights', 'collective bargaining', 'strikes', 'working conditions',
      'wages', 'benefits', 'employment', 'workplace safety', 'labor movement'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'turing',
    name: 'Alan Turing',
    role: 'Computing',
    avatar: '/agents/Alan Turing.png',
    expertise: ['Computer Science', 'Cryptography', 'AI Theory'],
    expandedKeywords: [
      'computer science', 'cryptography', 'ai theory', 'computing', 'algorithms',
      'programming', 'software', 'hardware', 'machine learning', 'artificial intelligence',
      'data structures', 'computational theory', 'encryption', 'code breaking'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'mccarthy',
    name: 'John McCarthy',
    role: 'AI',
    avatar: '/agents/John McCarthy.png',
    expertise: ['Artificial Intelligence', 'Lisp', 'Machine Learning'],
    expandedKeywords: [
      'artificial intelligence', 'lisp', 'machine learning', 'ai', 'neural networks',
      'deep learning', 'automation', 'robotics', 'computer vision', 'natural language',
      'expert systems', 'knowledge representation', 'reasoning', 'intelligent systems'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'einstein',
    name: 'Albert Einstein',
    role: 'Physics',
    avatar: '/agents/Albert Einstein.png',
    expertise: ['Relativity', 'Quantum Theory', 'Cosmology'],
    expandedKeywords: [
      'relativity', 'quantum theory', 'cosmology', 'physics', 'science',
      'space', 'time', 'energy', 'matter', 'universe', 'gravity', 'light',
      'atoms', 'nuclear', 'theoretical physics', 'mathematical physics'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'darwin',
    name: 'Charles Darwin',
    role: 'Evolution',
    avatar: '/agents/Charles Darwin.png',
    expertise: ['Natural Selection', 'Biology', 'Evolution'],
    expandedKeywords: [
      'natural selection', 'biology', 'evolution', 'species', 'adaptation',
      'genetics', 'mutation', 'survival', 'fitness', 'biodiversity', 'ecology',
      'life sciences', 'origin of species', 'evolutionary biology', 'natural history'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'roosevelt',
    name: 'Teddy Roosevelt',
    role: 'Environment',
    avatar: '/agents/Teddy Roosevelt.png',
    expertise: ['Conservation', 'National Parks', 'Environmental Policy'],
    expandedKeywords: [
      'conservation', 'national parks', 'environmental policy', 'nature', 'wildlife',
      'environment', 'sustainability', 'ecology', 'forests', 'mountains', 'outdoors',
      'environmental protection', 'green policy', 'natural resources', 'climate'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'olmsted',
    name: 'Frederick Law Olmsted',
    role: 'Urbanism',
    avatar: '/agents/Frederick Law Olmsted.png',
    expertise: ['Landscape Architecture', 'Urban Planning', 'Public Spaces'],
    expandedKeywords: [
      'landscape architecture', 'urban planning', 'public spaces', 'city planning',
      'parks', 'design', 'architecture', 'urban design', 'green spaces', 'infrastructure',
      'community planning', 'public realm', 'urban development', 'spatial design'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'murrow',
    name: 'Edward R. Murrow',
    role: 'Media',
    avatar: '/agents/Edward Murrow.png',
    expertise: ['Journalism', 'Broadcasting', 'Media Ethics'],
    expandedKeywords: [
      'journalism', 'broadcasting', 'media ethics', 'news', 'reporting',
      'media', 'communication', 'press', 'freedom of speech', 'investigative journalism',
      'mass media', 'television', 'radio', 'media literacy', 'public information'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'freud',
    name: 'Sigmund Freud',
    role: 'Psychology',
    avatar: '/agents/Sigmund Freud.png',
    expertise: ['Psychoanalysis', 'Psychology', 'Mental Health'],
    expandedKeywords: [
      'psychoanalysis', 'psychology', 'mental health', 'unconscious', 'therapy',
      'behavior', 'mind', 'personality', 'dreams', 'neurosis', 'psychotherapy',
      'human behavior', 'psychological theory', 'mental illness', 'counseling'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'socrates',
    name: 'Socrates',
    role: 'Philosophy',
    avatar: '/agents/Socrates.png',
    expertise: ['Philosophy', 'Ethics', 'Critical Thinking'],
    expandedKeywords: [
      'philosophy', 'ethics', 'critical thinking', 'wisdom', 'knowledge',
      'truth', 'justice', 'virtue', 'morality', 'reasoning', 'logic',
      'socratic method', 'questioning', 'dialogue', 'intellectual inquiry'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'luther',
    name: 'Martin Luther',
    role: 'Theology',
    avatar: '/agents/Martin Luther.png',
    expertise: ['Reformation', 'Theology', 'Religious Reform'],
    expandedKeywords: [
      'reformation', 'theology', 'religious reform', 'protestant', 'christianity',
      'religion', 'faith', 'church', 'bible', 'spiritual', 'religious freedom',
      'religious history', 'religious thought', 'spirituality', 'divine'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'twain',
    name: 'Mark Twain',
    role: 'Satire',
    avatar: '/agents/Mark Twain.png',
    expertise: ['Satire', 'Literature', 'Social Commentary'],
    expandedKeywords: [
      'satire', 'literature', 'social commentary', 'humor', 'writing',
      'books', 'novels', 'storytelling', 'criticism', 'wit', 'irony',
      'social criticism', 'literary works', 'authorship', 'creative writing'
    ],
    status: 'idle',
    pinned: false,
    hidden: false
  }
];

// Fuse.js configuration for fuzzy matching
const fuseOptions = {
  keys: [
    { name: 'name', weight: 0.3 },
    { name: 'role', weight: 0.2 },
    { name: 'expertise', weight: 0.2 },
    { name: 'expandedKeywords', weight: 0.3 }
  ],
  threshold: 0.4, // Lower = more strict matching
  includeScore: true,
  includeMatches: true
};

// Initialize Fuse with enhanced agents
const fuse = new Fuse(ENHANCED_AGENTS, fuseOptions);

// Smart auto-join logic
export function getAutoJoinAgents(query: string, maxAgents: number = 5): string[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  // Normalize query
  const normalizedQuery = query.toLowerCase().trim();

  // Search using Fuse.js
  const searchResults = fuse.search(normalizedQuery);

  // Filter results by score threshold and get top matches
  const relevantAgents = searchResults
    .filter(result => result.score && result.score <= 0.6) // Score threshold
    .slice(0, maxAgents)
    .map(result => result.item.id);

  // Fallback to generalist agents if no specific matches
  if (relevantAgents.length === 0) {
    const generalistIds = ['socrates', 'einstein', 'freud']; // General knowledge agents
    return generalistIds.slice(0, 3);
  }

  return relevantAgents;
}

// Get agent by ID
export function getAgentById(id: string) {
  return ENHANCED_AGENTS.find(agent => agent.id === id);
}

// Get all agents
export function getAllAgents() {
  return ENHANCED_AGENTS;
}

// Log user interactions for learning (future enhancement)
export function logAgentInteraction(
  query: string, 
  autoJoinedAgents: string[], 
  userRemovedAgents: string[], 
  userAddedAgents: string[]
) {
  // TODO: Implement learning system
  console.log('Agent interaction logged:', {
    query,
    autoJoinedAgents,
    userRemovedAgents,
    userAddedAgents,
    timestamp: new Date().toISOString()
  });
}
