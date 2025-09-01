'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: string
  name: string
  username?: string
  email: string
  image?: string
}

interface UserContextType {
  currentUser: User | null
  setCurrentUser: (user: User | null) => void
  isLoading: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Only access localStorage on client-side
        if (typeof window === 'undefined') {
          setIsLoading(false)
          return
        }

        const token = localStorage.getItem('access_token')
        if (!token) {
          setCurrentUser(null)
          setIsLoading(false)
          return
        }

        // Validate token and fetch user data
        const response = await fetch('/api/users/me/profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const apiResponse = await response.json()
          // The backend returns data wrapped in { success: true, data: {...} }
          const userData = apiResponse.data
          
          // Safely handle user data and ensure id exists before converting
          if (userData && userData.id) {
            setCurrentUser({
              id: userData.id.toString(),
              name: userData.display_name || userData.name || userData.username,
              username: userData.username,
              email: userData.email,
              image: userData.profile_image_url
            })
          } else {
            // Invalid user data, remove token
            localStorage.removeItem('access_token')
            setCurrentUser(null)
          }
        } else {
          // Token is invalid, remove it
          localStorage.removeItem('access_token')
          setCurrentUser(null)
        }
      } catch (error) {
        console.error('Error loading user:', error)
        setCurrentUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [])

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, isLoading }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}