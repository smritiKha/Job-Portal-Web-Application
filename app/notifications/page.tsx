"use client"

import { useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { usePathname } from "next/navigation"
import { Bell, Briefcase, MessageSquare, Calendar } from "lucide-react"

 type NotificationItem = {
  id: string
  type: string
  title: string
  message: string
  createdAt?: string
  read: boolean
 }

const nav = [
  { name: "Dashboard", href: "/dashboard", icon: undefined as any, current: false },
  { name: "Find Jobs", href: "/dashboard/jobs", icon: undefined as any, current: false },
  { name: "Applications", href: "/dashboard/applications", icon: undefined as any, current: false },
  { name: "Profile", href: "/dashboard/profile", icon: undefined as any, current: false },
]

export default function NotificationsPage() {
  const pathname = usePathname()
  const navigation = useMemo(() => nav.map(n => ({ ...n, current: n.href === pathname })), [pathname])

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [filter, setFilter] = useState<'all'|'unread'|'application'|'message'|'interview'>('all')

  const typeToIcon = (t?: string) => {
    if (t === 'application') return Briefcase
    if (t === 'message') return MessageSquare
    if (t === 'interview') return Calendar
    return Bell
  }

  async function load() {
    try {
      setLoading(true)
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data?.ok) {
        setItems(data.notifications || [])
        setUnread(Number(data.unread || 0))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'unread') return items.filter(i => !i.read)
    return items.filter(i => i.type === filter)
  }, [items, filter])

  async function markAllRead() {
    const r = await fetch('/api/notifications', { method: 'PATCH' })
    if (r.ok) await load()
  }

  async function markOne(id: string) {
    const idx = items.findIndex(i => i.id === id)
    if (idx >= 0 && !items[idx].read) {
      setItems(prev => prev.map(x => x.id === id ? { ...x, read: true } : x))
      setUnread(u => Math.max(0, u - 1))
      await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    }
  }

  return (
    <ProtectedRoute allowedRoles={["job_seeker","admin","employer"]}>
      <DashboardLayout navigation={navigation}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Manage your in-app notifications</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={unread > 0 ? 'destructive' : 'outline'}>{unread} unread</Badge>
                  <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                    <SelectTrigger className="w-[170px]"><SelectValue placeholder="Filter" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="unread">Unread</SelectItem>
                      <SelectItem value="application">Application</SelectItem>
                      <SelectItem value="message">Message</SelectItem>
                      <SelectItem value="interview">Interview</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unread === 0}>Mark all read</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground">No notifications to display.</div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((n) => {
                    const Icon = typeToIcon(n.type)
                    return (
                      <div key={n.id} className={`p-3 rounded-lg border ${!n.read ? 'bg-muted/40' : ''}`}>
                        <div className="flex gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-sm text-foreground truncate">{n.title}</div>
                              <div className="text-xs text-muted-foreground whitespace-nowrap">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">{n.message}</div>
                            {!n.read && (
                              <div className="pt-2">
                                <Button size="sm" variant="outline" onClick={() => markOne(n.id)}>Mark as read</Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
