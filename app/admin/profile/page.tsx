"use client"

import { useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { usePathname } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { LayoutDashboard, Users, Briefcase, TrendingUp, Shield } from "lucide-react"

export default function AdminProfilePage() {
  const pathname = usePathname()
  const { toast } = useToast()
  const { user, refreshUser, updateUserLocal } = useAuth()

  const navigation = useMemo(() => ([
    { name: "Overview", href: "/admin", icon: LayoutDashboard },
    { name: "Users", href: "/admin/users", icon: Users },
    { name: "Jobs", href: "/admin/jobs", icon: Briefcase },
    { name: "Reports", href: "/admin/reports", icon: TrendingUp },
    { name: "Profile", href: "/admin/profile", icon: Shield },
  ].map((item) => ({ ...item, current: item.href === pathname }))), [pathname])

  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<'active'|'suspended'|'pending'>("active")

  const [currentPwd, setCurrentPwd] = useState("")
  const [newPwd, setNewPwd] = useState("")
  const [confirmPwd, setConfirmPwd] = useState("")

  useEffect(() => {
    (async () => {
      try {
        if (!user?.id) return
        setLoading(true)
        const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
        const res = await fetch(`/api/users/${user.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const data = await res.json()
        if (res.ok && data?.ok) {
          const u = data.user
          setName(String(u.name || ''))
          setEmail(String(u.email || ''))
          setStatus((u.status || 'active') as any)
        }
      } catch {} finally { setLoading(false) }
    })()
  }, [user?.id])

  const saveProfile = async () => {
    try {
      if (!user?.id) return toast({ description: 'Not signed in', variant: 'destructive' })
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        // Do not allow role changes from Profile page; roles managed in Admin → Users
        body: JSON.stringify({ name, email, status })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to save')
      toast({ description: 'Profile updated' })
      updateUserLocal({ name, email } as any)
      await refreshUser()
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to save', variant: 'destructive' })
    }
  }

  const changePassword = async () => {
    try {
      if (!currentPwd || !newPwd || !confirmPwd) return toast({ description: 'Fill out all password fields', variant: 'destructive' })
      if (newPwd !== confirmPwd) return toast({ description: 'New passwords do not match', variant: 'destructive' })
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to update password')
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      toast({ description: 'Password updated' })
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to update password', variant: 'destructive' })
    }
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout navigation={navigation}>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Profile</h1>
            <p className="text-muted-foreground mt-2">Manage your account basics and security.</p>
          </div>

          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Basic Info</CardTitle>
              <CardDescription>Update your name, email and status</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs">Full name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" disabled={loading} />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" disabled={loading} />
              </div>
              <div>
                <Label className="text-xs">Active</Label>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">Account status</span>
                  <Switch checked={status === 'active'} onCheckedChange={(v) => setStatus(v ? 'active' : 'suspended')} />
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={saveProfile} disabled={loading}>Save</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Change your password</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <Label className="text-xs">Current password</Label>
                <Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <Label className="text-xs">New password</Label>
                <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <Label className="text-xs">Confirm new password</Label>
                <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="md:col-span-3 flex justify-end gap-2">
                <Button variant="outline" onClick={changePassword}>Update Password</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
