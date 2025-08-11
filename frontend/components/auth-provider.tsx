'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface User {
  id: string
  name: string
  email: string
  role: 'GUEST' | 'HOST' | 'ADMIN'
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (name: string, email: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for stored auth token and validate
    const checkAuth = async () => {
      try {
        // Only access localStorage in the browser
        if (typeof window === 'undefined') {
          setLoading(false)
          return
        }

        const token = localStorage.getItem('token')
        if (token) {
          // Validate token with backend
          const response = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })
          if (response.ok) {
            const userData = await response.json()
            setUser(userData)
          } else {
            localStorage.removeItem('token')
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token')
        }
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        throw new Error('Login failed')
      }

      const { user, token } = await response.json()
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token)
      }
      setUser(user)
    } catch (error) {
      throw error
    }
  }

  const register = async (name: string, email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      })

      if (!response.ok) {
        throw new Error('Registration failed')
      }

      const { user, token } = await response.json()
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token)
      }
      setUser(user)
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
    }
    setUser(null)
  }

  const value = {
    user,
    loading,
    login,
    logout,
    register,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}