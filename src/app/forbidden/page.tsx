import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Access Denied</h1>
        
        <div className="text-gray-700 mb-6">
          <p className="mb-4">
            You don't have permission to access this resource.
          </p>
          <p>
            If you believe this is an error, please contact your administrator
            for assistance.
          </p>
        </div>
        
        <div className="flex justify-center space-x-4">
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </Link>
          
          <Link
            href="/"
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}