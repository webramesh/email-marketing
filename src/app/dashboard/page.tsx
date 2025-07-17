import { requireAuth } from "@/lib/auth-utils"
import { Card } from "@/components/ui/Card"

export default async function DashboardPage() {
  const session = await requireAuth()

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome to your email marketing platform</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">User Info</h3>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Name:</span> {session.user.name || "N/A"}</p>
              <p><span className="font-medium">Email:</span> {session.user.email}</p>
              <p><span className="font-medium">Role:</span> {session.user.role}</p>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Tenant Info</h3>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Name:</span> {session.user.tenant.name}</p>
              <p><span className="font-medium">Subdomain:</span> {session.user.tenant.subdomain}</p>
              <p><span className="font-medium">ID:</span> {session.user.tenantId}</p>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full text-left text-sm text-blue-600 hover:text-blue-500">
                Create Campaign
              </button>
              <button className="w-full text-left text-sm text-blue-600 hover:text-blue-500">
                Manage Subscribers
              </button>
              <button className="w-full text-left text-sm text-blue-600 hover:text-blue-500">
                View Analytics
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}