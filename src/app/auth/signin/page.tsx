"use client"

import { useState } from "react"
import { signIn, getSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card } from "@/components/ui/Card"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [tenantId, setTenantId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        tenantId,
        redirect: false
      })

      if (result?.error) {
        setError("Invalid credentials")
      } else {
        // Get the session to check if sign in was successful
        const session = await getSession()
        if (session) {
          router.push("/dashboard")
        }
      }
    } catch (error) {
      setError("An error occurred during sign in")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>
          <p className="text-gray-600 mt-2">Access your email marketing platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>

          <div>
            <label htmlFor="tenantId" className="block text-sm font-medium text-gray-700 mb-1">
              Tenant ID
            </label>
            <Input
              id="tenantId"
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
              placeholder="Enter your tenant ID"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">
              {error}
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

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{" "}
            <a href="/auth/signup" className="text-blue-600 hover:text-blue-500">
              Sign up
            </a>
          </p>
        </div>
      </Card>
    </div>
  )
}