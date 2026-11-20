import { auth } from '@/auth'
import { isAdminEmail } from '@/lib/admin'

const OWNER_ID = '6937a112-4c93-4bd2-a4a6-3972a3bb61fd'

export async function curatorAllowed(): Promise<boolean> {
  const session = await auth()
  const user = session?.user as { id?: string; email?: string } | undefined
  if (!user?.id) return false
  if (user.id === OWNER_ID) return true
  return isAdminEmail(user.email)
}
