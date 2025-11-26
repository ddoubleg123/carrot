/**
 * Organization admin authentication check
 * Used for debug endpoints and admin actions
 */

import { auth } from '@/auth'

/**
 * Check if current user is org admin
 * Returns true if user has admin role, false otherwise
 */
export async function requireOrgAdmin(): Promise<{ isAdmin: boolean; userId?: string }> {
  try {
    const session = await auth()
    
    if (!session || !session.user) {
      return { isAdmin: false }
    }
    
    // Check if user has admin role
    // This assumes your User model has a role field or similar
    // Adjust based on your actual auth setup
    const user = session.user as any
    
    // For now, check if user email is in admin list or has admin metadata
    // You should replace this with your actual admin check logic
    const isAdmin = user.role === 'admin' || 
                   user.role === 'org_admin' ||
                   (process.env.ADMIN_EMAILS?.split(',').includes(user.email || ''))
    
    return {
      isAdmin: !!isAdmin,
      userId: user.id || user.email
    }
  } catch (error) {
    console.error('[Auth] Error checking org admin:', error)
    return { isAdmin: false }
  }
}

