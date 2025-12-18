"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Home,
  Search,
  Briefcase,
  FileText,
  Bookmark,
  MapPin,
  DollarSign,
  Clock,
  TrendingUp,
  BookOpen,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import Link from "next/link"
import { calculateSkillsMatch } from "@/lib/ai-matching"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home, current: true },
  { name: "Find Jobs", href: "/dashboard/jobs", icon: Search, current: false },
  { name: "Applications", href: "/dashboard/applications", icon: Briefcase, current: false },
  { name: "Training", href: "/dashboard/training", icon: BookOpen, current: false },
  { name: "Saved Jobs", href: "/dashboard/saved", icon: Bookmark, current: false },
]

type Stat = { name: string; value: string | number; change?: string; icon: any; color: string }

type RecJob = { _id: string; title: string; company?: string; location?: string; salary?: string; type?: string; postedAt?: string; match: number }
type RecentApp = { id: string; title: string; company?: string; appliedAt?: string; status: string }

// removed demo recent applications; will load real data below

export default function JobSeekerDashboard() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [recJobs, setRecJobs] = useState<RecJob[]>([])
  const [recentApps, setRecentApps] = useState<RecentApp[]>([])
  const [stats, setStats] = useState<Stat[]>([
    { name: "Applications Sent", value: "—", change: "", icon: Briefcase, color: "text-blue-600" },
    { name: "Profile Views", value: "—", change: "", icon: TrendingUp, color: "text-green-600" },
    { name: "Saved Jobs", value: "—", change: "", icon: Bookmark, color: "text-purple-600" },
    { name: "Interviews", value: "—", change: "", icon: Clock, color: "text-orange-600" },
  ])
  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  // Profile strength state
  const [profileData, setProfileData] = useState<any | null>(null)
  const { profileStrength, remainingLabels } = useMemo(() => {
    const u = profileData || {}
    const email = String(u.email || '')
    const title = String(u.title || '')
    const dreamJob = String((u as any).dreamJob || '')
    const bio = String(u.bio || '')
    const skills: string[] = Array.isArray(u.skills) ? u.skills : []
    const resumeUrl = u?.documents?.resume?.url ? String(u.documents.resume.url) : ''
    const experiences: any[] = Array.isArray(u.experiences) ? u.experiences : []
    const education: any[] = Array.isArray(u.education) ? u.education : []
    const essentials: Array<{ label: string; ok: boolean }> = [
      { label: 'Email', ok: !!email },
      { label: 'Headline', ok: !!title || !!dreamJob },
      { label: 'Bio', ok: !!bio },
      { label: 'Skills (3+)', ok: (skills.filter(Boolean).length >= 3) },
      { label: 'Resume', ok: !!resumeUrl },
      { label: 'Experience or Education', ok: (experiences.length > 0 || education.length > 0) },
    ]
    const completed = essentials.filter(e => e.ok).length
    const total = essentials.length
    const pct = Math.min(100, Math.max(0, Math.round((completed / total) * 100)))
    const remaining = essentials.filter(e => !e.ok).map(e => e.label)
    return { profileStrength: pct, remainingLabels: remaining }
  }, [profileData])

  // Load dynamic stats for the current user
  useEffect(() => {
    let cancelled = false
    const computeDelta = (items: any[], dateField: string) => {
      const now = Date.now()
      const DAY = 24 * 60 * 60 * 1000
      const last7 = items.filter((x) => {
        const t = x?.[dateField] ? new Date(x[dateField]).getTime() : 0
        return t >= (now - 7 * DAY)
      }).length
      const prev7 = items.filter((x) => {
        const t = x?.[dateField] ? new Date(x[dateField]).getTime() : 0
        return t < (now - 7 * DAY) && t >= (now - 14 * DAY)
      }).length
      const diff = last7 - prev7
      const sign = diff >= 0 ? "+" : ""
      return { count: items.length, change: `${sign}${diff} this week` }
    }

    ;(async () => {
      if (!user?.id) return
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
        // Load user profile for strength computation
        try {
          const profRes = await fetch(`/api/users/${user.id}`)
          const profJson = await profRes.json().catch(() => ({} as any))
          if (!cancelled && profRes.ok && profJson?.ok && profJson.user) setProfileData(profJson.user)
        } catch {}
        // Applications (for stats and recent list)
        const appsRes = await fetch(`/api/applications?userId=${user.id}`)
        const appsJson = await appsRes.json().catch(() => ({}))
        const apps = (appsRes.ok && appsJson?.ok) ? (appsJson.applications || []) : []
        const appsDelta = computeDelta(apps, 'createdAt')
        // Prepare recent applications (latest 3)
        const toRecent: RecentApp[] = (apps as any[])
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, 3)
          .map((a) => ({
            id: String(a._id),
            title: String(a.title || a.jobTitle || 'Applied Job'),
            company: String(a.company || a.companyName || ''),
            appliedAt: a.createdAt ? new Date(a.createdAt).toDateString() : '',
            status: String(a.status || 'under_review'),
          }))

        // Saved Jobs
        const savedRes = await fetch('/api/saved', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const savedJson = await savedRes.json().catch(() => ({}))
        const saved = (savedRes.ok && savedJson?.ok) ? (savedJson.saved || []) : []
        const savedDelta = computeDelta(saved, 'createdAt')

        // Interviews
        const ivRes = await fetch('/api/interviews', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const ivJson = await ivRes.json().catch(() => ({}))
        const ivs = (ivRes.ok && ivJson?.ok) ? (ivJson.interviews || []) : []
        const ivDelta = computeDelta(ivs, 'createdAt')

        if (!cancelled) {
          setStats([
            { name: 'Applications Sent', value: apps.length, change: appsDelta.change, icon: Briefcase, color: 'text-blue-600' },
            { name: 'Profile Views', value: '—', change: '', icon: TrendingUp, color: 'text-green-600' },
            { name: 'Saved Jobs', value: saved.length, change: savedDelta.change, icon: Bookmark, color: 'text-purple-600' },
            { name: 'Interviews', value: ivs.length, change: ivDelta.change, icon: Clock, color: 'text-orange-600' },
          ])
          setRecentApps(toRecent)
        }
      } catch {
        // leave defaults
      }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  // Load Recommended Jobs based on user's profile skills
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Fetch jobs
        const jobsRes = await fetch('/api/jobs')
        const jobsJson = await jobsRes.json().catch(() => ({} as any))
        const jobs: any[] = (jobsRes.ok && jobsJson?.ok) ? (jobsJson.jobs || []) : []
        if (!jobs.length) { if (!cancelled) setRecJobs([]); return }

        // Fetch full user profile to get skills
        let userSkills: string[] = []
        try {
          if (!user?.id) throw new Error('no user')
          const profRes = await fetch(`/api/users/${user.id}`)
          const profJson = await profRes.json().catch(() => ({} as any))
          if (profRes.ok && profJson?.ok && profJson.user) {
            if (Array.isArray(profJson.user.skills)) userSkills = profJson.user.skills
          }
        } catch {}

        const userProfile: any = {
          skills: Array.isArray(userSkills) ? userSkills : [],
          experience: 0,
          location: '',
          expectedSalary: 0,
        }

        // Compute match for each job
        const scored = jobs.map((j: any) => {
          const jobForMatch = {
            id: String(j._id),
            requiredSkills: Array.isArray(j.skills) ? j.skills : [],
            requiredExperience: 0,
            location: String(j.location || 'Remote'),
            salary: { min: Number(j.salaryMin || 0), max: Number(j.salaryMax || 0) },
          }
          const match = calculateSkillsMatch(
            userProfile?.skills || [],
            jobForMatch.requiredSkills || []
          )
          const companyRaw: any = j.companyName || j.company || 'Unknown Company'
          const company = typeof companyRaw === 'object' ? (companyRaw?.name || 'Unknown Company') : String(companyRaw)
          const salary = (typeof j.salaryMin === 'number' && typeof j.salaryMax === 'number') ? `$${j.salaryMin} - $${j.salaryMax}` : undefined
          const rec: RecJob = {
            _id: String(j._id),
            title: String(j.title || 'Job'),
            company,
            location: String(j.location || ''),
            salary,
            type: String(j.type || 'Full-time'),
            postedAt: j.createdAt ? new Date(j.createdAt).toDateString() : undefined,
            match: match.matchScore,
          }
          return rec
        })
        // Sort by match desc and take top 3
        scored.sort((a, b) => b.match - a.match)
        if (!cancelled) setRecJobs(scored.slice(0, 3))
      } catch {
        if (!cancelled) setRecJobs([])
      }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      under_review: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      interview: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      accepted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    }
    const labels: Record<string, string> = {
      under_review: "Under Review",
      interview: "Interview",
      rejected: "Rejected",
      accepted: "Accepted",
    }
    return <span className={`text-xs px-2 py-1 rounded-full ${colors[status]}`}>{labels[status]}</span>
  }

  return (
    <ProtectedRoute allowedRoles={["job_seeker"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Welcome Back!</h1>
            <p className="text-muted-foreground mt-2">Track your job search progress and discover new opportunities</p>
          </div>

          {/* AI Insights Banner removed */}

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat: Stat) => {
              const Icon = stat.icon
              return (
                <Card key={stat.name}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{stat.name}</CardTitle>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                    {stat.change ? (
                      <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recommended Jobs - Takes 2 columns */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recommended Jobs</CardTitle>
                      <CardDescription>Matches based on your profile</CardDescription>
                    </div>
                    <Link href="/dashboard/jobs">
                      <Button variant="ghost" size="sm">View All</Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recJobs.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No recommendations yet. Update your skills to get better matches.</div>
                    ) : (
                      recJobs.map((job: RecJob) => (
                        <div key={job._id} className="p-4 rounded-lg border border-border">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-foreground">{job.title}</h3>
                                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{job.match}% Match</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{job.company}</p>
                            </div>
                            <Badge variant="outline">{job.type}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.location}</span>
                            <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" />{job.salary}</span>
                            <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{job.postedAt}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            {/* Recent Applications - Right column */}
            <div>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recent Applications</CardTitle>
                      <CardDescription>Latest applications received</CardDescription>
                    </div>
                    <Link href="/dashboard/applications">
                      <Button variant="ghost" size="sm">
                        View All
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentApps.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No recent applications.</div>
                    ) : recentApps.map((app, idx) => (
                      <div key={app.id} className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">{app.title}</p>
                            <p className="text-xs text-muted-foreground">{app.company}</p>
                          </div>
                          {getStatusBadge(app.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">Applied {app.appliedAt}</p>
                        {idx !== recentApps.length - 1 && (
                          <div className="border-b border-border pt-2" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
