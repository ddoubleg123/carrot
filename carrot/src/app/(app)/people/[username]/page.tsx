import MinimalNav from '../../../../components/MinimalNav'
import { deskByUsername, deskDisclosure } from '@/lib/curator/desks'
import PersonProfile from './PersonProfile'

export default async function PersonPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const handle = decodeURIComponent(username)
  const desk = deskByUsername(handle)
  const initial = desk ? {
    id: desk.id,
    name: desk.name,
    username: desk.username,
    avatar: desk.avatar,
    banner: desk.banner,
    bio: desk.bio,
    disclosure: deskDisclosure(),
    followerCount: 0,
    following: false,
    isSelf: false,
    posts: []
  } : null
  return (
    <div className="min-h-screen flex bg-[#F6F3EE]">
      <aside className="w-20 shrink-0 sticky top-0 self-start h-screen bg-[#F6F3EE] border-r border-gray-200">
        <MinimalNav />
      </aside>
      <main className="flex-1 min-w-0">
        <div className="w-full max-w-[720px] pb-16">
          <PersonProfile username={handle} initial={initial} />
        </div>
      </main>
    </div>
  )
}
