import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding patch redesign data...')

  // Find or create a user
  let user = await prisma.user.findFirst()
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: 'seed-user-1',
        email: 'seed@example.com',
        name: 'Seed User',
        username: 'seeduser',
        profilePhoto: '/default-avatar.png',
        isOnboarded: true,
      }
    })
  }

  // Create the main patch: "Term Limits for Politicians"
  const patch = await prisma.patch.upsert({
    where: { handle: 'term-limits-politicians' },
    update: {},
    create: {
      handle: 'term-limits-politicians',
      name: 'Term Limits for Politicians',
      tagline: 'Advocating for congressional term limits to prevent career politicians',
      description: 'A comprehensive movement to establish term limits for members of Congress and other elected officials to ensure fresh perspectives and prevent the concentration of power in long-serving politicians.',
      rules: '1. Be respectful in discussions\n2. Provide sources for claims\n3. Focus on policy, not personalities\n4. No spam or off-topic content',
      tags: ['politics', 'reform', 'congress', 'democracy', 'governance'],
      theme: 'light',
      createdBy: user.id,
    }
  })

  console.log(`✅ Created/updated patch: ${patch.name}`)

  // Create facts
  const facts = [
    {
      label: 'Current Status',
      value: 'No federal term limits exist for Congress. Representatives serve 2-year terms with no limit, Senators serve 6-year terms with no limit.',
    },
    {
      label: 'Historical Context',
      value: 'The 22nd Amendment (1951) limited presidential terms to 2 terms (8 years), but no similar amendment exists for Congress.',
    },
    {
      label: 'Public Support',
      value: 'According to recent polls, 75% of Americans support congressional term limits, with bipartisan support across party lines.',
    },
    {
      label: 'State Examples',
      value: '15 states have term limits for their state legislatures, including California (12 years), Florida (8 years), and Michigan (14 years).',
    },
    {
      label: 'Proposed Limits',
      value: 'Most proposals suggest 12 years total (6 terms for House, 2 terms for Senate) or 18 years total (9 terms for House, 3 terms for Senate).',
    },
    {
      label: 'Constitutional Requirement',
      value: 'Term limits for Congress would require a constitutional amendment, needing 2/3 majority in both houses and ratification by 3/4 of states.',
    },
    {
      label: 'Arguments For',
      value: 'Prevents career politicians, brings fresh perspectives, reduces influence of special interests, increases accountability to constituents.',
    },
    {
      label: 'Arguments Against',
      value: 'Removes experienced legislators, limits voter choice, may increase influence of unelected staff and lobbyists.',
    },
  ]

  for (const fact of facts) {
    await prisma.fact.create({
      data: {
        patchId: patch.id,
        label: fact.label,
        value: fact.value,
      }
    })
  }

  console.log(`✅ Created ${facts.length} facts`)

  // Create sources
  const sources = [
    {
      title: 'Term Limits for Congress: An Analysis',
      url: 'https://www.brookings.edu/articles/term-limits-for-congress-an-analysis/',
      author: 'Thomas E. Mann',
      publisher: 'Brookings Institution',
      publishedAt: new Date('2023-03-15'),
    },
    {
      title: 'Public Opinion on Congressional Term Limits',
      url: 'https://www.pewresearch.org/politics/2023/02/20/public-opinion-congressional-term-limits/',
      author: 'Pew Research Center',
      publisher: 'Pew Research Center',
      publishedAt: new Date('2023-02-20'),
    },
    {
      title: 'State Legislative Term Limits: A Comprehensive Review',
      url: 'https://www.ncsl.org/research/about-state-legislatures/state-legislative-term-limits.aspx',
      author: 'National Conference of State Legislatures',
      publisher: 'NCSL',
      publishedAt: new Date('2023-01-10'),
    },
    {
      title: 'The Case for Congressional Term Limits',
      url: 'https://www.heritage.org/political-process/report/the-case-congressional-term-limits',
      author: 'Edwin Meese III',
      publisher: 'Heritage Foundation',
      publishedAt: new Date('2022-11-08'),
    },
    {
      title: 'Term Limits and Legislative Effectiveness',
      url: 'https://www.journals.uchicago.edu/doi/abs/10.1086/705425',
      author: 'Dr. Sarah Anderson',
      publisher: 'University of Chicago Press',
      publishedAt: new Date('2022-09-15'),
    },
    {
      title: 'Constitutional Amendment Process',
      url: 'https://www.archives.gov/federal-register/constitution',
      author: 'National Archives',
      publisher: 'U.S. National Archives',
      publishedAt: new Date('2022-06-01'),
    },
    {
      title: 'Term Limits: A Global Perspective',
      url: 'https://www.idea.int/publications/catalogue/term-limits-global-perspective',
      author: 'International IDEA',
      publisher: 'International Institute for Democracy and Electoral Assistance',
      publishedAt: new Date('2022-04-20'),
    },
    {
      title: 'The Impact of Term Limits on State Legislatures',
      url: 'https://www.apsanet.org/term-limits-impact',
      author: 'Dr. Michael Carey',
      publisher: 'American Political Science Association',
      publishedAt: new Date('2022-03-12'),
    },
    {
      title: 'Term Limits and Democracy: A Comparative Study',
      url: 'https://www.cambridge.org/core/books/term-limits-and-democracy/',
      author: 'Dr. Jennifer Lawless',
      publisher: 'Cambridge University Press',
      publishedAt: new Date('2022-01-15'),
    },
    {
      title: 'Congressional Reform Proposals',
      url: 'https://www.crs.gov/reports/congressional-reform-proposals',
      author: 'Congressional Research Service',
      publisher: 'Library of Congress',
      publishedAt: new Date('2021-12-01'),
    },
  ]

  const createdSources = []
  for (const source of sources) {
    const created = await prisma.source.create({
      data: {
        patchId: patch.id,
        title: source.title,
        url: source.url,
        author: source.author,
        publisher: source.publisher,
        publishedAt: source.publishedAt,
        addedBy: user.id,
        citeMeta: {
          title: source.title,
          url: source.url,
          author: source.author,
          publisher: source.publisher,
          publishedAt: source.publishedAt.toISOString(),
        }
      }
    })
    createdSources.push(created)
  }

  console.log(`✅ Created ${sources.length} sources`)

  // Create events (timeline)
  const events = [
    {
      title: '22nd Amendment Ratified',
      dateStart: new Date('1951-02-27'),
      summary: 'The 22nd Amendment to the U.S. Constitution was ratified, limiting presidents to two terms in office. This marked the first major federal term limit but did not apply to Congress.',
      tags: ['constitutional', 'presidential', 'historical'],
      sourceIds: [createdSources[5].id], // Constitutional Amendment Process
    },
    {
      title: 'California Adopts Legislative Term Limits',
      dateStart: new Date('1990-11-06'),
      summary: 'California voters approved Proposition 140, establishing term limits for state legislators. Assembly members limited to 6 years, Senators to 8 years.',
      tags: ['state', 'california', 'ballot-initiative'],
      sourceIds: [createdSources[2].id], // State Legislative Term Limits
    },
    {
      title: 'U.S. Term Limits v. Thornton Supreme Court Case',
      dateStart: new Date('1995-05-22'),
      summary: 'Supreme Court ruled that states cannot impose term limits on their federal representatives, as it would add qualifications beyond those specified in the Constitution.',
      tags: ['supreme-court', 'constitutional', 'legal'],
      sourceIds: [createdSources[5].id], // Constitutional Amendment Process
    },
    {
      title: 'Florida Adopts Legislative Term Limits',
      dateStart: new Date('1992-11-03'),
      summary: 'Florida voters approved term limits for state legislators through a constitutional amendment. House members limited to 4 terms (8 years), Senate to 2 terms (8 years).',
      tags: ['state', 'florida', 'ballot-initiative'],
      sourceIds: [createdSources[2].id], // State Legislative Term Limits
    },
    {
      title: 'Term Limits Movement Gains Momentum',
      dateStart: new Date('1994-11-08'),
      summary: 'Term limits became a major issue in the 1994 midterm elections, with many candidates pledging to support congressional term limits. Republicans gained control of Congress.',
      tags: ['elections', 'republican', 'midterm'],
      sourceIds: [createdSources[0].id], // Brookings Analysis
    },
    {
      title: 'Contract with America',
      dateStart: new Date('1994-09-27'),
      summary: 'House Republicans unveiled the Contract with America, which included a pledge to bring term limits legislation to a vote. This helped Republicans win the House in 1994.',
      tags: ['republican', 'contract', 'legislation'],
      sourceIds: [createdSources[0].id], // Brookings Analysis
    },
    {
      title: 'Term Limits Amendment Fails in House',
      dateStart: new Date('1995-03-29'),
      summary: 'The House voted on a constitutional amendment for congressional term limits. The amendment failed to receive the required 2/3 majority, falling short by 61 votes.',
      tags: ['congress', 'amendment', 'failure'],
      sourceIds: [createdSources[0].id], // Brookings Analysis
    },
    {
      title: 'Michigan Adopts Legislative Term Limits',
      dateStart: new Date('1992-11-03'),
      summary: 'Michigan voters approved term limits for state legislators. Representatives limited to 3 terms (6 years), Senators to 2 terms (8 years).',
      tags: ['state', 'michigan', 'ballot-initiative'],
      sourceIds: [createdSources[2].id], // State Legislative Term Limits
    },
    {
      title: 'Term Limits Study Commission',
      dateStart: new Date('1997-01-01'),
      summary: 'Congress established a bipartisan commission to study the effects of term limits. The commission conducted extensive research and public hearings.',
      tags: ['commission', 'study', 'bipartisan'],
      sourceIds: [createdSources[9].id], // Congressional Research Service
    },
    {
      title: 'Commission Report Released',
      dateStart: new Date('1998-12-01'),
      summary: 'The Term Limits Study Commission released its final report, finding mixed results on the effectiveness of term limits in state legislatures.',
      tags: ['report', 'findings', 'mixed-results'],
      sourceIds: [createdSources[9].id], // Congressional Research Service
    },
    {
      title: 'Citizens for Term Limits Founded',
      dateStart: new Date('2000-03-15'),
      summary: 'A new advocacy group was founded to push for congressional term limits, focusing on grassroots organizing and public education.',
      tags: ['advocacy', 'grassroots', 'organization'],
      sourceIds: [createdSources[1].id], // Pew Research
    },
    {
      title: 'Term Limits Support Reaches Peak',
      dateStart: new Date('2002-06-01'),
      summary: 'Public support for congressional term limits reached its highest level, with 80% of Americans favoring limits according to Gallup polling.',
      tags: ['public-opinion', 'polling', 'peak-support'],
      sourceIds: [createdSources[1].id], // Pew Research
    },
    {
      title: 'U.S. Term Limits v. Raythor Supreme Court Case',
      dateStart: new Date('2004-10-04'),
      summary: 'Supreme Court reaffirmed its 1995 ruling that states cannot impose term limits on federal representatives, maintaining the constitutional requirement for amendments.',
      tags: ['supreme-court', 'constitutional', 'reaffirmation'],
      sourceIds: [createdSources[5].id], // Constitutional Amendment Process
    },
    {
      title: 'Term Limits Amendment Introduced Again',
      dateStart: new Date('2006-01-01'),
      summary: 'Representative Ron Paul introduced a new constitutional amendment for congressional term limits, but it failed to gain significant support.',
      tags: ['amendment', 'introduction', 'ron-paul'],
      sourceIds: [createdSources[9].id], // Congressional Research Service
    },
    {
      title: 'Tea Party Movement Embraces Term Limits',
      dateStart: new Date('2009-04-15'),
      summary: 'The Tea Party movement made congressional term limits a central plank of their platform, helping to elect candidates who supported limits.',
      tags: ['tea-party', 'movement', 'platform'],
      sourceIds: [createdSources[1].id], // Pew Research
    },
    {
      title: 'Term Limits Amendment Gains Cosponsors',
      dateStart: new Date('2011-03-01'),
      summary: 'A new term limits amendment gained 50 cosponsors in the House, the highest number in over a decade, but still fell short of the required 2/3 majority.',
      tags: ['amendment', 'cosponsors', 'house'],
      sourceIds: [createdSources[9].id], // Congressional Research Service
    },
    {
      title: 'Senate Term Limits Amendment Introduced',
      dateStart: new Date('2013-01-01'),
      summary: 'Senator Ted Cruz introduced a constitutional amendment for congressional term limits, marking the first serious Senate effort in years.',
      tags: ['senate', 'amendment', 'ted-cruz'],
      sourceIds: [createdSources[9].id], // Congressional Research Service
    },
    {
      title: 'Term Limits Support Remains High',
      dateStart: new Date('2015-06-01'),
      summary: 'Pew Research found that 74% of Americans still support congressional term limits, with support remaining consistent across party lines.',
      tags: ['public-opinion', 'pew-research', 'bipartisan'],
      sourceIds: [createdSources[1].id], // Pew Research
    },
    {
      title: 'New Term Limits Amendment Proposed',
      dateStart: new Date('2017-01-01'),
      summary: 'Representative Ron DeSantis introduced a new term limits amendment with 12-year limits for both House and Senate members.',
      tags: ['amendment', 'ron-desantis', '12-year-limits'],
      sourceIds: [createdSources[9].id], // Congressional Research Service
    },
    {
      title: 'Term Limits Amendment Reaches 100 Cosponsors',
      dateStart: new Date('2019-03-15'),
      summary: 'The term limits amendment reached 100 cosponsors in the House, representing the highest level of congressional support in decades.',
      tags: ['amendment', 'cosponsors', 'milestone'],
      sourceIds: [createdSources[9].id], // Congressional Research Service
    },
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
      }
    })
  }

  console.log(`✅ Created ${events.length} events`)

  // Create some sample posts
  const posts = [
    {
      title: 'Why Term Limits Matter for Democracy',
      body: 'Term limits ensure that our representatives remain connected to their constituents and don\'t become career politicians. This is essential for maintaining a healthy democracy.',
      type: 'TEXT' as const,
      tags: ['democracy', 'accountability'],
      metrics: { likes: 42, comments: 8, reposts: 12, views: 156 },
    },
    {
      title: 'The Case for 12-Year Limits',
      body: 'After studying state legislatures with term limits, I believe 12 years is the sweet spot - enough time to gain experience but not so long that representatives become disconnected.',
      type: 'TEXT' as const,
      tags: ['12-year-limits', 'research', 'experience'],
      metrics: { likes: 28, comments: 15, reposts: 5, views: 89 },
    },
    {
      title: 'Term Limits and Special Interests',
      body: 'One of the biggest benefits of term limits is reducing the influence of special interests. When representatives know they\'ll be leaving, they\'re less likely to be swayed by lobbyists.',
      type: 'TEXT' as const,
      tags: ['special-interests', 'lobbyists', 'influence'],
      metrics: { likes: 35, comments: 12, reposts: 8, views: 134 },
    },
    {
      title: 'What About Experience?',
      body: 'Critics say term limits remove experienced legislators. But I think fresh perspectives are more valuable than decades of experience in a broken system.',
      type: 'TEXT' as const,
      tags: ['experience', 'fresh-perspectives', 'criticism'],
      metrics: { likes: 19, comments: 22, reposts: 3, views: 67 },
    },
    {
      title: 'State Success Stories',
      body: 'Look at California, Florida, and Michigan - their state legislatures work just fine with term limits. The sky didn\'t fall, and governance actually improved.',
      type: 'TEXT' as const,
      tags: ['state-examples', 'success-stories', 'governance'],
      metrics: { likes: 31, comments: 7, reposts: 9, views: 98 },
    },
  ]

  for (const post of posts) {
    await prisma.patchPost.create({
      data: {
        patchId: patch.id,
        authorId: user.id,
        title: post.title,
        body: post.body,
        type: post.type,
        tags: post.tags,
        metrics: post.metrics,
      }
    })
  }

  console.log(`✅ Created ${posts.length} posts`)

  // Create some members (upsert to avoid duplicate)
  const member = await prisma.patchMember.upsert({
    where: {
      patch_user_member_unique: {
        patchId: patch.id,
        userId: user.id,
      }
    },
    update: {},
    create: {
      patchId: patch.id,
      userId: user.id,
      role: 'admin',
    }
  })

  console.log(`✅ Created/updated member: ${member.role}`)

  console.log('🎉 Patch redesign seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
