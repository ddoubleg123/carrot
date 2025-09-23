import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding patch system data...')

  // Find a user to be the patch creator
  const user = await prisma.user.findFirst()
  if (!user) {
    console.log('❌ No users found. Please create a user first.')
    return
  }

  // Create or find the sample patches
  const patches = [
    {
      handle: 'clean-energy-revolution',
      name: 'Clean Energy Revolution',
      description: 'A community dedicated to accelerating the transition to renewable energy and sustainable technologies. We discuss policy, innovation, and the latest developments in clean energy.',
      rules: `1. Stay on topic - all discussions should relate to clean energy, sustainability, or environmental policy
2. Be respectful - no personal attacks or harassment
3. Cite sources - when making claims, provide credible sources
4. No spam - promotional content must be clearly marked and relevant
5. Constructive criticism welcome - challenge ideas, not people`,
      tags: ['clean-energy', 'renewables', 'sustainability', 'climate', 'policy', 'innovation'],
      theme: {
        bg: 'bg-gradient-to-br from-green-50 to-blue-50',
        accent: '#10B981'
      }
    },
    {
      handle: 'universal-basic-income',
      name: 'Universal Basic Income',
      description: 'Exploring the potential of UBI to address economic inequality and provide financial security for all citizens. We discuss implementation, funding, and real-world examples.',
      rules: `1. Focus on UBI-related topics and economic policy
2. Respectful debate encouraged - challenge ideas, not people
3. Provide evidence and sources for claims
4. No personal attacks or harassment
5. Stay constructive and solution-oriented`,
      tags: ['ubi', 'economics', 'inequality', 'policy', 'welfare', 'automation'],
      theme: {
        bg: 'bg-gradient-to-br from-blue-50 to-purple-50',
        accent: '#8B5CF6'
      }
    },
    {
      handle: 'term-limits',
      name: 'Term Limits for Politicians',
      description: 'Advocating for term limits to bring fresh leadership and reduce career politicians. We discuss implementation strategies and their impact on democracy.',
      rules: `1. Focus on political reform and term limits
2. Respectful political discussion
3. Cite sources and evidence
4. No personal attacks on politicians or members
5. Constructive solutions welcome`,
      tags: ['term-limits', 'politics', 'reform', 'democracy', 'leadership', 'government'],
      theme: {
        bg: 'bg-gradient-to-br from-purple-50 to-pink-50',
        accent: '#EC4899'
      }
    }
  ]

  let patch = await prisma.patch.findUnique({
    where: { handle: 'clean-energy-revolution' }
  })

  if (!patch) {
    patch = await prisma.patch.create({
      data: {
        ...patches[0],
        createdBy: user.id,
      }
    })
  }

  // Create the other patches
  for (const patchData of patches.slice(1)) {
    const existingPatch = await prisma.patch.findUnique({
      where: { handle: patchData.handle }
    })

    if (!existingPatch) {
      await prisma.patch.create({
        data: {
          ...patchData,
          createdBy: user.id,
        }
      })
    }
  }

  console.log(`✅ Found/Created patch: ${patch.name}`)

  // Create facts for the fact sheet
  const facts = [
    { label: 'Founded', value: 'January 2024', sourceId: null },
    { label: 'Members', value: '2,847', sourceId: null },
    { label: 'Active Discussions', value: '156', sourceId: null },
    { label: 'Topics Covered', value: 'Solar, Wind, Nuclear, Storage, Grid', sourceId: null },
    { label: 'Key Focus Areas', value: 'Policy, Innovation, Economics', sourceId: null },
    { label: 'Geographic Scope', value: 'Global', sourceId: null },
    { label: 'Language', value: 'English', sourceId: null },
    { label: 'Moderation', value: 'Community-driven with expert oversight', sourceId: null },
  ]

  for (const fact of facts) {
    await prisma.fact.create({
      data: {
        patchId: patch.id,
        label: fact.label,
        value: fact.value,
        sourceId: fact.sourceId,
      }
    })
  }

  console.log(`✅ Created ${facts.length} facts`)

  // Create sources
  const sources = [
    {
      title: 'International Energy Agency - Renewables 2023',
      url: 'https://www.iea.org/reports/renewables-2023',
      author: 'IEA',
      publisher: 'International Energy Agency',
      publishedAt: new Date('2023-12-01'),
      citeMeta: {
        title: 'Renewables 2023',
        url: 'https://www.iea.org/reports/renewables-2023',
        author: 'IEA',
        publisher: 'International Energy Agency',
        publishedAt: '2023-12-01'
      }
    },
    {
      title: 'Solar Power Costs Fall 90% in Decade',
      url: 'https://www.bloomberg.com/news/articles/2024-01-15/solar-costs-fall-90-percent',
      author: 'John Smith',
      publisher: 'Bloomberg',
      publishedAt: new Date('2024-01-15'),
      citeMeta: {
        title: 'Solar Power Costs Fall 90% in Decade',
        url: 'https://www.bloomberg.com/news/articles/2024-01-15/solar-costs-fall-90-percent',
        author: 'John Smith',
        publisher: 'Bloomberg',
        publishedAt: '2024-01-15'
      }
    },
    {
      title: 'Wind Energy Capacity Reaches 1TW Globally',
      url: 'https://www.renewableenergyworld.com/wind-energy-capacity-1tw',
      author: 'Sarah Johnson',
      publisher: 'Renewable Energy World',
      publishedAt: new Date('2024-02-20'),
      citeMeta: {
        title: 'Wind Energy Capacity Reaches 1TW Globally',
        url: 'https://www.renewableenergyworld.com/wind-energy-capacity-1tw',
        author: 'Sarah Johnson',
        publisher: 'Renewable Energy World',
        publishedAt: '2024-02-20'
      }
    },
    {
      title: 'Battery Storage Breakthrough: 24-Hour Grid Support',
      url: 'https://www.technologyreview.com/battery-storage-24h-grid',
      author: 'Mike Chen',
      publisher: 'MIT Technology Review',
      publishedAt: new Date('2024-03-10'),
      citeMeta: {
        title: 'Battery Storage Breakthrough: 24-Hour Grid Support',
        url: 'https://www.technologyreview.com/battery-storage-24h-grid',
        author: 'Mike Chen',
        publisher: 'MIT Technology Review',
        publishedAt: '2024-03-10'
      }
    },
    {
      title: 'EU Green Deal: 55% Emissions Reduction by 2030',
      url: 'https://ec.europa.eu/info/strategy/priorities-2019-2024/european-green-deal_en',
      author: 'European Commission',
      publisher: 'European Commission',
      publishedAt: new Date('2023-11-15'),
      citeMeta: {
        title: 'EU Green Deal: 55% Emissions Reduction by 2030',
        url: 'https://ec.europa.eu/info/strategy/priorities-2019-2024/european-green-deal_en',
        author: 'European Commission',
        publisher: 'European Commission',
        publishedAt: '2023-11-15'
      }
    },
    {
      title: 'China Installs 200GW Solar in 2023',
      url: 'https://www.reuters.com/business/energy/china-solar-installations-200gw-2023',
      author: 'Reuters Staff',
      publisher: 'Reuters',
      publishedAt: new Date('2024-01-05'),
      citeMeta: {
        title: 'China Installs 200GW Solar in 2023',
        url: 'https://www.reuters.com/business/energy/china-solar-installations-200gw-2023',
        author: 'Reuters Staff',
        publisher: 'Reuters',
        publishedAt: '2024-01-05'
      }
    },
    {
      title: 'Hydrogen Fuel Cells: Commercial Viability Study',
      url: 'https://www.nature.com/articles/hydrogen-fuel-cells-commercial',
      author: 'Dr. Emily Rodriguez',
      publisher: 'Nature Energy',
      publishedAt: new Date('2024-02-28'),
      citeMeta: {
        title: 'Hydrogen Fuel Cells: Commercial Viability Study',
        url: 'https://www.nature.com/articles/hydrogen-fuel-cells-commercial',
        author: 'Dr. Emily Rodriguez',
        publisher: 'Nature Energy',
        publishedAt: '2024-02-28'
      }
    },
    {
      title: 'Grid Modernization: Smart Grid Implementation',
      url: 'https://www.energy.gov/smart-grid-implementation-guide',
      author: 'DOE',
      publisher: 'U.S. Department of Energy',
      publishedAt: new Date('2023-10-20'),
      citeMeta: {
        title: 'Grid Modernization: Smart Grid Implementation',
        url: 'https://www.energy.gov/smart-grid-implementation-guide',
        author: 'DOE',
        publisher: 'U.S. Department of Energy',
        publishedAt: '2023-10-20'
      }
    },
    {
      title: 'Offshore Wind: Floating Turbine Technology',
      url: 'https://www.offshorewind.biz/floating-turbine-breakthrough',
      author: 'Alex Thompson',
      publisher: 'Offshore Wind Biz',
      publishedAt: new Date('2024-03-15'),
      citeMeta: {
        title: 'Offshore Wind: Floating Turbine Technology',
        url: 'https://www.offshorewind.biz/floating-turbine-breakthrough',
        author: 'Alex Thompson',
        publisher: 'Offshore Wind Biz',
        publishedAt: '2024-03-15'
      }
    },
    {
      title: 'Nuclear Fusion: ITER Project Update',
      url: 'https://www.iter.org/fusion-energy-update-2024',
      author: 'ITER Organization',
      publisher: 'ITER',
      publishedAt: new Date('2024-01-30'),
      citeMeta: {
        title: 'Nuclear Fusion: ITER Project Update',
        url: 'https://www.iter.org/fusion-energy-update-2024',
        author: 'ITER Organization',
        publisher: 'ITER',
        publishedAt: '2024-01-30'
      }
    },
    {
      title: 'Carbon Capture: Direct Air Capture Scaling',
      url: 'https://www.carboncapture.com/dac-scaling-2024',
      author: 'Carbon Capture Inc.',
      publisher: 'Carbon Capture Technologies',
      publishedAt: new Date('2024-02-10'),
      citeMeta: {
        title: 'Carbon Capture: Direct Air Capture Scaling',
        url: 'https://www.carboncapture.com/dac-scaling-2024',
        author: 'Carbon Capture Inc.',
        publisher: 'Carbon Capture Technologies',
        publishedAt: '2024-02-10'
      }
    },
    {
      title: 'Geothermal Energy: Enhanced Geothermal Systems',
      url: 'https://www.geothermal.org/egs-technology-advances',
      author: 'Geothermal Association',
      publisher: 'Geothermal Energy Association',
      publishedAt: new Date('2024-03-05'),
      citeMeta: {
        title: 'Geothermal Energy: Enhanced Geothermal Systems',
        url: 'https://www.geothermal.org/egs-technology-advances',
        author: 'Geothermal Association',
        publisher: 'Geothermal Energy Association',
        publishedAt: '2024-03-05'
      }
    },
    {
      title: 'Energy Storage: Pumped Hydro vs Batteries',
      url: 'https://www.energystorage.org/pumped-hydro-vs-batteries',
      author: 'Energy Storage Association',
      publisher: 'Energy Storage Association',
      publishedAt: new Date('2024-01-20'),
      citeMeta: {
        title: 'Energy Storage: Pumped Hydro vs Batteries',
        url: 'https://www.energystorage.org/pumped-hydro-vs-batteries',
        author: 'Energy Storage Association',
        publisher: 'Energy Storage Association',
        publishedAt: '2024-01-20'
      }
    },
    {
      title: 'Electric Vehicles: Grid Integration Challenges',
      url: 'https://www.ev-grid-integration.com/challenges-2024',
      author: 'EV Grid Research',
      publisher: 'Electric Vehicle Grid Integration',
      publishedAt: new Date('2024-02-25'),
      citeMeta: {
        title: 'Electric Vehicles: Grid Integration Challenges',
        url: 'https://www.ev-grid-integration.com/challenges-2024',
        author: 'EV Grid Research',
        publisher: 'Electric Vehicle Grid Integration',
        publishedAt: '2024-02-25'
      }
    },
    {
      title: 'Renewable Energy Jobs: Global Employment Report',
      url: 'https://www.irena.org/renewable-energy-jobs-2024',
      author: 'IRENA',
      publisher: 'International Renewable Energy Agency',
      publishedAt: new Date('2024-03-01'),
      citeMeta: {
        title: 'Renewable Energy Jobs: Global Employment Report',
        url: 'https://www.irena.org/renewable-energy-jobs-2024',
        author: 'IRENA',
        publisher: 'International Renewable Energy Agency',
        publishedAt: '2024-03-01'
      }
    }
  ]

  const createdSources = []
  for (const source of sources) {
    const createdSource = await prisma.source.create({
      data: {
        patchId: patch.id,
        title: source.title,
        url: source.url,
        author: source.author,
        publisher: source.publisher,
        publishedAt: source.publishedAt,
        addedBy: user.id,
        citeMeta: source.citeMeta,
      }
    })
    createdSources.push(createdSource)
  }

  console.log(`✅ Created ${sources.length} sources`)

  // Create timeline events
  const events = [
    {
      title: 'Solar Power Costs Fall 90% in Decade',
      dateStart: new Date('2024-01-15'),
      summary: 'Bloomberg reports that solar power costs have fallen by 90% over the past decade, making it the cheapest form of electricity in most markets worldwide.',
      tags: ['solar', 'costs', 'economics'],
      sourceIds: [createdSources[1].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800', alt: 'Solar panels in field' }
    },
    {
      title: 'Wind Energy Reaches 1TW Global Capacity',
      dateStart: new Date('2024-02-20'),
      summary: 'Global wind energy capacity has reached 1 terawatt, marking a major milestone in renewable energy deployment.',
      tags: ['wind', 'capacity', 'milestone'],
      sourceIds: [createdSources[2].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800', alt: 'Wind turbines' }
    },
    {
      title: 'Battery Storage Breakthrough: 24-Hour Grid Support',
      dateStart: new Date('2024-03-10'),
      summary: 'New battery technology breakthrough enables 24-hour grid support, solving the intermittency challenge of renewable energy.',
      tags: ['battery', 'storage', 'grid', 'breakthrough'],
      sourceIds: [createdSources[3].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', alt: 'Battery storage facility' }
    },
    {
      title: 'EU Green Deal: 55% Emissions Reduction Target',
      dateStart: new Date('2023-11-15'),
      summary: 'European Union announces ambitious Green Deal with 55% emissions reduction target by 2030, accelerating clean energy transition.',
      tags: ['policy', 'eu', 'emissions', 'target'],
      sourceIds: [createdSources[4].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800', alt: 'EU flag and wind turbines' }
    },
    {
      title: 'China Installs 200GW Solar in 2023',
      dateStart: new Date('2024-01-05'),
      summary: 'China sets new record by installing 200GW of solar capacity in 2023, more than the rest of the world combined.',
      tags: ['china', 'solar', 'installation', 'record'],
      sourceIds: [createdSources[5].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800', alt: 'Large solar installation' }
    },
    {
      title: 'Hydrogen Fuel Cells: Commercial Viability Study',
      dateStart: new Date('2024-02-28'),
      summary: 'New study shows hydrogen fuel cells are becoming commercially viable for heavy transport and industrial applications.',
      tags: ['hydrogen', 'fuel-cells', 'commercial', 'transport'],
      sourceIds: [createdSources[6].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800', alt: 'Hydrogen fuel cell' }
    },
    {
      title: 'Smart Grid Implementation Guide Released',
      dateStart: new Date('2023-10-20'),
      summary: 'U.S. Department of Energy releases comprehensive guide for smart grid implementation to modernize electricity infrastructure.',
      tags: ['smart-grid', 'infrastructure', 'modernization', 'doe'],
      sourceIds: [createdSources[7].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', alt: 'Smart grid infrastructure' }
    },
    {
      title: 'Floating Wind Turbine Technology Breakthrough',
      dateStart: new Date('2024-03-15'),
      summary: 'New floating wind turbine technology enables deployment in deeper waters, opening vast new areas for offshore wind development.',
      tags: ['offshore-wind', 'floating', 'technology', 'breakthrough'],
      sourceIds: [createdSources[8].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800', alt: 'Floating wind turbine' }
    },
    {
      title: 'ITER Fusion Project: Major Milestone Reached',
      dateStart: new Date('2024-01-30'),
      summary: 'ITER nuclear fusion project reaches major milestone, bringing commercial fusion energy closer to reality.',
      tags: ['fusion', 'nuclear', 'iter', 'milestone'],
      sourceIds: [createdSources[9].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800', alt: 'Nuclear fusion reactor' }
    },
    {
      title: 'Direct Air Capture Scaling Up',
      dateStart: new Date('2024-02-10'),
      summary: 'Direct air capture technology is scaling up rapidly, with new facilities removing CO2 from the atmosphere at industrial scale.',
      tags: ['carbon-capture', 'dac', 'co2', 'scaling'],
      sourceIds: [createdSources[10].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800', alt: 'Carbon capture facility' }
    },
    {
      title: 'Enhanced Geothermal Systems Advance',
      dateStart: new Date('2024-03-05'),
      summary: 'Enhanced geothermal systems technology advances, making geothermal energy viable in more locations worldwide.',
      tags: ['geothermal', 'enhanced-systems', 'technology', 'advance'],
      sourceIds: [createdSources[11].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800', alt: 'Geothermal power plant' }
    },
    {
      title: 'Energy Storage: Pumped Hydro vs Batteries Analysis',
      dateStart: new Date('2024-01-20'),
      summary: 'Comprehensive analysis compares pumped hydro storage with battery storage, showing complementary roles in grid stability.',
      tags: ['energy-storage', 'pumped-hydro', 'batteries', 'analysis'],
      sourceIds: [createdSources[12].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', alt: 'Pumped hydro storage' }
    },
    {
      title: 'EV Grid Integration Challenges Identified',
      dateStart: new Date('2024-02-25'),
      summary: 'Research identifies key challenges in electric vehicle grid integration and proposes solutions for mass EV adoption.',
      tags: ['electric-vehicles', 'grid-integration', 'challenges', 'solutions'],
      sourceIds: [createdSources[13].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800', alt: 'Electric vehicle charging' }
    },
    {
      title: 'Renewable Energy Jobs: 15 Million Globally',
      dateStart: new Date('2024-03-01'),
      summary: 'IRENA reports that renewable energy now employs over 15 million people globally, with solar leading job creation.',
      tags: ['jobs', 'employment', 'renewables', 'solar'],
      sourceIds: [createdSources[14].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800', alt: 'Solar installation workers' }
    },
    {
      title: 'IEA Renewables 2023 Report Released',
      dateStart: new Date('2023-12-01'),
      summary: 'International Energy Agency releases comprehensive Renewables 2023 report showing accelerating global transition to clean energy.',
      tags: ['iea', 'report', 'renewables', 'transition'],
      sourceIds: [createdSources[0].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800', alt: 'Renewable energy report' }
    },
    {
      title: 'Community Solar Programs Expand Nationwide',
      dateStart: new Date('2024-01-10'),
      summary: 'Community solar programs expand across the United States, making solar energy accessible to renters and low-income households.',
      tags: ['community-solar', 'accessibility', 'renters', 'low-income'],
      sourceIds: [createdSources[1].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800', alt: 'Community solar installation' }
    },
    {
      title: 'Offshore Wind Lease Auction Sets Record',
      dateStart: new Date('2024-02-15'),
      summary: 'New offshore wind lease auction sets record prices, indicating strong market confidence in offshore wind development.',
      tags: ['offshore-wind', 'lease-auction', 'record', 'market'],
      sourceIds: [createdSources[8].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800', alt: 'Offshore wind farm' }
    },
    {
      title: 'Grid-Scale Battery Storage Reaches 100GW',
      dateStart: new Date('2024-03-20'),
      summary: 'Global grid-scale battery storage capacity reaches 100GW, providing crucial backup for renewable energy systems.',
      tags: ['grid-scale', 'battery-storage', '100gw', 'backup'],
      sourceIds: [createdSources[3].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', alt: 'Grid-scale battery storage' }
    },
    {
      title: 'Clean Energy Investment Hits $1.7 Trillion',
      dateStart: new Date('2024-01-25'),
      summary: 'Global clean energy investment reaches $1.7 trillion in 2023, with solar and wind leading the way.',
      tags: ['investment', '1.7-trillion', 'solar', 'wind'],
      sourceIds: [createdSources[0].id],
      media: { type: 'image', url: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800', alt: 'Clean energy investment' }
    }
  ]

  for (const event of events) {
    await prisma.event.create({
      data: {
        patchId: patch.id,
        title: event.title,
        dateStart: event.dateStart,
        summary: event.summary,
        tags: event.tags,
        sourceIds: event.sourceIds,
        media: event.media,
      }
    })
  }

  console.log(`✅ Created ${events.length} timeline events`)

  // Create sample posts
  const posts = [
    {
      type: 'TEXT' as const,
      title: 'What do you think about the latest solar cost reductions?',
      body: 'The 90% cost reduction in solar over the past decade is incredible. What are your thoughts on how this will impact the energy transition?',
      tags: ['solar', 'costs', 'discussion'],
      metrics: { likes: 45, comments: 23, reposts: 12, views: 156 }
    },
    {
      type: 'LINK' as const,
      title: 'New floating wind turbine technology breakthrough',
      body: 'This could be a game-changer for offshore wind. The ability to deploy in deeper waters opens up so many new possibilities.',
      url: 'https://www.offshorewind.biz/floating-turbine-breakthrough',
      tags: ['offshore-wind', 'floating', 'technology'],
      metrics: { likes: 67, comments: 34, reposts: 18, views: 234 }
    },
    {
      type: 'TEXT' as const,
      title: 'Battery storage breakthrough - 24 hour grid support!',
      body: 'This is huge for solving the intermittency problem. What do you think about the implications for grid stability?',
      tags: ['battery', 'storage', 'grid'],
      metrics: { likes: 89, comments: 45, reposts: 25, views: 312 }
    },
    {
      type: 'CARROT' as const,
      title: 'EU Green Deal: 55% emissions reduction by 2030',
      body: 'The European Union is setting ambitious targets. Do you think this is achievable? What policies would you prioritize?',
      tags: ['eu', 'policy', 'emissions'],
      metrics: { likes: 123, comments: 67, reposts: 34, views: 456 }
    },
    {
      type: 'TEXT' as const,
      title: 'China installing 200GW solar in 2023 - thoughts?',
      body: 'That\'s more than the rest of the world combined. What does this mean for global solar markets and pricing?',
      tags: ['china', 'solar', 'global-markets'],
      metrics: { likes: 78, comments: 41, reposts: 19, views: 289 }
    },
    {
      type: 'LINK' as const,
      title: 'Hydrogen fuel cells becoming commercially viable',
      body: 'Finally! This could be the breakthrough we need for heavy transport and industrial applications.',
      url: 'https://www.nature.com/articles/hydrogen-fuel-cells-commercial',
      tags: ['hydrogen', 'fuel-cells', 'commercial'],
      metrics: { likes: 95, comments: 52, reposts: 28, views: 378 }
    },
    {
      type: 'TEXT' as const,
      title: 'Smart grid implementation - where should we start?',
      body: 'The DOE guide is comprehensive, but what do you think are the most critical first steps for grid modernization?',
      tags: ['smart-grid', 'modernization', 'infrastructure'],
      metrics: { likes: 56, comments: 29, reposts: 14, views: 198 }
    },
    {
      type: 'CARROT' as const,
      title: 'ITER fusion project reaches major milestone',
      body: 'Commercial fusion energy is getting closer! What timeline do you think is realistic for fusion to become viable?',
      tags: ['fusion', 'nuclear', 'iter'],
      metrics: { likes: 134, comments: 78, reposts: 42, views: 567 }
    },
    {
      type: 'TEXT' as const,
      title: 'Direct air capture scaling up - game changer?',
      body: 'Industrial-scale CO2 removal is finally happening. Do you think this technology can scale fast enough to make a difference?',
      tags: ['carbon-capture', 'dac', 'co2'],
      metrics: { likes: 87, comments: 46, reposts: 23, views: 345 }
    },
    {
      type: 'LINK' as const,
      title: 'Enhanced geothermal systems advance',
      body: 'This could make geothermal viable in so many more locations. Exciting times for clean energy!',
      url: 'https://www.geothermal.org/egs-technology-advances',
      tags: ['geothermal', 'enhanced-systems', 'technology'],
      metrics: { likes: 72, comments: 38, reposts: 21, views: 267 }
    },
    {
      type: 'TEXT' as const,
      title: 'Energy storage: pumped hydro vs batteries analysis',
      body: 'Interesting analysis showing they\'re complementary rather than competing. What\'s your take on the optimal mix?',
      tags: ['energy-storage', 'pumped-hydro', 'batteries'],
      metrics: { likes: 63, comments: 35, reposts: 17, views: 234 }
    },
    {
      type: 'CARROT' as const,
      title: 'EV grid integration challenges - solutions needed',
      body: 'Mass EV adoption will require smart grid solutions. What do you think are the biggest challenges to solve?',
      tags: ['electric-vehicles', 'grid-integration', 'challenges'],
      metrics: { likes: 98, comments: 54, reposts: 31, views: 423 }
    },
    {
      type: 'TEXT' as const,
      title: '15 million renewable energy jobs globally!',
      body: 'The job creation potential of clean energy is incredible. What sectors do you see growing fastest?',
      tags: ['jobs', 'employment', 'renewables'],
      metrics: { likes: 76, comments: 42, reposts: 19, views: 298 }
    },
    {
      type: 'LINK' as const,
      title: 'IEA Renewables 2023 report - accelerating transition',
      body: 'The data shows we\'re accelerating faster than expected. What trends are you most excited about?',
      url: 'https://www.iea.org/reports/renewables-2023',
      tags: ['iea', 'report', 'renewables', 'transition'],
      metrics: { likes: 112, comments: 61, reposts: 35, views: 489 }
    },
    {
      type: 'TEXT' as const,
      title: 'Community solar programs expanding nationwide',
      body: 'Making solar accessible to renters and low-income households is crucial. What other barriers need to be addressed?',
      tags: ['community-solar', 'accessibility', 'renters'],
      metrics: { likes: 84, comments: 47, reposts: 22, views: 312 }
    },
    {
      type: 'CARROT' as const,
      title: 'Offshore wind lease auction sets record prices',
      body: 'Strong market confidence in offshore wind! What do you think this means for future development?',
      tags: ['offshore-wind', 'lease-auction', 'market'],
      metrics: { likes: 91, comments: 48, reposts: 26, views: 356 }
    },
    {
      type: 'TEXT' as const,
      title: 'Grid-scale battery storage reaches 100GW',
      body: 'This milestone shows how quickly storage is scaling. What\'s the next target we should aim for?',
      tags: ['grid-scale', 'battery-storage', '100gw'],
      metrics: { likes: 69, comments: 37, reposts: 18, views: 245 }
    },
    {
      type: 'LINK' as const,
      title: 'Clean energy investment hits $1.7 trillion',
      body: 'The money is flowing into clean energy like never before. What sectors are you most bullish on?',
      url: 'https://www.bloomberg.com/news/articles/2024-01-15/solar-costs-fall-90-percent',
      tags: ['investment', '1.7-trillion', 'clean-energy'],
      metrics: { likes: 105, comments: 58, reposts: 33, views: 467 }
    },
    {
      type: 'TEXT' as const,
      title: 'What\'s your prediction for 2024 clean energy trends?',
      body: 'With all these breakthroughs happening, what do you think will be the biggest story in clean energy this year?',
      tags: ['predictions', '2024', 'trends'],
      metrics: { likes: 127, comments: 73, reposts: 41, views: 534 }
    },
    {
      type: 'CARROT' as const,
      title: 'Policy vs technology: what drives change faster?',
      body: 'Interesting debate: do you think policy changes or technological breakthroughs have more impact on clean energy adoption?',
      tags: ['policy', 'technology', 'adoption', 'debate'],
      metrics: { likes: 156, comments: 89, reposts: 52, views: 678 }
    },
    {
      type: 'TEXT' as const,
      title: 'Storage breakthrough: what does this mean for baseload?',
      body: 'With 24-hour battery storage becoming viable, do you think we still need baseload power plants?',
      tags: ['storage', 'baseload', 'batteries'],
      metrics: { likes: 93, comments: 51, reposts: 28, views: 389 }
    },
    {
      type: 'LINK' as const,
      title: 'Floating wind: the next frontier',
      body: 'This technology could unlock massive new areas for offshore wind. What regions do you think will benefit most?',
      url: 'https://www.offshorewind.biz/floating-turbine-breakthrough',
      tags: ['floating-wind', 'offshore', 'frontier'],
      metrics: { likes: 81, comments: 44, reposts: 24, views: 323 }
    },
    {
      type: 'TEXT' as const,
      title: 'China\'s solar dominance: opportunity or threat?',
      body: 'China installing more solar than the rest of the world combined - what does this mean for global energy markets?',
      tags: ['china', 'solar', 'dominance', 'markets'],
      metrics: { likes: 118, comments: 65, reposts: 37, views: 445 }
    },
    {
      type: 'CARROT' as const,
      title: 'Hydrogen economy: hype or reality?',
      body: 'With fuel cells becoming commercially viable, do you think we\'re finally seeing the hydrogen economy take off?',
      tags: ['hydrogen', 'economy', 'fuel-cells'],
      metrics: { likes: 142, comments: 78, reposts: 45, views: 567 }
    },
    {
      type: 'TEXT' as const,
      title: 'Grid modernization: where should we invest first?',
      body: 'Smart grid implementation is complex. What do you think are the highest-impact investments we should prioritize?',
      tags: ['grid', 'modernization', 'investment', 'priorities'],
      metrics: { likes: 74, comments: 41, reposts: 19, views: 267 }
    }
  ]

  for (const post of posts) {
    await prisma.patchPost.create({
      data: {
        patchId: patch.id,
        authorId: user.id,
        type: post.type,
        title: post.title,
        body: post.body,
        url: post.url,
        tags: post.tags,
        metrics: post.metrics,
      }
    })
  }

  console.log(`✅ Created ${posts.length} posts`)

  // Create patch member (creator is automatically admin) if it doesn't exist
  const existingMember = await prisma.patchMember.findUnique({
    where: {
      patch_user_member_unique: {
        patchId: patch.id,
        userId: user.id,
      }
    }
  })

  if (!existingMember) {
    await prisma.patchMember.create({
      data: {
        patchId: patch.id,
        userId: user.id,
        role: 'admin',
      }
    })
  }

  console.log(`✅ Created 1 patch member`)

  console.log('🎉 Patch system seeding completed!')
  console.log(`📊 Summary:`)
  console.log(`   - 1 Patch: ${patch.name}`)
  console.log(`   - ${facts.length} Facts`)
  console.log(`   - ${sources.length} Sources`)
  console.log(`   - ${events.length} Timeline Events`)
  console.log(`   - ${posts.length} Posts`)
  console.log(`   - 1 Member`)
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
