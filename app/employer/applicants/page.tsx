"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LayoutDashboard, Briefcase, Users, Calendar, Search, Download, Mail, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useEvents } from "@/hooks/use-events"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const navigation = [
  { name: "Dashboard", href: "/employer", icon: LayoutDashboard, current: false },
  { name: "My Jobs", href: "/employer/jobs", icon: Briefcase, current: false },
  { name: "Applicants", href: "/employer/applicants", icon: Users, current: true },
  { name: "Interviews", href: "/employer/interviews", icon: Calendar, current: false },
]

type ApplicantItem = {
  _id: string
  name: string
  email: string
  position?: string
  appliedAt?: string
  status: string
  experience?: string
  skills: string[]
  avatar?: string
  resumeUrl?: string
  peerId?: string
}

export default function EmployerApplicantsPage() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [authToken, setAuthToken] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [items, setItems] = useState<ApplicantItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const [updatingId, setUpdatingId] = useState<string>("")
  // Offer modal state
  const [offerOpen, setOfferOpen] = useState(false)
  const [offerForId, setOfferForId] = useState<string>("")
  const [offerTitle, setOfferTitle] = useState<string>("")
  const [offerMessage, setOfferMessage] = useState<string>("")
  const [offerSalary, setOfferSalary] = useState<string>("")
  const [offerStartDate, setOfferStartDate] = useState<string>("")
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleForId, setScheduleForId] = useState<string>("")
  const [scheduleWhen, setScheduleWhen] = useState<string>("")
  const [scheduleMode, setScheduleMode] = useState<'Video' | 'In-Person'>('Video')
  const [scheduleLocation, setScheduleLocation] = useState<string>("")
  const [justUpdated, setJustUpdated] = useState<boolean>(false)
  // Details modal state
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailAppId, setDetailAppId] = useState<string>("")
  const [detailUserId, setDetailUserId] = useState<string>("")
  const [detailUser, setDetailUser] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState<boolean>(false)
  const [detailShowFull, setDetailShowFull] = useState<boolean>(false)

  function buildProfileSummary(u: any): string {
    const lines: string[] = []
    const name = String(u?.name || 'Candidate')
    const email = String(u?.email || '')
    const headline = String(u?.headline || '')
    const phone = String(u?.phone || '')
    const location = String(u?.location || '')
    const skills = Array.isArray(u?.skills) ? u.skills.join(', ') : ''
    lines.push(`Name: ${name}`)
    if (email) lines.push(`Email: ${email}`)
    if (phone) lines.push(`Phone: ${phone}`)
    if (location) lines.push(`Location: ${location}`)
    if (headline) lines.push(`Headline: ${headline}`)
    if (skills) lines.push(`Skills: ${skills}`)
    const sections: Array<{label: string; arr?: any[]}> = [
      { label: 'Experience', arr: Array.isArray(u?.experiences) ? u.experiences : [] },
      { label: 'Projects', arr: Array.isArray(u?.projects) ? u.projects : [] },
      { label: 'Education', arr: Array.isArray(u?.education) ? u.education : [] },
      { label: 'Certifications', arr: Array.isArray(u?.certifications) ? u.certifications : [] },
    ]
    for (const s of sections) {
      if (s.arr && s.arr.length) {
        lines.push(`\n${s.label}:`)
        for (const item of s.arr) {
          const title = item?.title || item?.name || item?.degree || ''
          const org = item?.company || item?.issuer || item?.school || ''
          const period = [item?.start, item?.end].filter(Boolean).join(' - ')
          const desc = item?.description || ''
          const link = item?.link || ''
          const row = [title, org, period].filter(Boolean).join(' | ')
          if (row) lines.push(`- ${row}`)
          if (desc) lines.push(`  ${desc}`)
          if (link) lines.push(`  ${link}`)
        }
      }
    }
    return lines.join('\n')
  }

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  const jobIdFilter = String(searchParams?.get('jobId') || '')
  const isJobFiltered = Boolean(jobIdFilter)

  // Open schedule modal from deep link
  useEffect(() => {
    const schedId = searchParams?.get('schedule') || ''
    const openFlag = searchParams?.get('scheduleOpen') || ''
    if (openFlag === '1' || openFlag === 'true') {
      setScheduleOpen(true)
    }
    if (schedId) {
      setScheduleForId(String(schedId))
      setScheduleOpen(true)
    }
  }, [searchParams])

  const filteredApplicants = items.filter((applicant) => {
    const name = (applicant?.name ?? '').toString()
    const position = (applicant?.position ?? '').toString()
    const aStatus = (applicant?.status ?? '').toString()
    const q = (searchQuery ?? '').toString().toLowerCase()
    const matchesSearch = name.toLowerCase().includes(q) || position.toLowerCase().includes(q)
    const statusNorm = (s: string) => (s === 'accepted' ? 'hired' : s)
    const matchesStatus = statusFilter === 'all' || statusNorm(aStatus) === statusFilter
    return matchesSearch && matchesStatus
  })

  // Load full user details for the selected applicant
  async function openDetails(appId: string) {
    try {
      const target = items.find(i => i._id === appId)
      if (!target?.peerId) { setDetailUser(null); setDetailUserId(""); setDetailOpen(true); return }
      setDetailLoading(true)
      setDetailAppId(appId)
      setDetailUserId(target.peerId)
      const t = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
      const res = await fetch(`/api/users/${encodeURIComponent(target.peerId)}`, { headers: t ? { Authorization: `Bearer ${t}` } : undefined })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) setDetailUser(data.user || null)
      else setDetailUser(null)
    } catch {
      setDetailUser(null)
    } finally {
      setDetailLoading(false)
      setDetailOpen(true)
      setDetailShowFull(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      reviewed: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
      shortlisted: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      interview: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      interview_completed: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
      rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      hired: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      accepted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    }
    const labelMap: Record<string, string> = {
      new: 'New',
      reviewed: 'Reviewed',
      shortlisted: 'Shortlisted',
      interview: 'Interview',
      interview_completed: 'Interview Completed',
      rejected: 'Rejected',
      hired: 'Hired',
      accepted: 'Hired',
    }
    const key = labelMap[status] ? status : 'reviewed'
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${colors[key]}`}>
        {labelMap[key]}
      </span>
    )
  }
  useEffect(() => {
    let mounted = true
    // Read token once for link usage; requests will re-read to avoid races
    if (typeof window !== 'undefined') {
      setAuthToken(localStorage.getItem('job_portal_token') || '')
    }
    const loadApplicants = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const t = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
        const jobsRes = await fetch(`/api/jobs?createdBy=${user.id}`, { headers: t ? { Authorization: `Bearer ${t}` } : undefined })
        const jobsData = await jobsRes.json()
        if (!jobsRes.ok || !jobsData?.ok) throw new Error(jobsData?.error || 'Failed to load jobs')
        let jobs: any[] = jobsData.jobs || []
        if (isJobFiltered) jobs = jobs.filter((j: any) => String(j._id) === jobIdFilter)
        const allApps: any[] = []
        for (const j of jobs) {
          const appsRes = await fetch(`/api/applications?jobId=${j._id}`, { headers: t ? { Authorization: `Bearer ${t}` } : undefined })
          const appsData = await appsRes.json()
          if (appsRes.ok && appsData?.ok) {
            for (const a of appsData.applications || []) {
              allApps.push({ ...a, jobTitle: j.title })
            }
          }
        }
        if (mounted) {
          const mapped: ApplicantItem[] = allApps.map((a: any) => ({
            _id: String(a._id),
            name: a.user?.name || a.candidateName || a.name || 'Candidate',
            email: a.user?.email || a.candidateEmail || a.email || '',
            position: a.jobTitle,
            appliedAt: a.createdAt ? new Date(a.createdAt).toDateString() : undefined,
            status: a.status || 'new',
            experience: a.experience,
            skills: a.skills || [],
            avatar: a.avatar,
            resumeUrl: a.resumeUrl,
            peerId: String(a.userId || a.user?._id || ''),
          }))
          setItems(mapped)
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Error loading applicants')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadApplicants()
    return () => { mounted = false }
  }, [user?.id, jobIdFilter])

  // Real-time: refresh applicants when applications/interviews change
  useEvents({
    events: ['application.created','application.updated','application.deleted','application.status_changed','interview.updated','interview.created'],
    onEvent: () => {
      ;(async () => {
        try {
          // Reuse the same loader as initial
          const t = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
          const qs = new URLSearchParams()
          if (jobIdFilter) qs.set('jobId', jobIdFilter)
          const res = await fetch(`/api/applications?${qs.toString()}`, { headers: t ? { Authorization: `Bearer ${t}` } : undefined })
          const data = await res.json().catch(() => ({}))
          if (res.ok && data?.ok) setItems(Array.isArray(data.applications) ? data.applications : [])
        } catch {}
      })()
    }
  })

  // Subscribe to application/interview events to refresh list
  useEvents({
    events: ['application.created', 'application.updated', 'application.deleted', 'application.status_changed', 'interview.created'],
    onEvent: () => {
      ;(async () => {
        try {
          if (!user?.id) return
          const t = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
          const jobsRes = await fetch(`/api/jobs?createdBy=${user.id}`, { headers: t ? { Authorization: `Bearer ${t}` } : undefined })
          const jobsData = await jobsRes.json()
          if (!jobsRes.ok || !jobsData?.ok) return
          let jobs: any[] = jobsData.jobs || []
          if (isJobFiltered) jobs = jobs.filter((j: any) => String(j._id) === jobIdFilter)
          const allApps: any[] = []
          for (const j of jobs) {
            const appsRes = await fetch(`/api/applications?jobId=${j._id}`, { headers: t ? { Authorization: `Bearer ${t}` } : undefined })
            const appsData = await appsRes.json()
            if (appsRes.ok && appsData?.ok) {
              for (const a of appsData.applications || []) {
                allApps.push({ ...a, jobTitle: j.title })
              }
            }
          }
          const mapped: ApplicantItem[] = allApps.map((a: any) => ({
            _id: String(a._id),
            name: a.user?.name || a.candidateName || a.name || 'Candidate',
            email: a.user?.email || a.candidateEmail || a.email || '',
            position: a.jobTitle,
            appliedAt: a.createdAt ? new Date(a.createdAt).toDateString() : undefined,
            status: a.status || 'new',
            experience: a.experience,
            skills: a.skills || [],
            avatar: a.avatar,
            resumeUrl: a.resumeUrl,
          }))
          setItems(mapped)
          setJustUpdated(true)
          setTimeout(() => setJustUpdated(false), 2500)
        } catch {}
      })()
    }
  })

  async function updateApplicationStatus(appId: string, next: string, reason?: string, extra?: Record<string, any>) {
    try {
      setUpdatingId(appId)
      const t = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
      const res = await fetch(`/api/applications/${encodeURIComponent(appId)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ status: next, ...(reason ? { reason } : {}), ...(extra || {}) })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to update application')
      setItems((prev) => prev.map((it) => it._id === appId ? { ...it, status: next, ...(extra || {}) } : it))
      toast({ description: `Application ${next}` })
    } catch (err: any) {
      toast({ description: err?.message || 'Update failed', variant: 'destructive' })
    } finally {
      setUpdatingId("")
    }
  }

  return (
    <ProtectedRoute allowedRoles={["employer"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-6">
          {justUpdated && (
            <div className="rounded-md border border-border bg-primary/5 text-foreground px-3 py-2 text-sm">
              Updated just now
            </div>
          )}
          {/* Page Header */}
          <PageHeader title="Applicants" description={isJobFiltered ? `Viewing applicants for job ${jobIdFilter}` : "Review and manage job applications"} />

          {/* Filters and Search */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>All Applicants</CardTitle>
              <CardDescription>View and manage candidate applications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search applicants..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="shortlisted">Shortlisted</SelectItem>
                    <SelectItem value="interview">Interview</SelectItem>
                    <SelectItem value="interview_completed">Interview Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="hired">Hired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Applicants List */}
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-lg border border-border">
                      <div className="flex items-start gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-32" />
                          <div className="flex gap-2">
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-5 w-20" />
                          </div>
                        </div>
                        <Skeleton className="h-6 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <EmptyState title="Error loading applicants" description={error || ''} />
              ) : filteredApplicants.length === 0 ? (
                <EmptyState title="No applicants found" description="Try changing the search or status filters." />
              ) : (
                <div className="space-y-4">
                  {filteredApplicants.map((applicant) => (
                    <div key={applicant._id} className="p-4 rounded-lg border border-border hover:shadow-sm transition-shadow">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={applicant.avatar || "/placeholder.svg"} alt={(applicant?.name || applicant?.email || 'User')} />
                          <AvatarFallback>{((applicant?.name || applicant?.email || 'U').toString().charAt(0) || 'U')}</AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div>
                              <h3 className="font-semibold text-foreground">{applicant.name}</h3>
                              <p className="text-sm text-muted-foreground">{applicant.email}</p>
                            </div>
                            {getStatusBadge(applicant.status)}
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              Applied for: <span className="font-medium text-foreground">{applicant.position}</span>
                            </p>
                            {applicant.experience && (
                              <p className="text-sm text-muted-foreground">Experience: {applicant.experience}</p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {Array.isArray(applicant.skills) && applicant.skills.map((skill: string) => (
                                <Badge key={skill} variant="secondary">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">Applied on {applicant.appliedAt}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mt-4">
                            {/* Resume buttons removed as requested */}
                            <Button size="sm" variant="outline" onClick={() => {
                              const email = (applicant as any)?.email
                              if (email && typeof window !== 'undefined') {
                                window.location.href = `mailto:${encodeURIComponent(String(email))}`
                                return
                              }
                              if (applicant.peerId) {
                                router.push(`/employer/messages?peerId=${encodeURIComponent(applicant.peerId)}`)
                              }
                            }}>
                              <Mail className="mr-2 h-4 w-4" />
                              Contact
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openDetails(applicant._id)}>
                              View Details
                            </Button>
                            {(() => {
                              const s = (applicant?.status || '').toString().toLowerCase()
                              const isHired = (s === 'hired' || s === 'accepted')
                              if (isHired) return null
                              return (
                                <Button size="sm" variant="secondary" onClick={() => { setOfferForId(applicant._id); setOfferTitle(""); setOfferMessage(""); setOfferSalary(""); setOfferStartDate(""); setOfferOpen(true) }}>Send Offer</Button>
                              )
                            })()}
                            {/* Actions: allow updates even if already rejected */}
                            {applicant.status === 'rejected' ? (
                              <>
                                <Button size="sm" variant="default" disabled={updatingId === applicant._id} onClick={() => updateApplicationStatus(applicant._id, 'reviewed')}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  {updatingId === applicant._id ? 'Updating…' : 'Mark Reviewed'}
                                </Button>
                                <Button size="sm" variant="outline" disabled={updatingId === applicant._id} onClick={() => updateApplicationStatus(applicant._id, 'shortlisted')}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  {updatingId === applicant._id ? 'Updating…' : 'Shortlist'}
                                </Button>
                                <Button size="sm" variant="secondary" disabled={updatingId === applicant._id} onClick={() => {
                                  const ok = typeof window !== 'undefined' ? window.confirm('Confirm hire this candidate?') : true
                                  if (!ok) return
                                  updateApplicationStatus(applicant._id, 'hired')
                                }}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  {updatingId === applicant._id ? 'Updating…' : 'Hire'}
                                </Button>
                              </>
                            ) : (
                              (() => {
                                const s = (applicant?.status || '').toString().toLowerCase()
                                const isHired = (s === 'hired' || s === 'accepted')
                                if (isHired) return null
                                return (
                                  <>
                                    <Button size="sm" variant="outline" disabled={updatingId === applicant._id} onClick={() => {
                                      setScheduleForId(applicant._id)
                                      setScheduleWhen("")
                                      setScheduleMode('Video')
                                      setScheduleLocation("")
                                      setScheduleOpen(true)
                                    }}>
                                      <Calendar className="mr-2 h-4 w-4" />
                                      {updatingId === applicant._id ? 'Scheduling…' : 'Schedule Interview'}
                                    </Button>
                                    <Button size="sm" variant="default" disabled={updatingId === applicant._id} onClick={() => updateApplicationStatus(applicant._id, 'shortlisted')}>
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      {updatingId === applicant._id ? 'Updating…' : 'Shortlist'}
                                    </Button>
                                    <Button size="sm" variant="secondary" disabled={updatingId === applicant._id} onClick={() => {
                                      const ok = typeof window !== 'undefined' ? window.confirm('Confirm hire this candidate?') : true
                                      if (!ok) return
                                      updateApplicationStatus(applicant._id, 'hired')
                                    }}>
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      {updatingId === applicant._id ? 'Updating…' : 'Hire'}
                                    </Button>
                                    <Button size="sm" variant="destructive" disabled={updatingId === applicant._id} onClick={() => {
                                      const reason = typeof window !== 'undefined' ? window.prompt('Optional: reason for rejection') || '' : ''
                                      updateApplicationStatus(applicant._id, 'rejected', reason)
                                    }}>
                                      <XCircle className="mr-2 h-4 w-4" />
                                      {updatingId === applicant._id ? 'Updating…' : 'Reject'}
                                    </Button>
                                  </>
                                )
                              })()
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {/* Schedule Interview Modal */}
          <AlertDialog open={scheduleOpen} onOpenChange={(v) => setScheduleOpen(Boolean(v))}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Schedule Interview</AlertDialogTitle>
                <AlertDialogDescription>
                  Choose a date/time and provide details for the interview.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3 py-2">
                {!scheduleForId && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Select Applicant</div>
                    <div className="grid gap-2">
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        onChange={(e) => setScheduleForId(e.target.value)}
                        defaultValue=""
                      >
                        <option value="" disabled>Choose an applicant…</option>
                        {items.map((it) => (
                          <option key={it._id} value={it._id}>{it.name} • {it.position || 'Application'}</option>
                        ))}
                      </select>
                      <div className="text-xs text-muted-foreground">Or click "Schedule Interview" on a specific applicant card.</div>
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium mb-1">Date & Time</div>
                  <Input type="datetime-local" value={scheduleWhen} onChange={(e) => setScheduleWhen(e.target.value)} />
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Mode</div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={scheduleMode === 'Video' ? 'default' : 'outline'} onClick={() => setScheduleMode('Video')}>Video</Button>
                    <Button type="button" size="sm" variant={scheduleMode === 'In-Person' ? 'default' : 'outline'} onClick={() => setScheduleMode('In-Person')}>In-Person</Button>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Location/Link</div>
                  <Input placeholder={scheduleMode === 'Video' ? 'Video meeting link' : 'Office address'} value={scheduleLocation} onChange={(e) => setScheduleLocation(e.target.value)} />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setScheduleOpen(false); router.push('/employer/interviews') }}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    if (!scheduleForId || !scheduleWhen) { toast({ description: 'Please select date/time', variant: 'destructive' }); return }
                    // Validate future date/time
                    const dt = new Date(scheduleWhen)
                    if (isNaN(dt.getTime()) || dt.getTime() < Date.now() + 2 * 60 * 1000) {
                      toast({ description: 'Please choose a future time (at least 2 minutes ahead).', variant: 'destructive' });
                      return
                    }
                    // Validate URL format if Video mode and a value is provided
                    if (scheduleMode === 'Video' && scheduleLocation && !/^https?:\/\//i.test(scheduleLocation)) {
                      toast({ description: 'Please provide a valid URL (starting with http:// or https://).', variant: 'destructive' });
                      return
                    }
                    try {
                      // First create the interview
                      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
                      const apiBody = {
                        applicationId: scheduleForId,
                        scheduledAt: scheduleWhen,
                        mode: (scheduleMode === 'Video' ? 'remote' : 'onsite'),
                        notes: scheduleLocation || ''
                      }
                      const ires = await fetch('/api/interviews', { 
                        method: 'POST', 
                        headers: { 
                          'Content-Type': 'application/json', 
                          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
                        }, 
                        body: JSON.stringify(apiBody) 
                      })
                      const idata = await ires.json().catch(() => ({}))
                      if (!ires.ok || idata?.ok === false) throw new Error(idata?.error || 'Failed to create interview')
                      
                      // Only update application status if interview was created successfully
                      const meta: Record<string, any> = { 
                        interviewDate: scheduleWhen, 
                        interviewMode: (scheduleMode === 'Video' ? 'remote' : 'onsite'), 
                        interviewLocation: scheduleLocation 
                      }
                      await updateApplicationStatus(scheduleForId, 'interview', undefined, meta)
                      toast({ description: 'Interview scheduled' })
                    } catch (e: any) {
                      toast({ description: e?.message || 'Failed to create interview', variant: 'destructive' })
                    }
                    try {
                      const target = items.find(i => i._id === scheduleForId)
                      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
                      if (target?.peerId) {
                        const whenStr = new Date(scheduleWhen).toLocaleString()
                        const content = `Interview scheduled: ${whenStr} | Mode: ${scheduleMode}${scheduleLocation ? ` | Details: ${scheduleLocation}` : ''}`
                        await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ recipientId: target.peerId, content }) })
                      }
                    } catch {}
                    setScheduleOpen(false)
                    router.push('/employer/interviews')
                  }}
                >
                  Schedule
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* Send Offer Modal */}
          <AlertDialog open={offerOpen} onOpenChange={(v) => setOfferOpen(Boolean(v))}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send Offer</AlertDialogTitle>
                <AlertDialogDescription>Compose an offer to send to this candidate.</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3 py-1">
                <div>
                  <div className="text-sm font-medium mb-1">Title</div>
                  <Input placeholder="Offer Title (e.g., Nurse - Full-time)" value={offerTitle} onChange={(e) => setOfferTitle(e.target.value)} />
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Message</div>
                  <Textarea rows={5} placeholder="Write a brief message with terms and next steps" value={offerMessage} onChange={(e) => setOfferMessage(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm font-medium mb-1">Salary / Compensation</div>
                    <Input placeholder="e.g., NPR 65,000/month" value={offerSalary} onChange={(e) => setOfferSalary(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Start Date</div>
                    <Input type="date" value={offerStartDate} onChange={(e) => setOfferStartDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setOfferOpen(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  try {
                    if (!offerForId) { toast({ description: 'No application selected', variant: 'destructive' }); return }
                    const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
                    const body = { applicationId: offerForId, title: offerTitle, message: offerMessage, salary: offerSalary, startDate: offerStartDate }
                    const res = await fetch('/api/offers', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Failed to send offer')
                    toast({ description: 'Offer sent' })
                    setOfferOpen(false)
                    // Refresh applicants list
                    try {
                      const t = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
                      const qs = new URLSearchParams()
                      if (jobIdFilter) qs.set('jobId', jobIdFilter)
                      const r = await fetch(`/api/applications?${qs.toString()}`, { headers: t ? { Authorization: `Bearer ${t}` } : undefined })
                      const d = await r.json().catch(() => ({}))
                      if (r.ok && d?.ok) setItems(Array.isArray(d.applications) ? d.applications : [])
                    } catch {}
                  } catch (e: any) {
                    toast({ description: e?.message || 'Failed to send offer', variant: 'destructive' })
                  }
                }}>Send</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* Applicant Details Modal */}
          <AlertDialog open={detailOpen} onOpenChange={(v) => setDetailOpen(Boolean(v))}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Applicant Details</AlertDialogTitle>
                <AlertDialogDescription>Profile summary and resume</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4">
                {detailLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-56" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-72" />
                  </div>
                ) : !detailUser ? (
                  <div className="text-sm text-muted-foreground">No additional details available.</div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={detailUser?.avatar || "/placeholder-user.jpg"} />
                        <AvatarFallback>{String(detailUser?.name || 'U').charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-foreground">{detailUser?.name || 'Candidate'}</div>
                        <div className="text-sm text-muted-foreground">{detailUser?.email || ''}</div>
                      </div>
                    </div>
                    {detailUser?.headline ? (
                      <div className="text-sm text-foreground">{detailUser.headline}</div>
                    ) : null}
                    {Array.isArray(detailUser?.skills) && detailUser.skills.length ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {detailUser.skills.slice(0, 10).map((s: string) => (
                          <Badge key={s} variant="secondary">{s}</Badge>
                        ))}
                      </div>
                    ) : null}
                    {/* Actions per requirement */}
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setDetailShowFull(true)}>View</Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          try {
                            const text = buildProfileSummary(detailUser)
                            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${(detailUser?.name || 'profile').toString().replace(/\s+/g,'_').toLowerCase()}-summary.txt`
                            document.body.appendChild(a)
                            a.click()
                            a.remove()
                            URL.revokeObjectURL(url)
                          } catch {}
                        }}>Download</Button>
                      </div>
                      {/* Keep resume links as secondary */}
                      <div className="text-xs text-muted-foreground">
                        Resume: {detailUser?.documents?.resume?.url ? (
                          <>
                            <Link className="underline" href={`/api/files/proxy?path=${encodeURIComponent(String(detailUser.documents.resume.url))}${authToken ? `&token=${encodeURIComponent(authToken)}` : ''}`} target="_blank">View file</Link>
                            {' '}•{' '}
                            <Link className="underline" href={`/api/files/proxy?path=${encodeURIComponent(String(detailUser.documents.resume.url))}&download=1${authToken ? `&token=${encodeURIComponent(authToken)}` : ''}`}>Download file</Link>
                          </>
                        ) : 'No resume uploaded.'}
                      </div>
                    </div>

                    {/* Full profile view */}
                    {detailShowFull && (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        {detailUser?.headline && (<div><span className="font-medium">Headline:</span> {detailUser.headline}</div>)}
                        {detailUser?.phone && (<div><span className="font-medium">Phone:</span> {detailUser.phone}</div>)}
                        {detailUser?.location && (<div><span className="font-medium">Location:</span> {detailUser.location}</div>)}
                        {Array.isArray(detailUser?.skills) && detailUser.skills.length ? (
                          <div>
                            <div className="font-medium">Skills</div>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {detailUser.skills.map((s: string) => (<Badge key={s} variant="secondary">{s}</Badge>))}
                            </div>
                          </div>
                        ) : null}
                        {Array.isArray(detailUser?.experiences) && detailUser.experiences.length ? (
                          <div className="space-y-1">
                            <div className="font-medium">Experience</div>
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {detailUser.experiences.map((e: any, i: number) => (
                                <li key={i}>{[e?.title, e?.company, [e?.start, e?.end].filter(Boolean).join(' - ')].filter(Boolean).join(' | ')}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {Array.isArray(detailUser?.projects) && detailUser.projects.length ? (
                          <div className="space-y-1">
                            <div className="font-medium">Projects</div>
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {detailUser.projects.map((p: any, i: number) => (
                                <li key={i}>{[p?.name, p?.role, [p?.start, p?.end].filter(Boolean).join(' - ')].filter(Boolean).join(' | ')}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {Array.isArray(detailUser?.education) && detailUser.education.length ? (
                          <div className="space-y-1">
                            <div className="font-medium">Education</div>
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {detailUser.education.map((ed: any, i: number) => (
                                <li key={i}>{[ed?.degree, ed?.school, [ed?.start, ed?.end].filter(Boolean).join(' - ')].filter(Boolean).join(' | ')}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {Array.isArray(detailUser?.certifications) && detailUser.certifications.length ? (
                          <div className="space-y-1">
                            <div className="font-medium">Certifications</div>
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {detailUser.certifications.map((c: any, i: number) => (
                                <li key={i}>{[c?.name, c?.issuer, c?.date].filter(Boolean).join(' | ')}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
                <AlertDialogAction onClick={() => setDetailOpen(false)}>OK</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
