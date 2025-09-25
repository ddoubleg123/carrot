const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedRomeData() {
  try {
    console.log('🏛️ Starting Rome data seeding...');

    // Create the Rome patch
    const romePatch = await prisma.patch.upsert({
      where: { handle: 'rome' },
      update: {},
      create: {
        handle: 'rome',
        name: 'Rome',
        description: 'Explore the eternal city through its rich history, culture, and enduring legacy that shaped Western civilization.',
        theme: 'marble',
        tags: ['history', 'culture', 'architecture', 'empire', 'civilization'],
        createdBy: 'seed-user-1',
        createdAt: new Date(),
      }
    });

    console.log('✅ Created Rome patch:', romePatch.id);

    // Create timeline events for Roman history
    const timelineEvents = [
      {
        title: 'Foundation of Rome',
        date: '753 BCE',
        description: 'According to legend, Rome was founded by Romulus and Remus on the Palatine Hill.',
        type: 'foundation',
        significance: 'The beginning of Roman civilization and the start of a journey that would shape world history.',
        tags: ['legend', 'foundation', 'mythology']
      },
      {
        title: 'Roman Republic Established',
        date: '509 BCE',
        description: 'The last Roman king, Tarquin the Proud, was overthrown, establishing the Roman Republic.',
        type: 'political',
        significance: 'Marked the transition from monarchy to a republican form of government that lasted nearly 500 years.',
        tags: ['republic', 'government', 'revolution']
      },
      {
        title: 'Punic Wars Begin',
        date: '264 BCE',
        description: 'The first of three wars between Rome and Carthage for control of the Mediterranean.',
        type: 'military',
        significance: 'Established Rome as the dominant power in the western Mediterranean.',
        tags: ['war', 'carthage', 'mediterranean', 'expansion']
      },
      {
        title: 'Julius Caesar Crosses the Rubicon',
        date: '49 BCE',
        description: 'Caesar defied the Senate by crossing the Rubicon River with his army, starting a civil war.',
        type: 'military',
        significance: 'The point of no return that led to the end of the Republic and beginning of the Empire.',
        tags: ['caesar', 'civil war', 'rubicon', 'republic']
      },
      {
        title: 'Augustus Becomes First Emperor',
        date: '27 BCE',
        description: 'Octavian (Augustus) becomes the first Roman Emperor, beginning the Pax Romana.',
        type: 'political',
        significance: 'Marked the official end of the Republic and beginning of the Roman Empire.',
        tags: ['augustus', 'empire', 'pax romana', 'emperor']
      },
      {
        title: 'Construction of the Colosseum',
        date: '80 CE',
        description: 'The Flavian Amphitheatre (Colosseum) was completed under Emperor Titus.',
        type: 'architecture',
        significance: 'One of the greatest architectural achievements of ancient Rome, symbol of imperial power.',
        tags: ['colosseum', 'architecture', 'entertainment', 'engineering']
      },
      {
        title: 'Trajan\'s Column Completed',
        date: '113 CE',
        description: 'Monumental column celebrating Emperor Trajan\'s victory in the Dacian Wars.',
        type: 'monument',
        significance: 'Masterpiece of Roman art and propaganda, depicting military conquest in intricate detail.',
        tags: ['trajan', 'art', 'propaganda', 'dacia']
      },
      {
        title: 'Hadrian\'s Wall Built',
        date: '122 CE',
        description: 'Defensive fortification built across northern Britain under Emperor Hadrian.',
        type: 'military',
        significance: 'Symbol of Roman engineering prowess and the empire\'s defensive strategy.',
        tags: ['hadrian', 'britain', 'defense', 'engineering']
      },
      {
        title: 'Constantine Converts to Christianity',
        date: '312 CE',
        description: 'Emperor Constantine converted to Christianity after his victory at the Battle of Milvian Bridge.',
        type: 'religious',
        significance: 'Pivotal moment that led to Christianity becoming the dominant religion of the Roman Empire.',
        tags: ['constantine', 'christianity', 'religion', 'conversion']
      },
      {
        title: 'Fall of the Western Roman Empire',
        date: '476 CE',
        description: 'Germanic chieftain Odoacer deposed the last Western Roman Emperor, Romulus Augustulus.',
        type: 'political',
        significance: 'Traditional end date of ancient Rome, though the Eastern Empire continued for another 1000 years.',
        tags: ['fall', 'odoacer', 'germanic', 'end of empire']
      }
    ];

    // Create timeline events in the database
    for (const event of timelineEvents) {
      await prisma.event.upsert({
        where: { 
          patchId_date: {
            patchId: romePatch.id,
            date: event.date
          }
        },
        update: {},
        create: {
          patchId: romePatch.id,
          title: event.title,
          date: event.date,
          description: event.description,
          type: event.type,
          significance: event.significance,
          tags: event.tags,
          createdAt: new Date(),
        }
      });
    }

    console.log('✅ Created', timelineEvents.length, 'timeline events');

    // Create some key facts about Rome
    const keyFacts = [
      {
        label: 'Duration of Empire',
        value: 'Over 1,000 years',
        description: 'From 753 BCE to 476 CE, Rome dominated the Mediterranean world'
      },
      {
        label: 'Peak Population',
        value: '1 million+',
        description: 'Rome was the largest city in the ancient world at its height'
      },
      {
        label: 'Territory Controlled',
        value: '2.5 million sq mi',
        description: 'At its peak, the Roman Empire spanned three continents'
      },
      {
        label: 'Languages Spoken',
        value: 'Latin & Greek',
        description: 'Latin was the official language, Greek the language of culture'
      },
      {
        label: 'Major Achievements',
        value: 'Roads, Aqueducts, Law',
        description: 'Roman engineering and legal systems still influence us today'
      },
      {
        label: 'Famous Emperors',
        value: 'Augustus, Trajan, Marcus Aurelius',
        description: 'Some of history\'s most influential leaders'
      }
    ];

    for (const fact of keyFacts) {
      await prisma.fact.upsert({
        where: {
          patchId_label: {
            patchId: romePatch.id,
            label: fact.label
          }
        },
        update: {},
        create: {
          patchId: romePatch.id,
          label: fact.label,
          value: fact.value,
          description: fact.description,
          createdAt: new Date(),
        }
      });
    }

    console.log('✅ Created', keyFacts.length, 'key facts');
    console.log('🏛️ Rome data seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding Rome data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedRomeData();
