"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LayoutDashboard, Users, Briefcase, TrendingUp, UserCheck, Building2 } from "lucide-react"
import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { useEffect, useState } from "react"
import { useEvents } from "@/hooks/use-events"

const navigation = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard, current: true },
  { name: "Users", href: "/admin/users", icon: Users, current: false },
  { name: "Jobs", href: "/admin/jobs", icon: Briefcase, current: false },
  { name: "Reports", href: "/admin/reports", icon: TrendingUp, current: false },
]

type StatTile = { name: string; value: string | number; icon: any; color: string }
type RecentUser = { id: string; name: string; email: string; role?: string; status?: string; joinedAt?: string }
type RecentJob = { id: string; title: string; company: string; status?: string; applications?: number; postedAt?: string }

// Utility: small time-ago formatter
function timeAgo(dateStr?: string | Date) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function AdminDashboard() {
  const pathname = usePathname()
  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  const [tiles, setTiles] = useState<StatTile[]>([
    { name: "Total Users", value: "—", icon: Users, color: "text-blue-600" },
    { name: "Active Jobs", value: "—", icon: Briefcase, color: "text-green-600" },
    { name: "Job Seekers", value: "—", icon: UserCheck, color: "text-purple-600" },
    { name: "Employers", value: "—", icon: Building2, color: "text-orange-600" },
  ])
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])
  const [listsLoading, setListsLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    const loadStats = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
        const res = await fetch('/api/admin/stats', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        const data = await res.json()
        if (res.ok && data?.ok && mounted) {
          const s = data.stats || {}
          setTiles([
            { name: 'Total Users', value: s.totalUsers ?? '—', icon: Users, color: 'text-blue-600' },
            { name: 'Active Jobs', value: s.activeJobs ?? '—', icon: Briefcase, color: 'text-green-600' },
            { name: 'Job Seekers', value: s.jobSeekers ?? '—', icon: UserCheck, color: 'text-purple-600' },
            { name: 'Employers', value: s.employers ?? '—', icon: Building2, color: 'text-orange-600' },
          ])
        }
      } catch {}
    }
    const loadLists = async () => {
      try {
        setListsLoading(true)
        // Recent users
        const [uRes, jRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/jobs?status=open'),
        ])
        const uData = await uRes.json().catch(() => ({}))
        const jData = await jRes.json().catch(() => ({}))
        if (mounted) {
          const usersArr: any[] = Array.isArray(uData.users) ? uData.users : []
          const jobsArr: any[] = Array.isArray(jData.jobs) ? jData.jobs : []
          setRecentUsers(usersArr.slice(0, 5).map((u: any) => ({
            id: String(u._id),
            name: u.name || u.email || 'User',
            email: u.email,
            role: u.role,
            status: 'Active',
            joinedAt: u.createdAt,
          })))
          setRecentJobs(jobsArr.slice(0, 5).map((j: any) => ({
            id: String(j._id),
            title: j.title,
            company: j.companyName || j.company || 'Company',
            status: j.status || 'open',
            applications: j.applicationsCount || j.applicantsCount || undefined,
            postedAt: j.createdAt,
          })))
        }
      } catch {
        if (mounted) {
          setRecentUsers([])
          setRecentJobs([])
        }
      } finally {
        if (mounted) setListsLoading(false)
      }
    }
    loadStats()
    loadLists()
    return () => { mounted = false }
  }, [])

  // Refresh tiles on realtime events
  useEvents({
    events: ['job.created','job.updated','job.deleted','application.created','application.deleted','application.status_changed','interview.created','user.created'],
    onEvent: () => {
      ;(async () => {
        try {
          // Refresh tiles
          const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
          const res = await fetch('/api/admin/stats', {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          })
          const data = await res.json()
          if (res.ok && data?.ok) {
            const s = data.stats || {}
            setTiles([
              { name: 'Total Users', value: s.totalUsers ?? '—', icon: Users, color: 'text-blue-600' },
              { name: 'Active Jobs', value: s.activeJobs ?? '—', icon: Briefcase, color: 'text-green-600' },
              { name: 'Job Seekers', value: s.jobSeekers ?? '—', icon: UserCheck, color: 'text-purple-600' },
              { name: 'Employers', value: s.employers ?? '—', icon: Building2, color: 'text-orange-600' },
            ])
          }
          // Refresh lists
          const [uRes, jRes] = await Promise.all([
            fetch('/api/users'),
            fetch('/api/jobs?status=open'),
          ])
          const uData = await uRes.json().catch(() => ({}))
          const jData = await jRes.json().catch(() => ({}))
          const usersArr: any[] = Array.isArray(uData.users) ? uData.users : []
          const jobsArr: any[] = Array.isArray(jData.jobs) ? jData.jobs : []
          setRecentUsers(usersArr.slice(0, 5).map((u: any) => ({
            id: String(u._id), name: u.name || u.email || 'User', email: u.email, role: u.role, status: 'Active', joinedAt: u.createdAt,
          })))
          setRecentJobs(jobsArr.slice(0, 5).map((j: any) => ({
            id: String(j._id), title: j.title, company: j.companyName || j.company || 'Company', status: j.status || 'open', applications: j.applicationsCount || j.applicantsCount || undefined, postedAt: j.createdAt,
          })))
        } catch {}
      })()
    }
  })

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-8">
          {/* Page Header */}
          <PageHeader title="Admin Dashboard" description="Monitor and manage your job portal platform" />

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {tiles.map((stat) => {
              const Icon = stat.icon
              return (
                <Card key={stat.name}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{stat.name}</CardTitle>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Recent Activity */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Users */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Users</CardTitle>
                <CardDescription>Latest user registrations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{user.role || 'User'}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            user.status === "Active"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          }`}
                        >
                          {user.joinedAt ? timeAgo(user.joinedAt) : user.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Jobs */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Job Posts</CardTitle>
                <CardDescription>Latest job postings requiring review</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentJobs.map((job) => (
                    <div key={job.id} className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{job.title}</p>
                        <p className="text-sm text-muted-foreground">{job.company}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                            (job.status || '').toLowerCase().includes('open') || (job.status || '').toLowerCase().includes('active')
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          }`}
                        >
                          {job.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{job.postedAt ? timeAgo(job.postedAt) : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
