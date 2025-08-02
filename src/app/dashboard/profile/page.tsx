import { UserProfileManager } from '@/components/profile/UserProfileManager'

export default function ProfilePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <UserProfileManager />
    </div>
  )
}

export const metadata = {
  title: 'Profile Settings',
  description: 'Manage your profile, security settings, and preferences',
}