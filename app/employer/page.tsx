"use client"

import React from "react"
import { useAuth } from "@/lib/auth-context"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Briefcase, Users, Calendar, Plus, Eye, TrendingUp } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { useEvents } from "@/hooks/use-events"

const navigation = [
  { name: "Dashboard", href: "/employer", icon: LayoutDashboard, current: true },
  { name: "My Jobs", href: "/employer/jobs", icon: Briefcase, current: false },
  { name: "Applicants", href: "/employer/applicants", icon: Users, current: false },
  { name: "Interviews", href: "/employer/interviews", icon: Calendar, current: false },
]

type StatItem = { name: string; value: string | number; change?: string; icon: any; color: string }
type JobCard = { id: string; title: string; status: string; applicants: number; views?: number; postedAt?: string }
type ApplicantCard = { id: string; name: string; position?: string; appliedAt?: string; status: string; avatar?: string }

export default function EmployerDashboard() {
  const pathname = usePathname()
  const updatedNav = navigation.map((item) => ({ ...item, current: item.href === pathname }))
  const [stats, setStats] = React.useState<StatItem[]>([])
  const [jobs, setJobs] = React.useState<JobCard[]>([])
  const [recentApplicants, setRecentApplicants] = React.useState<ApplicantCard[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = React.useState<number>(0)
  const [viewsSeries, setViewsSeries] = React.useState<Array<{ date: string; total: number }>>([])

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        if (!user?.id) { setStats([]); setJobs([]); setRecentApplicants([]); return }
        const token = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
        // 1) Load employer's jobs (strictly by createdBy)
        const jobsRes = await fetch(`/api/jobs?createdBy=${encodeURIComponent(String(user.id))}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const jobsData = await jobsRes.json()
        const rawJobs = jobsRes.ok && jobsData?.ok ? (jobsData.jobs || []) : []
        const myJobs = rawJobs.filter((j: any) => String(j?.createdBy || '') === String(user.id))

        // 2) For each job, load applications (count + recent)
        let totalApplicants = 0
        const jobCards: JobCard[] = []
        const recentAppsAgg: ApplicantCard[] = []
        for (const j of myJobs) {
          const appsRes = await fetch(`/api/applications?jobId=${encodeURIComponent(String(j._id))}&limit=5`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
          const appsData = await appsRes.json().catch(() => ({}))
          const apps = appsRes.ok && appsData?.ok ? (appsData.applications || []) : []
          totalApplicants += apps.length
          // Query analytics for per-job views over last 30 days
          let jobViews = 0
          try {
            const vRes = await fetch(`/api/analytics/views?jobId=${encodeURIComponent(String(j._id))}&periodDays=30`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
            const vData = await vRes.json().catch(() => ({}))
            if (vRes.ok && vData?.ok) jobViews = Number(vData.total || 0)
          } catch {}
          jobCards.push({ id: String(j._id), title: j.title || 'Untitled Job', status: j.status || 'Active', applicants: apps.length, views: jobViews, postedAt: j.createdAt ? new Date(j.createdAt).toDateString() : undefined })
          for (const a of apps) {
            recentAppsAgg.push({ id: String(a._id), name: a.user?.name || 'Candidate', position: j.title, appliedAt: a.createdAt ? new Date(a.createdAt).toLocaleString() : undefined, status: a.status || 'new', avatar: a.user?.avatar })
          }
        }

        // 3) Interviews count for employer
        const intRes = await fetch('/api/interviews', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const intData = await intRes.json().catch(() => ({}))
        const interviews = intRes.ok && intData?.ok ? (intData.interviews || []) : []
        const scheduledCount = interviews.filter((x: any) => (x.status || 'scheduled') === 'scheduled').length

        // 4) Stats + profile views analytics
        const activeJobs = jobCards.filter(j => (j.status || '').toLowerCase() !== 'closed').length
        let viewsTotal: number | string = '—'
        let viewsChange = ''
        try {
          const viewsRes = await fetch('/api/analytics/views?mine=1&periodDays=30&series=1', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
          const viewsData = await viewsRes.json().catch(() => ({}))
          if (viewsRes.ok && viewsData?.ok) {
            viewsTotal = Number(viewsData.total || 0)
            viewsChange = String(viewsData.changeStr || '')
            setViewsSeries(Array.isArray(viewsData.series) ? viewsData.series : [])
          }
        } catch {}
        const s: StatItem[] = [
          { name: 'Active Jobs', value: activeJobs, change: '', icon: Briefcase, color: 'text-blue-600' },
          { name: 'Total Applicants', value: totalApplicants, change: '', icon: Users, color: 'text-green-600' },
          { name: 'Interviews Scheduled', value: scheduledCount, change: '', icon: Calendar, color: 'text-purple-600' },
          { name: 'Profile Views (30d)', value: viewsTotal, change: viewsChange, icon: Eye, color: 'text-orange-600' },
        ]

        if (!mounted) return
        setStats(s)
        // Sort jobs by createdAt desc (already roughly), slice top 4
        setJobs(jobCards.slice(0, 4))
        // Sort recent applicants by appliedAt desc and slice top 6
        setRecentApplicants(recentAppsAgg.sort((a, b) => (new Date(b.appliedAt || 0).getTime() - new Date(a.appliedAt || 0).getTime())).slice(0, 6))
      } catch {
        if (!mounted) return
        setStats([
          { name: 'Active Jobs', value: 0, icon: Briefcase, color: 'text-blue-600' },
          { name: 'Total Applicants', value: 0, icon: Users, color: 'text-green-600' },
          { name: 'Interviews Scheduled', value: 0, icon: Calendar, color: 'text-purple-600' },
          { name: 'Profile Views', value: '—', icon: Eye, color: 'text-orange-600' },
        ])
        setJobs([])
        setRecentApplicants([])
        setViewsSeries([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [pathname, user?.id, refreshKey])

  // Refresh on relevant events (views, applications, interviews)
  useEvents({
    events: ['analytics.view','application.created','application.updated','interview.created','interview.updated'],
    onEvent: () => {
      setRefreshKey((k) => k + 1)
    }
  })

  return (
    <ProtectedRoute allowedRoles={["employer"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-8">
          {/* Page Header */}
          <PageHeader
            title="Employer Dashboard"
            description="Manage your job postings and track applicants"
            actions={
              <Link href="/employer/jobs/new">
                <Button size="lg">
                  <Plus className="mr-2 h-5 w-5" />
                  Post New Job
                </Button>
              </Link>
            }
          />

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(stats.length ? stats : [
              { name: 'Active Jobs', value: loading ? '…' : 0, icon: Briefcase, color: 'text-blue-600' },
              { name: 'Total Applicants', value: loading ? '…' : 0, icon: Users, color: 'text-green-600' },
              { name: 'Interviews Scheduled', value: loading ? '…' : 0, icon: Calendar, color: 'text-purple-600' },
              { name: 'Profile Views', value: '—', icon: Eye, color: 'text-orange-600' },
            ] as StatItem[]).map((stat) => {
              const Icon = stat.icon
              return (
                <Card key={stat.name}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{stat.name}</CardTitle>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                    {stat.change ? <p className="text-xs text-muted-foreground mt-1">{stat.change}</p> : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Analytics Chart */}
          <Card id="analytics" className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Profile Views (Last 30 days)</CardTitle>
                  <CardDescription>Daily views of your jobs and profile</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 grid place-items-center text-sm text-muted-foreground">Loading chart…</div>
              ) : (viewsSeries.length === 0) ? (
                <div className="h-32 grid place-items-center text-sm text-muted-foreground">No views in the selected period.</div>
              ) : (
                <ChartContainer
                  id="employer-views"
                  className="w-full"
                  config={{ views: { label: 'Views', color: 'hsl(var(--primary))' } }}
                >
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={viewsSeries} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickMargin={8} minTickGap={24} />
                      <YAxis allowDecimals={false} width={36} />
                      <ChartTooltip content={<ChartTooltipContent nameKey="views" labelKey="date" />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line type="monotone" dataKey="total" name="views" stroke="var(--color-views)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Jobs */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Job Posts</CardTitle>
                    <CardDescription>Your latest job postings</CardDescription>
                  </div>
                  <Link href="/employer/jobs">
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(jobs.length ? jobs : []).map((job) => (
                    <div key={job.id} className="flex items-start justify-between p-4 rounded-lg border border-border">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{job.title}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {job.applicants} applicants
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            {job.views ?? 0} views
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{job.postedAt || ''}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                          job.status === "Active"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>
                  ))}
                  {(!loading && jobs.length === 0) && (
                    <div className="text-sm text-muted-foreground">No jobs yet. Post your first job.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Applicants */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Applicants</CardTitle>
                    <CardDescription>Latest applications received</CardDescription>
                  </div>
                  <Link href="/employer/applicants">
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(recentApplicants.length ? recentApplicants : []).map((applicant) => (
                    <div key={applicant.id} className="flex items-center gap-4">
                      <img
                        src={applicant.avatar || "/placeholder.svg"}
                        alt={applicant.name}
                        className="h-12 w-12 rounded-full bg-muted"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{applicant.name}</p>
                        <p className="text-sm text-muted-foreground">{applicant.position}</p>
                        <p className="text-xs text-muted-foreground">{applicant.appliedAt}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                          applicant.status === "New"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : applicant.status === "Interview"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                        }`}
                      >
                        {applicant.status}
                      </span>
                    </div>
                  ))}
                  {(!loading && recentApplicants.length === 0) && (
                    <div className="text-sm text-muted-foreground">No applicants yet. Your new applications will appear here.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <Link href="/employer/jobs/new">
                  <Button variant="outline" className="w-full justify-start h-auto py-4 bg-transparent">
                    <Plus className="mr-3 h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">Post a Job</div>
                      <div className="text-xs text-muted-foreground">Create new job posting</div>
                    </div>
                  </Button>
                </Link>
                <Link href="/employer/interviews">
                  <Button variant="outline" className="w-full justify-start h-auto py-4 bg-transparent">
                    <Calendar className="mr-3 h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">Schedule Interview</div>
                      <div className="text-xs text-muted-foreground">Set up candidate meetings</div>
                    </div>
                  </Button>
                </Link>
                <Button variant="outline" className="w-full justify-start h-auto py-4 bg-transparent" onClick={() => {
                  const el = document.getElementById('analytics')
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}>
                  <TrendingUp className="mr-3 h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">View Analytics</div>
                    <div className="text-xs text-muted-foreground">Track job performance</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
