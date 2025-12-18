"use client"

import type React from "react"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationsDropdown } from "@/components/notifications-dropdown"
import { Briefcase, LogOut, Settings, User, MessageSquare } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useEvents } from "@/hooks/use-events"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { useSseStatus } from "@/hooks/use-sse-status"

interface DashboardLayoutProps {
  children: React.ReactNode
  navigation: Array<{
    name: string
    href: string
    icon: React.ComponentType<{ className?: string }>
    current?: boolean
  }>
}

export function DashboardLayout({ children, navigation }: DashboardLayoutProps) {
  const { user, logout, refreshUser } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [unread, setUnread] = useState<number>(0)
  const prevUnreadRef = useRef<number>(0)
  const { connected } = useSseStatus()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (stored === 'light' || stored === 'dark') return stored
    return 'light'
  })

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  // Apply theme and persist
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark')
    }
    if (typeof window !== 'undefined') localStorage.setItem('theme', theme)
  }, [theme])

  // Sync theme across tabs/windows and when Settings changes it
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Poll notifications to surface real-time toasts

  useEffect(() => {
    let mounted = true
    let timer: any
    const load = async () => {
      try {
        const res = await fetch('/api/notifications', { cache: 'no-store' })
        const data = await res.json()
        if (mounted && res.ok && data?.ok) {
          const curr = Number(data.unread || 0)
          setUnread(curr)
          const prev = prevUnreadRef.current
          if (curr > prev) {
            toast({
              title: 'New notifications',
              description: `You have ${curr - prev} new notification${(curr - prev) > 1 ? 's' : ''}.`,
              action: (
                <ToastAction altText="View notifications" onClick={() => router.push('/notifications')}>
                  View
                </ToastAction>
              ),
            })
          }
          prevUnreadRef.current = curr
        }
      } catch {}
    }
    // initialize
    load()
    timer = setInterval(load, 30000)
    return () => { mounted = false; if (timer) clearInterval(timer) }
  }, [toast])

  // Live-sync presence in header: refresh current user on user.updated
  useEvents({
    events: ['user.updated'],
    onEvent: (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data || '{}')
        if (data?.type === 'user.updated') {
          const id = data?.payload?.id
          if (id && user?.id && id === user.id) {
            refreshUser().catch(() => {})
          }
        }
      } catch {}
    }
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Briefcase className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">JobPortal</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.name} href={item.href}>
                    <Button variant={item.current ? "secondary" : "ghost"} className="gap-2">
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </Button>
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Presence indicator only */}
            <div className="hidden md:flex items-center gap-2 mr-2 text-xs">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${((user as any)?.settings?.presence?.online ? 'border-green-600 text-green-700 dark:text-green-400' : 'border-muted-foreground/30 text-muted-foreground')}`}>
                <span className={`h-2 w-2 rounded-full ${((user as any)?.settings?.presence?.online ? 'bg-green-600' : 'bg-muted-foreground/40')}`}></span>
                {((user as any)?.settings?.presence?.online ? 'Online' : 'Offline')}
              </span>
            </div>
            {/* Messages quick access */}
            {user && (user.role === 'job_seeker' || user.role === 'employer') && (
              <Link href={user.role === 'employer' ? '/employer/messages' : '/dashboard/messages'}>
                <Button variant="ghost" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden md:inline">Messages</span>
                </Button>
              </Link>
            )}
            <NotificationsDropdown />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Avatar className="h-8 w-8 rounded-full overflow-hidden ring-1 ring-border">
                    <AvatarImage className="h-full w-full object-cover" src={user?.avatar || "/placeholder-user.jpg"} alt={user?.name} />
                    <AvatarFallback>{user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{user?.name}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(() => {
                  const profileHref = (user?.role === 'employer') ? '/employer/profile' : '/dashboard/profile'
                  return (
                <DropdownMenuItem asChild>
                  <Link href={profileHref}>
                    <span className="inline-flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </span>
                  </Link>
                </DropdownMenuItem>
                  )
                })()}
                <DropdownMenuItem asChild>
                  <Link href={(user?.role === 'employer') ? '/employer/settings' : (user?.role === 'admin' ? '/admin/settings' : '/dashboard/settings')}>
                    <span className="inline-flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden border-t border-border px-4 py-2 flex items-center gap-1 overflow-x-auto">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.name} href={item.href}>
                <Button variant={item.current ? "secondary" : "ghost"} size="sm" className="gap-2 whitespace-nowrap">
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            )
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
