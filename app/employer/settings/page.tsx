"use client"

import { useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { LayoutDashboard, Briefcase, Users, Calendar } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

const navigationBase = [
  { name: "Dashboard", href: "/employer", icon: LayoutDashboard },
  { name: "My Jobs", href: "/employer/jobs", icon: Briefcase },
  { name: "Applicants", href: "/employer/applicants", icon: Users },
  { name: "Interviews", href: "/employer/interviews", icon: Calendar },
]

export default function EmployerSettingsPage() {
  const pathname = usePathname()
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()

  const navigation = useMemo(() => navigationBase.map(i => ({ ...i, current: i.href === pathname })), [pathname])

  type ThemeChoice = 'light' | 'dark'
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = (localStorage.getItem('theme') as ThemeChoice | null)
    return stored === 'dark' ? 'dark' : 'light'
  })
  const [online, setOnline] = useState<boolean>(true)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!user?.id) return
        const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
        const res = await fetch(`/api/users/${user.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const data = await res.json().catch(() => ({}))
        if (mounted && res.ok && data?.ok && data.user) {
          const p = data.user?.settings?.presence || {}
          setOnline(Boolean(p.online ?? true))
        }
      } catch {}
    })()
    return () => { mounted = false }
  }, [user?.id])

  const onChangeTheme = (value: ThemeChoice) => {
    setTheme(value)
    if (typeof window !== 'undefined') localStorage.setItem('theme', value)
    toast({ description: `Theme set to ${value}` })
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
    <ProtectedRoute allowedRoles={["employer"]}>
      <DashboardLayout navigation={navigation}>
        <div className="space-y-6">
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Choose your preferred theme for the dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={theme} onValueChange={(v) => onChangeTheme(v as ThemeChoice)} className="grid gap-3 md:grid-cols-2">
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

          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Active Status</CardTitle>
              <CardDescription>Control whether job seekers see you as online</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">Show as Online</div>
                  <div className="text-sm text-muted-foreground">When on, your presence is visible in messages</div>
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
