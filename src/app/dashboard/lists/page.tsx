import { ListManagement } from '@/components/lists/ListManagement'
import { getTenantFromHeaders } from '@/lib/tenant/middleware'
import { headers } from 'next/headers'

export default async function ListsPage() {
  const headersList = await headers()
  let { tenantId } = getTenantFromHeaders(headersList)

  // In development mode, use demo tenant if no tenant is found
  if (!tenantId && process.env.NODE_ENV === 'development') {
    tenantId = 'demo-tenant'
  }

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tenant Not Found</h1>
          <p className="text-gray-600">Unable to determine tenant context.</p>
        </div>
      </div>
    )
  }

  return <ListManagement tenantId={tenantId} />
}