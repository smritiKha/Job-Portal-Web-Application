"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LayoutDashboard, Users, Briefcase, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useEvents } from "@/hooks/use-events"

const navigation = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard, current: false },
  { name: "Users", href: "/admin/users", icon: Users, current: false },
  { name: "Jobs", href: "/admin/jobs", icon: Briefcase, current: false },
  { name: "Reports", href: "/admin/reports", icon: TrendingUp, current: true },
  { name: "Audit Logs", href: "/admin/audit", icon: TrendingUp, current: false },
]

type MetricCard = { name: string; value: number; changePct: number }
type TopJob = { jobId: string; title: string; company: string; applications: number }
type StatusRow = { status: string; count: number }

export default function AdminReportsPage() {
  const pathname = usePathname()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [range, setRange] = useState<7 | 30 | 90>(30)
  const [metrics, setMetrics] = useState<MetricCard[]>([])
  const [topJobs, setTopJobs] = useState<TopJob[]>([])
  const [appsByStatus, setAppsByStatus] = useState<StatusRow[]>([])
  const [appsDaily, setAppsDaily] = useState<Array<{ date: string; count: number }>>([])
  const [companyFilter, setCompanyFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("")

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined
        const params = new URLSearchParams()
        params.set('range', String(range))
        if (companyFilter) params.set('company', companyFilter)
        if (statusFilter) params.set('status', statusFilter)
        const res = await fetch(`/api/admin/reports?${params.toString()}`, { headers })
        const data = await res.json()
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load reports')
        if (mounted) {
          const m = data.metrics || {}
          setMetrics([
            { name: 'Total Jobs', value: m.totalJobs?.current ?? 0, changePct: m.totalJobs?.changePct ?? 0 },
            { name: 'Total Applications', value: m.totalApplications?.current ?? 0, changePct: m.totalApplications?.changePct ?? 0 },
            { name: 'Active Jobs', value: m.activeJobs?.current ?? 0, changePct: m.activeJobs?.changePct ?? 0 },
            { name: 'Pending Review', value: m.pendingJobs?.current ?? 0, changePct: m.pendingJobs?.changePct ?? 0 },
          ])
          setTopJobs(Array.isArray(data.topJobsByApplications) ? data.topJobsByApplications : [])
          setAppsByStatus(Array.isArray(data.applicationsByStatus) ? data.applicationsByStatus : [])
          setAppsDaily(Array.isArray(data.applicationsDaily) ? data.applicationsDaily : [])
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Error loading reports')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [range, companyFilter, statusFilter])

  // Live refresh on platform events
  useEvents({
    events: ['job.created','job.updated','job.deleted','application.created','application.updated','application.deleted','application.status_changed','user.created'],
    onEvent: () => {
      ;(async () => {
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
          const headers = token ? { Authorization: `Bearer ${token}` } : undefined
          const params = new URLSearchParams()
          params.set('range', String(range))
          if (companyFilter) params.set('company', companyFilter)
          if (statusFilter) params.set('status', statusFilter)
          const res = await fetch(`/api/admin/reports?${params.toString()}`, { headers })
          const data = await res.json()
          if (res.ok && data?.ok) {
            const m = data.metrics || {}
            setMetrics([
              { name: 'Total Jobs', value: m.totalJobs?.current ?? 0, changePct: m.totalJobs?.changePct ?? 0 },
              { name: 'Total Applications', value: m.totalApplications?.current ?? 0, changePct: m.totalApplications?.changePct ?? 0 },
              { name: 'Active Jobs', value: m.activeJobs?.current ?? 0, changePct: m.activeJobs?.changePct ?? 0 },
              { name: 'Pending Review', value: m.pendingJobs?.current ?? 0, changePct: m.pendingJobs?.changePct ?? 0 },
            ])
            setTopJobs(Array.isArray(data.topJobsByApplications) ? data.topJobsByApplications : [])
            setAppsByStatus(Array.isArray(data.applicationsByStatus) ? data.applicationsByStatus : [])
            setAppsDaily(Array.isArray(data.applicationsDaily) ? data.applicationsDaily : [])
          }
        } catch {}
      })()
    }
  })

  const computed = useMemo(() => {
    const statusTotal = appsByStatus.reduce((s, r) => s + (r.count || 0), 0) || 1
    const statusWithPct = appsByStatus.map((r) => ({ ...r, pct: Math.round((r.count / statusTotal) * 100) }))
    // Prepare simple SVG line points for appsDaily
    const maxCount = Math.max(1, ...appsDaily.map(d => d.count))
    const width = 600
    const height = 160
    const padding = 24
    const innerW = width - padding * 2
    const innerH = height - padding * 2
    const n = Math.max(1, appsDaily.length)
    const points = appsDaily.map((d, i) => {
      const x = padding + (innerW * i) / (n - 1 || 1)
      const y = padding + innerH - (innerH * d.count) / maxCount
      return `${x},${y}`
    }).join(' ')
    return { statusWithPct, chart: { width, height, padding, points, maxCount } }
  }, [appsByStatus, appsDaily])

  function exportCsv() {
    const rows: string[][] = []
    rows.push(['Metric','Value','ChangePct'])
    for (const m of metrics) rows.push([m.name, String(m.value), String(m.changePct)])
    rows.push([])
    rows.push(['Top Jobs by Applications'])
    rows.push(['Title','Company','Applications','JobId'])
    for (const j of topJobs) rows.push([j.title, j.company, String(j.applications), j.jobId])
    rows.push([])
    rows.push(['Applications by Status'])
    rows.push(['Status','Count'])
    for (const s of appsByStatus) rows.push([s.status || 'unknown', String(s.count)])
    rows.push([])
    rows.push(['Applications Daily'])
    rows.push(['Date','Count'])
    for (const d of appsDaily) rows.push([d.date, String(d.count)])
    const csv = rows.map(r => r.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reports-${range}d${companyFilter ? '-' + companyFilter : ''}${statusFilter ? '-' + statusFilter : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-8">
          {/* Page Header */}
          <PageHeader
            title="Analytics & Reports"
            description="Track platform performance and key metrics"
            actions={
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    setIndexing(true)
                    const res = await fetch('/api/admin/setup-indexes', { method: 'POST' })
                    const data = await res.json()
                    if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to create indexes')
                    toast({ title: 'Indexes created', description: 'Database indexes have been initialized.' })
                  } catch (e: any) {
                    toast({ title: 'Indexing failed', description: e?.message || 'Error creating indexes', variant: 'destructive' })
                  } finally {
                    setIndexing(false)
                  }
                }}
                disabled={indexing}
              >
                {indexing ? 'Initializing…' : 'Initialize Indexes'}
              </Button>
            }
          />

          {/* Range Filters */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant={range === 7 ? 'default' : 'outline'} onClick={() => setRange(7)}>Last 7 days</Button>
            <Button size="sm" variant={range === 30 ? 'default' : 'outline'} onClick={() => setRange(30)}>Last 30 days</Button>
            <Button size="sm" variant={range === 90 ? 'default' : 'outline'} onClick={() => setRange(90)}>Last 90 days</Button>
            <input
              className="border rounded-md px-2 py-1 text-sm bg-background ml-2"
              placeholder="Filter by company..."
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            />
            <select
              className="border rounded-md px-2 py-1 text-sm bg-background"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="submitted">Submitted</option>
              <option value="reviewed">Reviewed</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="interview">Interview</option>
              <option value="rejected">Rejected</option>
              <option value="hired">Hired</option>
            </select>
            <Button size="sm" variant="outline" onClick={exportCsv}>Export CSV</Button>
          </div>

          {/* Key Metrics */}
          {loading ? (
            <div className="py-8 text-center"><p>Loading...</p></div>
          ) : error ? (
            <div className="py-8"><Card><CardContent className="py-8 text-center">{error}</CardContent></Card></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric) => (
                <Card key={metric.name} className="hover:shadow-sm transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{metric.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{metric.value}</div>
                    <div className="flex items-center gap-1 mt-1">
                      {metric.changePct >= 0 ? (
                        <ArrowUpRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-600" />
                      )}
                      <span className={`text-xs font-medium ${metric.changePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {metric.changePct >= 0 ? `+${metric.changePct}%` : `${metric.changePct}%`}
                      </span>
                      <span className="text-xs text-muted-foreground">vs last period</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Detailed Reports */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Applications Trend (Daily) */}
            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <CardTitle>Applications Trend</CardTitle>
                <CardDescription>Daily applications in the selected range</CardDescription>
              </CardHeader>
              <CardContent>
                {appsDaily.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No data</div>
                ) : (
                  <div className="overflow-x-auto">
                    <svg width={computed.chart.width} height={computed.chart.height} className="rounded-md border bg-muted/30">
                      <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth="2" points={computed.chart.points} />
                    </svg>
                    <div className="text-xs text-muted-foreground mt-1">Max: {computed.chart.maxCount}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Jobs by Applications */}
            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <CardTitle>Top Jobs by Applications</CardTitle>
                <CardDescription>Most applied-to postings in the selected range</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topJobs.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No data</div>
                  ) : topJobs.map((j, idx) => (
                    <div key={`${j.jobId}-${idx}`} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="font-medium text-foreground truncate">{j.title}</div>
                        <div className="text-muted-foreground ml-4">{j.applications} applications</div>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{j.company}</div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, Math.max(5, (j.applications / (topJobs[0]?.applications || 1)) * 100))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Applications by Status */}
            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <CardTitle>Applications by Status</CardTitle>
                <CardDescription>Distribution of applications in the selected range</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {computed.statusWithPct.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No data</div>
                  ) : computed.statusWithPct.map((s, idx) => (
                    <div key={`${s.status || 'unknown'}-${idx}`} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{s.status || 'unknown'}</span>
                        <span className="text-muted-foreground">{s.count} ({s.pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${s.pct}%` }} />
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
