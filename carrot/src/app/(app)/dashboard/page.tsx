
import FirebaseClientInit from './components/FirebaseClientInit';
import '@/lib/firebase';
import { auth } from '@/auth';
import { Suspense } from 'react';
import type { CommitmentCardProps } from './components/CommitmentCard';
import { redirect } from 'next/navigation';
import DashboardClientWrapper from './DashboardClientWrapper';

// Server-side data fetching
async function getCommitments(): Promise<CommitmentCardProps[]> {
  // In a real app, this would be an API call or database query
  return [
    {
      id: '1',
      content: '🌱 I pledge to reduce my carbon footprint by 50% in the next year.\n1. Use public transportation more.\n2. Eat less meat.\n3. Switch to LED lights.\n4. Compost food waste.\n5. Take shorter showers.\n6. Support local farmers.\n7. Recycle more.\n8. Share my progress with friends.',
      carrotText: 'I will help you achieve this goal!',
      stickText: 'I will hold you accountable!',
      author: {
        name: 'John Doe',
        username: 'johndoe',
        avatar: null,
        flag: '🇺🇸',
      },
      location: {
        zip: '10001',
        city: 'New York',
        state: 'NY',
      },
      stats: {
        likes: 42,
        comments: 7,
        reposts: 3,
        views: 128,
        carrots: 35,
        sticks: 7,
      },
      userVote: null,
      innerBoxColor: 'bg-gradient-to-br from-green-400 to-blue-300',
      timestamp: '2h',
    },
    {
      id: '2',
      content: 'As mayor, I will implement a universal basic income pilot program in our city.',
      carrotText: 'I will volunteer for your campaign.',
      stickText: 'I will vote you out if you break this promise!',
      author: {
        name: 'Jane Smith',
        username: 'janesmith',
        avatar: null,
        flag: '🇨🇦',
      },
      location: {
        zip: '94107',
        city: 'San Francisco',
        state: 'CA',
      },
      stats: {
        likes: 128,
        comments: 24,
        reposts: 15,
        views: 512,
        carrots: 98,
        sticks: 30,
      },
      userVote: null,
      innerBoxColor: 'bg-gradient-to-br from-yellow-200 via-orange-200 to-pink-200',
      timestamp: '2h',
    },
    {
      id: '3',
      content: 'Committing to 30 minutes of meditation every morning.\nDay 3 and feeling more focused already!\nMindfulness is key.',
      carrotText: 'I support this!',
      stickText: 'I will check in on your progress!',
      author: {
        name: 'Alex Johnson',
        username: 'alexj',
        avatar: null,
        flag: '🇬🇧',
      },
      location: {
        zip: '60601',
        city: 'Chicago',
        state: 'IL',
      },
      stats: {
        likes: 56,
        comments: 12,
        reposts: 8,
        views: 256,
        carrots: 45,
        sticks: 11,
      },
      userVote: null,
      innerBoxColor: 'bg-gradient-to-br from-purple-300 to-blue-200',
      timestamp: '2h',
    },
    {
      id: '4',
      content: '🚴‍♂️ Just biked to work for the first time this year!\nFeels amazing to skip traffic and help the planet.\nTrying to make this a weekly habit.\nAnyone else biking to work?\nLet’s encourage each other!',
      carrotText: 'Way to go! Keep it up! 🚲',
      stickText: 'I’ll remind you if you stop biking!',
      author: {
        name: 'Sam Lee',
        username: 'samlee',
        avatar: null,
        flag: '🇦🇺',
      },
      location: {
        zip: '2000',
        city: 'Sydney',
        state: 'NSW',
      },
      stats: {
        likes: 77,
        comments: 18,
        reposts: 6,
        views: 312,
        carrots: 62,
        sticks: 9,
      },
      userVote: null,
      innerBoxColor: 'bg-gradient-to-br from-cyan-200 to-lime-200',
      timestamp: '1h',
    },
  ];
}

export default async function DashboardPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }

  const commitments = await getCommitments();

  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    }>
      <div className="min-h-screen bg-gray-50" style={{ marginTop: 0, paddingTop: 0 }}>

        <FirebaseClientInit />
        <FirebaseClientInit />
        <DashboardClientWrapper initialCommitments={commitments} />
      </div>
    </Suspense>
  );
}
