"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export type UserRole = "admin" | "employer" | "job_seeker"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string
  companyName?: string // For employers
  skills?: string[] // For job seekers
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string, remember?: boolean, role?: UserRole) => Promise<User>
  signup: (email: string, password: string, name: string, role: UserRole, additionalData?: any) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  updateUserLocal: (patch: Partial<User>) => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("job_portal_token")
    if (!token) {
      setIsLoading(false)
      return
    }
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok && data?.ok) {
          setUser(data.user)
        } else {
          // Token invalid
          localStorage.removeItem("job_portal_token")
        }
      } catch (e) {
        // network error: keep logged out
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  const login = async (email: string, password: string, remember?: boolean, role?: UserRole): Promise<User> => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember: !!remember }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Login failed")
      }
      localStorage.setItem("job_portal_token", data.token)
      setUser(data.user)
      return data.user as User
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (email: string, password: string, name: string, role: UserRole, additionalData?: any) => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, role, ...additionalData }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Signup failed")
      }
      if (data.pending) {
        // Do not set token or user; require admin approval
        throw new Error(data?.message || "Your account is pending admin approval.")
      }
      localStorage.setItem("job_portal_token", data.token)
      setUser(data.user)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("job_portal_token")
  }

  const refreshUser = async () => {
    const token = localStorage.getItem("job_portal_token")
    if (!token) return
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok && data?.ok) setUser(data.user)
    } catch {}
  }

  const updateUserLocal = (patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } as User : prev))
  }

  return <AuthContext.Provider value={{ user, login, signup, logout, refreshUser, updateUserLocal, isLoading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
