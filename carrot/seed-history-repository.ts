import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedHistoryRepository() {
  console.log('🌱 Seeding History Repository...');

  // First, ensure the History patch exists
  const historyPatch = await prisma.patch.upsert({
    where: { handle: 'history' },
    update: {},
    create: {
      handle: 'history',
      name: 'History',
      tagline: 'Global History & Primary Sources',
      description: 'A comprehensive repository of historical events, facts, and primary sources from around the world.',
      theme: 'light',
      tags: ['History', 'Primary Sources', 'Research', 'Education'],
      createdBy: 'seed-user-1',
    }
  });

  console.log('✅ History patch created/updated');

  // Seed Facts
  const facts = [
    {
      label: 'Primary Focus',
      value: 'Global History & Primary Sources',
    },
    {
      label: 'Content Type',
      value: 'Documents, Events, Sources, Discussions',
    },
    {
      label: 'Era Coverage',
      value: 'Ancient to Modern (3000 BCE - Present)',
    },
    {
      label: 'Contributors',
      value: 'Scholars & Enthusiasts',
    },
    {
      label: 'Key Features',
      value: 'Timeline, Resources, Discussions',
    },
    {
      label: 'AI Integration',
      value: 'Research & Curation',
    },
    {
      label: 'Source Types',
      value: 'Academic Papers, Books, Archives, Museums',
    },
    {
      label: 'Verification',
      value: 'Peer-reviewed & Primary Sources Only',
    }
  ];

  for (const fact of facts) {
    await prisma.fact.create({
      data: {
        patchId: historyPatch.id,
        label: fact.label,
        value: fact.value,
      }
    });
  }

  console.log('✅ Facts seeded');

  // Seed Sources
  const sources = [
    {
      title: 'British Museum Collection',
      url: 'https://www.britishmuseum.org/collection',
      author: 'British Museum',
      publisher: 'British Museum',
      addedBy: 'seed-user-1',
    },
    {
      title: 'Library of Congress Digital Collections',
      url: 'https://www.loc.gov/collections/',
      author: 'Library of Congress',
      publisher: 'Library of Congress',
      addedBy: 'seed-user-1',
    },
    {
      title: 'Vatican Secret Archives',
      url: 'https://www.vatican.va/archive/arch_secretum/index.htm',
      author: 'Vatican',
      publisher: 'Vatican City',
      addedBy: 'seed-user-1',
    },
    {
      title: 'JSTOR: Scholarly Journals',
      url: 'https://www.jstor.org/',
      author: 'JSTOR',
      publisher: 'ITHAKA',
      addedBy: 'seed-user-1',
    },
    {
      title: 'Project Gutenberg: Classical Texts',
      url: 'https://www.gutenberg.org/browse/scores/2',
      author: 'Project Gutenberg',
      publisher: 'Project Gutenberg',
      addedBy: 'seed-user-1',
    },
    {
      title: 'National Archives (UK)',
      url: 'https://www.nationalarchives.gov.uk/',
      author: 'The National Archives',
      publisher: 'UK Government',
      addedBy: 'seed-user-1',
    },
    {
      title: 'Smithsonian Institution',
      url: 'https://www.si.edu/',
      author: 'Smithsonian',
      publisher: 'Smithsonian Institution',
      addedBy: 'seed-user-1',
    },
    {
      title: 'Internet Archive',
      url: 'https://archive.org/',
      author: 'Internet Archive',
      publisher: 'Internet Archive',
      addedBy: 'seed-user-1',
    },
    {
      title: 'Harvard Digital Collections',
      url: 'https://library.harvard.edu/digital-collections',
      author: 'Harvard University',
      publisher: 'Harvard Library',
      addedBy: 'seed-user-1',
    },
    {
      title: 'Oxford Digital Library',
      url: 'https://digital.bodleian.ox.ac.uk/',
      author: 'University of Oxford',
      publisher: 'Bodleian Libraries',
      addedBy: 'seed-user-1',
    }
  ];

  const createdSources = [];
  for (const source of sources) {
    const created = await prisma.source.create({
      data: {
        patchId: historyPatch.id,
        title: source.title,
        url: source.url,
        author: source.author,
        publisher: source.publisher,
        addedBy: source.addedBy,
      }
    });
    createdSources.push(created);
  }

  console.log('✅ Sources seeded');

  // Seed Events
  const events = [
    {
      title: 'Construction of the Great Pyramid of Giza',
      dateStart: new Date('2580-01-01T00:00:00Z'),
      dateEnd: new Date('2560-01-01T00:00:00Z'),
      summary: 'The Great Pyramid of Giza, the oldest and largest of the three pyramids in the Giza pyramid complex, was built as a tomb for the Fourth Dynasty Egyptian pharaoh Khufu.',
      tags: ['Ancient Egypt', 'Architecture', 'Monuments'],
      sourceIds: [createdSources[0].id], // British Museum
    },
    {
      title: 'Founding of Rome',
      dateStart: new Date('0753-04-21T00:00:00Z'),
      summary: 'According to tradition, the city of Rome was founded by Romulus on the Palatine Hill.',
      tags: ['Ancient Rome', 'Mythology', 'City Founding'],
      sourceIds: [createdSources[1].id], // Library of Congress
    },
    {
      title: 'Battle of Thermopylae',
      dateStart: new Date('0480-08-01T00:00:00Z'),
      summary: 'A small force of Spartans, led by King Leonidas, and other Greek allies held off a much larger Persian army for three days.',
      tags: ['Ancient Greece', 'Persian Wars', 'Military History'],
      sourceIds: [createdSources[2].id], // Vatican Archives
    },
    {
      title: 'Fall of the Western Roman Empire',
      dateStart: new Date('0476-09-04T00:00:00Z'),
      summary: 'The traditional date for the collapse of the Western Roman Empire, when the Germanic chieftain Odoacer deposed the last Roman emperor in the west, Romulus Augustulus.',
      tags: ['Roman Empire', 'Late Antiquity', 'Empire Collapse'],
      sourceIds: [createdSources[3].id], // JSTOR
    },
    {
      title: 'Black Death reaches Europe',
      dateStart: new Date('1347-10-01T00:00:00Z'),
      summary: 'The bubonic plague, known as the Black Death, arrived in Europe via merchant ships, leading to a devastating pandemic.',
      tags: ['Medieval History', 'Pandemic', 'Public Health'],
      sourceIds: [createdSources[4].id], // Project Gutenberg
    },
    {
      title: 'Discovery of America by Columbus',
      dateStart: new Date('1492-10-12T00:00:00Z'),
      summary: 'Christopher Columbus landed in the Americas, initiating the European colonization of the New World.',
      tags: ['Age of Discovery', 'Exploration', 'Colonization'],
      sourceIds: [createdSources[5].id], // National Archives
    },
    {
      title: 'French Revolution begins',
      dateStart: new Date('1789-07-14T00:00:00Z'),
      summary: 'The storming of the Bastille prison marked the beginning of the French Revolution, a period of far-reaching social and political upheaval.',
      tags: ['Modern History', 'Revolution', 'Political Change'],
      sourceIds: [createdSources[6].id], // Smithsonian
    },
    {
      title: 'World War I begins',
      dateStart: new Date('1914-07-28T00:00:00Z'),
      summary: 'The assassination of Archduke Franz Ferdinand triggered a series of events leading to the outbreak of the First World War.',
      tags: ['20th Century', 'World Wars', 'Global Conflict'],
      sourceIds: [createdSources[7].id], // Internet Archive
    },
    {
      title: 'First Moon Landing',
      dateStart: new Date('1969-07-20T00:00:00Z'),
      summary: 'Apollo 11 astronauts Neil Armstrong and Buzz Aldrin became the first humans to walk on the Moon.',
      tags: ['Space Exploration', 'Cold War', 'Technology'],
      sourceIds: [createdSources[8].id], // Harvard Digital
    },
    {
      title: 'Fall of the Berlin Wall',
      dateStart: new Date('1989-11-09T00:00:00Z'),
      summary: 'The fall of the Berlin Wall symbolized the collapse of communism in Eastern Europe and the end of the Cold War.',
      tags: ['Cold War', 'Contemporary History', 'Political Change'],
      sourceIds: [createdSources[9].id], // Oxford Digital
    },
    {
      title: 'Invention of Writing',
      dateStart: new Date('3200-01-01T00:00:00Z'),
      summary: 'The Sumerians developed cuneiform writing, one of the earliest known writing systems, marking the transition from prehistory to history.',
      tags: ['Ancient History', 'Writing', 'Civilization'],
      sourceIds: [createdSources[0].id], // British Museum
    },
    {
      title: 'Birth of Democracy in Athens',
      dateStart: new Date('0508-01-01T00:00:00Z'),
      summary: 'Cleisthenes established democracy in Athens, creating the first known democratic government in history.',
      tags: ['Ancient Greece', 'Democracy', 'Political Systems'],
      sourceIds: [createdSources[1].id], // Library of Congress
    },
    {
      title: 'Renaissance begins in Italy',
      dateStart: new Date('1400-01-01T00:00:00Z'),
      summary: 'The Renaissance period began in Italy, marking a cultural rebirth and the transition from medieval to modern Europe.',
      tags: ['Renaissance', 'Art', 'Culture'],
      sourceIds: [createdSources[2].id], // Vatican Archives
    },
    {
      title: 'Industrial Revolution begins',
      dateStart: new Date('1760-01-01T00:00:00Z'),
      summary: 'The Industrial Revolution began in Britain, transforming society through mechanization and mass production.',
      tags: ['Industrial Revolution', 'Technology', 'Economic Change'],
      sourceIds: [createdSources[3].id], // JSTOR
    },
    {
      title: 'World Wide Web invented',
      dateStart: new Date('1989-03-12T00:00:00Z'),
      summary: 'Tim Berners-Lee invented the World Wide Web, revolutionizing global communication and information sharing.',
      tags: ['Technology', 'Internet', 'Communication'],
      sourceIds: [createdSources[4].id], // Project Gutenberg
    }
  ];

  for (const event of events) {
    await prisma.event.create({
      data: {
        patchId: historyPatch.id,
        title: event.title,
        dateStart: event.dateStart,
        dateEnd: event.dateEnd || null,
        summary: event.summary,
        tags: event.tags,
        sourceIds: event.sourceIds,
      }
    });
  }

  console.log('✅ Events seeded');

  // Seed some sample posts
  const posts = [
    {
      type: 'TEXT' as const,
      title: 'Reevaluating the Bronze Age Collapse: Climate vs. Migration',
      body: 'A deep dive into the complex reasons behind the collapse of various Bronze Age civilizations around 1200 BCE. Recent archaeological evidence suggests a combination of climate change, natural disasters, and migration patterns contributed to this widespread collapse.',
      tags: ['Bronze Age', 'Archaeology', 'Climate Change'],
      authorId: 'seed-user-1',
      metrics: { likes: 45, comments: 12, reposts: 8, views: 234 }
    },
    {
      type: 'TEXT' as const,
      title: 'New Discoveries at Göbekli Tepe: Insights into Early Human Beliefs',
      body: 'Recent excavations have unearthed fascinating artifacts providing new perspectives on the religious and social practices of early humans. The site predates Stonehenge by 6,000 years and challenges our understanding of early civilization.',
      tags: ['Archaeology', 'Prehistory', 'Religion'],
      authorId: 'seed-user-1',
      metrics: { likes: 30, comments: 8, reposts: 5, views: 156 }
    },
    {
      type: 'LINK' as const,
      title: 'Digital Archive of Ancient Scrolls Now Available',
      body: 'The Herculaneum scrolls, carbonized by the eruption of Mount Vesuvius, are being digitally unrolled and translated using advanced imaging technology.',
      url: 'https://www.herculaneum.ox.ac.uk/',
      tags: ['Ancient Rome', 'Digital Humanities', 'Technology'],
      authorId: 'seed-user-1',
      metrics: { likes: 67, comments: 15, reposts: 12, views: 445 }
    }
  ];

  for (const post of posts) {
    await prisma.patchPost.create({
      data: {
        patchId: historyPatch.id,
        type: post.type,
        title: post.title,
        body: post.body,
        url: post.url || null,
        tags: post.tags,
        authorId: post.authorId,
        metrics: post.metrics,
      }
    });
  }

  console.log('✅ Posts seeded');

  console.log('🎉 History Repository seeding completed!');
}

seedHistoryRepository()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
