"use client"

import { useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
// No page header for settings
import { Home, Search, Briefcase, FileText, Bookmark, Settings as SettingsIcon, BookOpen } from "lucide-react"
import { usePathname } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
// Settings simplified to Appearance only
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/lib/auth-context"

export default function SettingsPage() {
  const pathname = usePathname()
  const { toast } = useToast()
  const { user, refreshUser, updateUserLocal } = useAuth()

  const navigation = useMemo(() => ([
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Find Jobs", href: "/dashboard/jobs", icon: Search },
    { name: "Applications", href: "/dashboard/applications", icon: Briefcase },
    { name: "Training", href: "/dashboard/training", icon: BookOpen },
    { name: "Profile", href: "/dashboard/profile", icon: FileText },
    { name: "Saved Jobs", href: "/dashboard/saved", icon: Bookmark },
  ].map((item) => ({ ...item, current: item.href === pathname }))), [pathname])

  type ThemeChoice = 'light' | 'dark'
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = (localStorage.getItem('theme') as ThemeChoice | null)
    if (stored === 'light' || stored === 'dark') return stored
    return 'light'
  })

  // (no other settings; appearance only)
  // Account basics
  const [name, setName] = useState<string>("")
  const [email, setEmail] = useState<string>("")
  const [loadingUser, setLoadingUser] = useState<boolean>(false)
  const [accountEditing, setAccountEditing] = useState<boolean>(false)

  // Notifications
  const [notifJobAlerts, setNotifJobAlerts] = useState<boolean>(true)
  const [notifApplicationUpdates, setNotifApplicationUpdates] = useState<boolean>(true)
  const [notifProductNews, setNotifProductNews] = useState<boolean>(false)
  const [notificationsEditing, setNotificationsEditing] = useState<boolean>(false)

  // Presence
  const [online, setOnline] = useState<boolean>(true)

  const applyTheme = (choice: ThemeChoice) => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    if (choice === 'dark') root.classList.add('dark'); else root.classList.remove('dark')
  }

  useEffect(() => {
    applyTheme(theme)
  }, [])

  const onChangeTheme = (value: ThemeChoice) => {
    setTheme(value)
    if (typeof window !== 'undefined') localStorage.setItem('theme', value)
    applyTheme(value)
    toast({ description: `Theme set to ${value}` })
  }

  // Load user profile
  useEffect(() => {
    ;(async () => {
      try {
        if (!user?.id) return
        setLoadingUser(true)
        const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
        const res = await fetch(`/api/users/${user.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const data = await res.json()
        if (res.ok && data?.ok && data.user) {
          const u = data.user
          setName(String(u.name || ''))
          setEmail(String(u.email || ''))
          const n = u.settings?.notifications || {}
          setNotifJobAlerts(Boolean(n.jobAlerts ?? true))
          setNotifApplicationUpdates(Boolean(n.applicationUpdates ?? true))
          setNotifProductNews(Boolean(n.productNews ?? false))
          const p = u.settings?.presence || {}
          setOnline(Boolean(p.online ?? true))
        }
      } catch {}
      finally { setLoadingUser(false) }
    })()
  }, [user?.id])

  const saveAccount = async () => {
    try {
      if (!user?.id) return toast({ description: 'Not signed in', variant: 'destructive' })
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name, email })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to save')
      toast({ description: 'Account updated' })
      // Sync auth user across the app immediately
      updateUserLocal({ name, email } as any)
      await refreshUser()
      setAccountEditing(false)
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to save', variant: 'destructive' })
    }
  }

  const saveNotifications = async () => {
    try {
      if (!user?.id) return toast({ description: 'Not signed in', variant: 'destructive' })
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ settings: { notifications: { jobAlerts: notifJobAlerts, applicationUpdates: notifApplicationUpdates, productNews: notifProductNews } } })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to save')
      toast({ description: 'Notification preferences updated' })
      // Sync user cache
      await refreshUser()
      setNotificationsEditing(false)
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to save', variant: 'destructive' })
    }
  }

  const savePresence = async () => {
    try {
      if (!user?.id) return toast({ description: 'Not signed in', variant: 'destructive' })
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ settings: { presence: { online } } })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to update status')
      toast({ description: 'Status updated' })
      await refreshUser()
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to update status', variant: 'destructive' })
    }
  }

  return (
    <ProtectedRoute allowedRoles={["job_seeker"]}>
      <DashboardLayout navigation={navigation}>
        <div className="space-y-6">

          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Choose your preferred theme for the dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={theme}
                onValueChange={(v) => onChangeTheme(v as ThemeChoice)}
                className="grid gap-3 md:grid-cols-2"
              >
                <div className="flex items-center space-x-2 rounded-lg border p-3">
                  <RadioGroupItem value="light" id="theme-light" />
                  <Label htmlFor="theme-light" className="cursor-pointer">☀️ Light</Label>
                </div>
                <div className="flex items-center space-x-2 rounded-lg border p-3">
                  <RadioGroupItem value="dark" id="theme-dark" />
                  <Label htmlFor="theme-dark" className="cursor-pointer">🌙 Dark</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Account (hidden as requested) */}
          {false && (
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Update your basic account information</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {!accountEditing ? (
                <>
                  <div>
                    <div className="text-xs text-muted-foreground">Full name</div>
                    <div className="font-medium">{name || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Email</div>
                    <div className="font-medium">{email || '—'}</div>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button variant="outline" onClick={() => setAccountEditing(true)}>Edit Info</Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-xs">Full name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" disabled={loadingUser} />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" disabled={loadingUser} />
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setAccountEditing(false)}>Cancel</Button>
                    <Button onClick={saveAccount} disabled={loadingUser}>Save</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          )}

          {/* Notifications (hidden as requested) */}
          {false && (
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Choose what updates you want to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">Job alerts</div>
                  <div className="text-sm text-muted-foreground">New job matches and recommendations</div>
                </div>
                <Switch checked={notifJobAlerts} onCheckedChange={setNotifJobAlerts} disabled={!notificationsEditing} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">Application updates</div>
                  <div className="text-sm text-muted-foreground">Status changes and employer messages</div>
                </div>
                <Switch checked={notifApplicationUpdates} onCheckedChange={setNotifApplicationUpdates} disabled={!notificationsEditing} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">Product news</div>
                  <div className="text-sm text-muted-foreground">Tips, feature announcements, and news</div>
                </div>
                <Switch checked={notifProductNews} onCheckedChange={setNotifProductNews} disabled={!notificationsEditing} />
              </div>
              <div className="flex justify-end gap-2">
                {!notificationsEditing ? (
                  <Button variant="outline" onClick={() => setNotificationsEditing(true)}>Edit Preferences</Button>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setNotificationsEditing(false)}>Cancel</Button>
                    <Button onClick={saveNotifications}>Save</Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Active Status */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Active Status</CardTitle>
              <CardDescription>Control whether employers see you as online</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">Show as Online</div>
                  <div className="text-sm text-muted-foreground">When on, your presence is visible to employers</div>
                </div>
                <Switch checked={online} onCheckedChange={setOnline} />
              </div>
              <div className="flex justify-end">
                <Button onClick={savePresence}>Save Status</Button>
              </div>
            </CardContent>
          </Card>
      </div>
    </DashboardLayout>
  </ProtectedRoute>
)
}
