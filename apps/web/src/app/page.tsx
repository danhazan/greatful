"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Heart } from "lucide-react"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem("access_token")
    if (token) {
      // Redirect to feed if authenticated
      router.push("/feed")
    }
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Logo */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
              <span className="text-3xl">💜</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Grateful</h1>
            <p className="text-gray-600">Share your daily gratitude and build positive connections</p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={() => router.push("/auth/login")}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => router.push("/auth/signup")}
              className="w-full bg-purple-100 text-purple-700 py-3 px-6 rounded-lg font-semibold hover:bg-purple-200 transition-colors"
            >
              Sign Up
            </button>
          </div>

          {/* Features */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-gray-500 text-sm">
              Express gratitude • Connect with others • Build positive habits
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}