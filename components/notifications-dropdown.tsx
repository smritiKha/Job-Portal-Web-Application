"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Bell, Briefcase, MessageSquare, Calendar, CheckCheck } from "lucide-react"
import { useEvents } from "@/hooks/use-events"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"

type NotificationItem = {
  id: string
  type: string
  title: string
  message: string
  createdAt?: string
  read: boolean
  icon?: string | null
}

export function NotificationsDropdown() {
  const { user } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const refreshTimer = useRef<number | null>(null)

  const typeToIcon = (t?: string) => {
    if (t === 'application') return Briefcase
    if (t === 'message') return MessageSquare
    if (t === 'interview') return Calendar
    return Bell
  }

  async function loadNotifications() {
    try {
      setLoading(true)
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const res = await fetch('/api/notifications', {
        cache: 'no-store',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
      })
      const data = await res.json()
      if (res.ok && data?.ok) {
        setNotifications(data.notifications || [])
        setUnreadCount(Number(data.unread || 0))
      } else if (res.status === 401) {
        setNotifications([])
        setUnreadCount(0)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // initial load
    loadNotifications().catch(() => {})
    // polling
    const id = setInterval(() => {
      loadNotifications().catch(() => {})
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  // SSE: refresh on relevant platform events
  useEvents({
    events: [
      'notification.created',
      'notification.updated',
      'interview.created',
      'interview.updated',
      'application.created',
      'application.updated',
      'application.status_changed',
      'message.created',
    ],
    onEvent: () => {
      // Debounce refresh to avoid spamming the API on bursts
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current)
      }
      // @ts-ignore - window.setTimeout typing
      refreshTimer.current = window.setTimeout(() => {
        loadNotifications().catch(() => {})
      }, 800)
    }
  })

  const markAllAsRead = () => {
    ;(async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
      })
      if (res.ok) {
        await loadNotifications()
      }
    })()
  }

  return (
    <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); if (v) loadNotifications().catch(() => {}) }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-0 text-xs">
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="p-3 text-xs text-muted-foreground">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">No notifications</div>
          ) : (
            notifications.map((n) => {
              const Icon = typeToIcon(n.type)
              return (
                <DropdownMenuItem key={n.id} className={`p-3 ${!n.read ? "bg-muted/50" : ""}`} onClick={async () => {
                  if (!n.read) {
                    setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))
                    setUnreadCount((c) => Math.max(0, c - 1))
                    const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
                    await fetch(`/api/notifications/${n.id}`, { method: 'PATCH', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
                  }
                  const anyN = n as any
                  if (anyN?.url) {
                    router.push(anyN.url as string)
                  } else if (n.type === 'message') {
                    const to = (user?.role === 'employer') ? '/employer/messages' : '/dashboard/messages'
                    router.push(to)
                  } else if (n.type === 'interview') {
                    router.push('/employer/interviews')
                  } else if (n.type === 'application') {
                    router.push('/dashboard/applications')
                  }
                  setOpen(false)
                }}>
                  <div className="flex gap-3 w-full">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm text-foreground">{n.title}</p>
                        {!n.read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                      {n.createdAt && <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>}
                    </div>
                  </div>
                </DropdownMenuItem>
              )
            })
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-center justify-center text-sm text-primary">
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
