"use client"

import { useState } from "react"
import { signIn, getSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card } from "@/components/ui/Card"

interface TenantOption {
  id: string
  name: string
  subdomain: string
  customDomain?: string
}

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showTenantSelection, setShowTenantSelection] = useState(false)
  const [availableTenants, setAvailableTenants] = useState<TenantOption[]>([])
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setShowTenantSelection(false)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false
      })

      if (result?.error) {
        // Check if it's a tenant selection scenario
        if (result.error.includes("multiple tenants")) {
          // This would be handled by the backend, but for now we'll use a different approach
          setError("Multiple accounts found. Please try again or use advanced login.")
        } else {
          setError("Invalid email or password")
        }
      } else {
        // Get the session to check if sign in was successful
        const session = await getSession()
        if (session) {
          // Check if user has multiple tenants available
          if (session.user.availableTenants && session.user.availableTenants.length > 1) {
            setAvailableTenants(session.user.availableTenants)
            setShowTenantSelection(true)
            setIsLoading(false)
            return
          }
          
          // Single tenant or primary tenant selected, redirect to dashboard
          router.push(callbackUrl)
        }
      }
    } catch (error) {
      console.error("Sign in error:", error)
      setError("An error occurred during sign in")
    } finally {
      setIsLoading(false)
    }
  }

  const handleTenantSelection = async (selectedTenantId: string) => {
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        tenantId: selectedTenantId,
        redirect: false
      })

      if (result?.error) {
        setError("Failed to sign in to selected account")
      } else {
        const session = await getSession()
        if (session) {
          router.push(callbackUrl)
        }
      }
    } catch (error) {
      setError("An error occurred during sign in")
    } finally {
      setIsLoading(false)
    }
  }

  // Show tenant selection if multiple tenants are available
  if (showTenantSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Select Account</h1>
            <p className="text-gray-600 mt-2">
              You have access to multiple accounts. Please select one to continue.
            </p>
          </div>

          <div className="space-y-3">
            {availableTenants.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => handleTenantSelection(tenant.id)}
                disabled={isLoading}
                className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <div className="font-medium text-gray-900">{tenant.name}</div>
                <div className="text-sm text-gray-500">
                  {tenant.customDomain || `${tenant.subdomain}.yourdomain.com`}
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setShowTenantSelection(false)
                setAvailableTenants([])
                setError("")
              }}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ← Back to login
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>
          <p className="text-gray-600 mt-2">Access your email marketing platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter your email address"
            fullWidth
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
            showPasswordToggle
            fullWidth
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="text-red-800 text-sm">{error}</div>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-6 border-t pt-6">
          <div className="text-center mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Test Accounts</h3>
            <div className="space-y-3 text-xs text-gray-600">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">SUPERADMIN</span>
                </div>
                <div className="font-medium text-gray-800">superadmin@platform.com</div>
                <div className="text-gray-600">Password: superadmin123</div>
                <div className="text-blue-600 text-xs mt-1">Main Platform • Full Access</div>
              </div>
              
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-medium">ADMIN</span>
                </div>
                <div className="font-medium text-gray-800">admin@demo.com</div>
                <div className="text-gray-600">Password: admin123</div>
                <div className="text-green-600 text-xs mt-1">Demo Company • Admin Access</div>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <span className="bg-gray-600 text-white px-2 py-1 rounded text-xs font-medium">USER</span>
                </div>
                <div className="font-medium text-gray-800">user@demo.com</div>
                <div className="text-gray-600">Password: user123</div>
                <div className="text-gray-600 text-xs mt-1">Demo Company • Standard Access</div>
              </div>
            </div>
            
            <div className="mt-4 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-xs text-blue-800">
                <strong>✨ Enhanced Login:</strong> Just enter your email and password - we'll automatically detect your account and organization!
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <a href="/auth/signup" className="text-blue-600 hover:text-blue-500">
                Sign up
              </a>
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}