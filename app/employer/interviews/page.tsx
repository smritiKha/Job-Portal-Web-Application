"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LayoutDashboard, Briefcase, Users, Calendar, Plus, Video, MapPin, Clock } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useEffect, useRef, useState } from "react"
import { useEvents } from "@/hooks/use-events"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const navigation = [
  { name: "Dashboard", href: "/employer", icon: LayoutDashboard, current: false },
  { name: "My Jobs", href: "/employer/jobs", icon: Briefcase, current: false },
  { name: "Applicants", href: "/employer/applicants", icon: Users, current: false },
  { name: "Interviews", href: "/employer/interviews", icon: Calendar, current: true },
]

type InterviewItem = {
  _id: string
  candidate: string
  position?: string
  date?: string
  time?: string
  type: string
  status: "scheduled" | "completed" | string
  avatar?: string
  location?: string
  rawMode?: 'onsite' | 'remote'
  rawNotes?: string
  rawScheduledAt?: string
  company?: string
  jobTitle?: string
}

export default function EmployerInterviewsPage() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const [upcomingInterviews, setUpcoming] = useState<InterviewItem[]>([])
  const [pastInterviews, setPast] = useState<InterviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const [updatingId, setUpdatingId] = useState<string>("")
  const refreshTimer = useRef<number | null>(null)
  const [rsOpen, setRsOpen] = useState(false)
  const [rsId, setRsId] = useState<string>("")
  const [rsWhen, setRsWhen] = useState<string>("")
  const [rsMode, setRsMode] = useState<'Video' | 'In-Person'>("Video")
  const [rsLocation, setRsLocation] = useState<string>("")
  // Create schedule modal state
  const [csOpen, setCsOpen] = useState(false)
  const [csAppId, setCsAppId] = useState<string>("")
  const [csWhen, setCsWhen] = useState<string>("")
  const [csMode, setCsMode] = useState<'Video' | 'In-Person'>("Video")
  const [csLocation, setCsLocation] = useState<string>("")
  const [csOptions, setCsOptions] = useState<Array<{ id: string; label: string }>>([])
  const [csLoading, setCsLoading] = useState<boolean>(false)

  // Notes / Feedback modal state
  const [nfOpen, setNfOpen] = useState(false)
  const [nfId, setNfId] = useState<string>("")
  const [nfText, setNfText] = useState<string>("")
  const [nfMode, setNfMode] = useState<'view' | 'feedback'>('view')

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  const getStatusBadge = (i: InterviewItem) => {
    const label = i.status === 'completed' ? 'Completed' : 'Scheduled'
    const variant = label === 'Completed' ? 'secondary' : 'outline'
    return <Badge variant={variant}>{label}</Badge>
  }

  // Load employer applications for picker when scheduling modal opens
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!csOpen || !user?.id) return
      try {
        setCsLoading(true)
        const token = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
        // 1) Load jobs created by this employer
        const jobsRes = await fetch(`/api/jobs?createdBy=${encodeURIComponent(String(user.id))}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const jobsData = await jobsRes.json().catch(() => ({}))
        if (!jobsRes.ok || jobsData?.ok === false) throw new Error(jobsData?.error || 'Failed to load jobs')
        const jobs: any[] = Array.isArray(jobsData.jobs) ? jobsData.jobs : []
        // 2) For each job, fetch applications
        const options: Array<{ id: string; label: string }> = []
        for (const j of jobs) {
          const appsRes = await fetch(`/api/applications?jobId=${encodeURIComponent(String(j._id))}&limit=50`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
          const appsData = await appsRes.json().catch(() => ({}))
          if (appsRes.ok && appsData?.ok) {
            for (const a of (appsData.applications || [])) {
              const name = a.user?.name || a.candidateName || a.name || 'Candidate'
              const label = `${name} • ${j.title || 'Job'} (${String(a._id).slice(0,6)}…)`
              options.push({ id: String(a._id), label })
            }
          }
        }
        if (mounted) setCsOptions(options)
      } catch {
        if (mounted) setCsOptions([])
      } finally {
        if (mounted) setCsLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [csOpen, user?.id])

  async function fetchInterviews() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
    const res = await fetch('/api/interviews', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
    // Robust JSON parsing to handle empty bodies (avoids Unexpected end of JSON input)
    const txt = await res.text().catch(() => '')
    const data = txt ? JSON.parse(txt) : { ok: true, interviews: [] }
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load interviews')
    const items: InterviewItem[] = (data.interviews || []).map((raw: any) => {
      const dt = raw.scheduledAt ? new Date(raw.scheduledAt) : null
      const date = dt ? dt.toLocaleDateString() : undefined
      const time = dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
      return {
        _id: String(raw._id),
        candidate: raw.candidate || 'Candidate',
        position: raw.position || raw.jobTitle,
        date,
        time,
        type: raw.mode === 'onsite' ? 'In-Person' : 'Video Call',
        status: raw.status || 'scheduled',
        avatar: raw.avatar,
        location: raw.location || raw.notes,
        rawMode: raw.mode,
        rawNotes: raw.notes,
        rawScheduledAt: raw.scheduledAt,
        company: raw.company || raw.companyName,
        jobTitle: raw.jobTitle,
      }
    })
    const now = Date.now()
    const upcoming: InterviewItem[] = []
    const past: InterviewItem[] = []
    for (const i of items) {
      if (i.status === 'completed') {
        past.push(i)
        continue
      }
      const ts = i.rawScheduledAt ? new Date(i.rawScheduledAt).getTime() : undefined
      if (typeof ts === 'number' && ts < now) {
        // If scheduled but time is past, treat as past until rescheduled
        past.push(i)
      } else {
        upcoming.push(i)
      }
    }
    setUpcoming(upcoming)
    setPast(past)
  }

  async function markCompleted(id: string) {
    try {
      setUpdatingId(id)
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const res = await fetch(`/api/interviews/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ status: 'completed' }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Failed to update interview')
      await fetchInterviews()
      toast({ description: 'Interview marked as completed' })
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to update interview', variant: 'destructive' })
    } finally {
      setUpdatingId("")
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        await fetchInterviews()
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Error loading interviews')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Refresh interviews on SSE events with debounce
  useEvents({
    events: ['interview.created','interview.updated'],
    onEvent: () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current)
      }
      // @ts-ignore
      refreshTimer.current = window.setTimeout(async () => {
        try {
          await fetchInterviews()
        } catch {}
      }, 800)
    }
  })

  // Subscribe to relevant events and refetch
  useEvents({
    events: ['interview.created','application.status_changed','application.updated'],
    onEvent: () => {
      ;(async () => {
        try {
          await fetchInterviews()
          toast({ description: 'Interviews updated' })
        } catch {}
      })()
    }
  })

  return (
    <ProtectedRoute allowedRoles={["employer"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-6">
          {/* Page Header */}
          <PageHeader
            title="Interviews"
            description="Manage and schedule candidate interviews"
            actions={
              <Button size="lg" onClick={() => router.push('/employer/applicants?scheduleOpen=1')}>
                <Plus className="mr-2 h-5 w-5" />
                Schedule Interview
              </Button>
            }
          />

          {/* Upcoming Interviews */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Upcoming Interviews</CardTitle>
              <CardDescription>Scheduled interviews with candidates</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-lg border border-border">
                      <div className="flex items-start gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-32" />
                          <div className="flex gap-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-28" />
                          </div>
                        </div>
                        <Skeleton className="h-6 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <EmptyState title="Error loading interviews" description={error} />
              ) : upcomingInterviews.length === 0 ? (
                <EmptyState title="No upcoming interviews" description="Schedule one to see it here." />
              ) : (
                <div className="space-y-4">
                  {upcomingInterviews.map((interview) => (
                    <div key={interview._id} className="p-4 rounded-lg border border-border hover:shadow-sm transition-shadow">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={interview.avatar || "/placeholder.svg"} alt={interview.candidate} />
                          <AvatarFallback>{interview.candidate.charAt(0)}</AvatarFallback>
                        </Avatar>

                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div>
                              <h3 className="font-semibold text-foreground">{interview.candidate}</h3>
                              <p className="text-sm text-muted-foreground">{interview.jobTitle || interview.position}{interview.company ? ` • ${interview.company}` : ''}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{interview.type}</Badge>
                              {getStatusBadge(interview)}
                            </div>
                          </div>

                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              <span>{interview.date}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>{interview.time}</span>
                            </div>
                            {interview.location && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span>{interview.location}</span>
                              </div>
                            )}

          {/* Create Interview Modal */}
          {csOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-lg bg-background border border-border p-4 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Schedule Interview</h3>
                  <p className="text-sm text-muted-foreground">Enter application ID, date/time and details.</p>
                </div>
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <div className="text-sm font-medium">Select Applicant (optional)</div>
                    <Select onValueChange={(v) => setCsAppId(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={csLoading ? 'Loading…' : (csOptions.length ? 'Choose applicant' : 'No applicants found')} />
                      </SelectTrigger>
                      <SelectContent>
                        {csOptions.map(opt => (
                          <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">Or paste an application ID manually:</div>
                    <Input placeholder="e.g. 671234abcd..." value={csAppId} onChange={(e) => setCsAppId(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Date & Time</div>
                    <Input type="datetime-local" value={csWhen} onChange={(e) => setCsWhen(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Mode</div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant={csMode === 'Video' ? 'default' : 'outline'} onClick={() => setCsMode('Video')}>Video</Button>
                      <Button type="button" size="sm" variant={csMode === 'In-Person' ? 'default' : 'outline'} onClick={() => setCsMode('In-Person')}>In-Person</Button>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Location/Link</div>
                    <Input placeholder={csMode === 'Video' ? 'Video meeting link' : 'Office address'} value={csLocation} onChange={(e) => setCsLocation(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setCsOpen(false)}>Cancel</Button>
                  <Button onClick={async () => {
                    if (!csAppId) { toast({ description: 'Please provide application ID', variant: 'destructive' }); return }
                    if (!csWhen) { toast({ description: 'Please select date/time', variant: 'destructive' }); return }
                    const dt = new Date(csWhen)
                    if (isNaN(dt.getTime()) || dt.getTime() < Date.now() + 2 * 60 * 1000) { toast({ description: 'Please choose a future time (at least 2 minutes ahead).', variant: 'destructive' }); return }
                    if (csMode === 'Video' && csLocation && !/^https?:\/\//i.test(csLocation)) { toast({ description: 'Please provide a valid URL (starting with http:// or https://).', variant: 'destructive' }); return }
                    try {
                      setUpdatingId('creating')
                      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
                      // 1) Update application status and metadata
                      const meta: Record<string, any> = { interviewDate: csWhen, interviewMode: (csMode === 'Video' ? 'remote' : 'onsite'), interviewLocation: csLocation }
                      const aRes = await fetch(`/api/applications/${encodeURIComponent(csAppId)}`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ status: 'interview', ...meta })
                      })
                      const aData = await aRes.json().catch(() => ({}))
                      if (!aRes.ok || aData?.ok === false) throw new Error(aData?.error || 'Failed to update application')
                      // 2) Create interview
                      const body: any = { applicationId: csAppId, scheduledAt: csWhen, mode: (csMode === 'In-Person' ? 'onsite' : 'remote'), notes: csLocation }
                      const iRes = await fetch('/api/interviews', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
                      const iData = await iRes.json().catch(() => ({}))
                      if (!iRes.ok || iData?.ok === false) throw new Error(iData?.error || 'Failed to create interview')
                      // Refresh
                      const r = await fetch('/api/interviews')
                      const d = await r.json()
                      if (r.ok && d?.ok) {
                        const items: InterviewItem[] = (d.interviews || []).map((raw: any) => {
                          const dt2 = raw.scheduledAt ? new Date(raw.scheduledAt) : null
                          const date = dt2 ? dt2.toLocaleDateString() : undefined
                          const time = dt2 ? dt2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
                          return {
                            _id: String(raw._id),
                            candidate: raw.candidate || 'Candidate',
                            position: raw.position,
                            date,
                            time,
                            type: raw.mode === 'onsite' ? 'In-Person' : 'Video Call',
                            status: raw.status || 'scheduled',
                            avatar: raw.avatar,
                            location: raw.location || raw.notes,
                            rawMode: raw.mode,
                            rawNotes: raw.notes,
                          }
                        })
                        setUpcoming(items.filter((i) => i.status === 'scheduled'))
                        setPast(items.filter((i) => i.status === 'completed'))
                      }
                      toast({ description: 'Interview scheduled' })
                      setCsOpen(false)
                      setCsAppId("")
                    } catch (e: any) {
                      toast({ description: e?.message || 'Failed to schedule', variant: 'destructive' })
                    } finally {
                      setUpdatingId("")
                    }
                  }} disabled={!!updatingId}>
                    {updatingId ? 'Scheduling…' : 'Schedule'}
                  </Button>
                </div>
              </div>
            </div>
          )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {interview.type === "Video Call" && (
                              (() => {
                                const isUrl = typeof interview.location === 'string' && /^https?:\/\//i.test(interview.location)
                                return isUrl ? (
                                  <Button size="sm" onClick={() => window.open(interview.location!, '_blank') }>
                                    <Video className="mr-2 h-4 w-4" />
                                    Join Call
                                  </Button>
                                ) : (
                                  <Button size="sm" disabled title="No meeting link provided">
                                    <Video className="mr-2 h-4 w-4" />
                                    Join Call
                                  </Button>
                                )
                              })()
                            )}
                            <Button size="sm" variant="outline" onClick={() => {
                              setRsId(interview._id)
                              // Default to UTC ISO string converted to local datetime-local format if we had full timestamp
                              setRsWhen("")
                              setRsMode(interview.type === 'In-Person' ? 'In-Person' : 'Video')
                              setRsLocation(interview.location || '')
                              setRsOpen(true)
                            }}>
                              Reschedule
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => markCompleted(interview._id)} disabled={updatingId === interview._id}>
                              {updatingId === interview._id ? 'Marking…' : 'Mark Completed'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Past Interviews */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Past Interviews</CardTitle>
              <CardDescription>Completed interviews</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-lg border border-border">
                      <div className="flex items-start gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <div className="flex gap-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-16" />
                          </div>
                        </div>
                        <Skeleton className="h-6 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <EmptyState title="Error loading interviews" description={error} />
              ) : pastInterviews.length === 0 ? (
                <EmptyState title="No past interviews" description="Completed interviews will appear here." />
              ) : (
                <div className="space-y-4">
                  {pastInterviews.map((interview) => (
                    <div key={interview._id} className="p-4 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={interview.avatar || "/placeholder.svg"} alt={interview.candidate} />
                          <AvatarFallback>{interview.candidate.charAt(0)}</AvatarFallback>
                        </Avatar>

                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div>
                              <h3 className="font-semibold text-foreground">{interview.candidate}</h3>
                              <p className="text-sm text-muted-foreground">{interview.jobTitle || interview.position}{interview.company ? ` • ${interview.company}` : ''}</p>
                            </div>
                            <Badge variant="secondary">Completed</Badge>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                            <span>{interview.date}</span>
                            <span>•</span>
                            <span>{interview.time}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setNfId(interview._id); setNfMode('view'); setNfText(interview.rawNotes || ''); setNfOpen(true) }}>
                              View Notes
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setNfId(interview._id); setNfMode('feedback'); setNfText(''); setNfOpen(true) }}>
                              Add Feedback
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reschedule Interview Modal */}
          {/* Inline modal using simple overlay to avoid importing additional components */}
          {rsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-lg bg-background border border-border p-4 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Reschedule Interview</h3>
                  <p className="text-sm text-muted-foreground">Update date/time and details.</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium mb-1">Date & Time</div>
                    <Input type="datetime-local" value={rsWhen} onChange={(e) => setRsWhen(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Mode</div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant={rsMode === 'Video' ? 'default' : 'outline'} onClick={() => setRsMode('Video')}>Video</Button>
                      <Button type="button" size="sm" variant={rsMode === 'In-Person' ? 'default' : 'outline'} onClick={() => setRsMode('In-Person')}>In-Person</Button>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Location/Link</div>
                    <Input placeholder={rsMode === 'Video' ? 'Video meeting link' : 'Office address'} value={rsLocation} onChange={(e) => setRsLocation(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setRsOpen(false)}>Cancel</Button>
                  <Button onClick={async () => {
                    if (!rsId || !rsWhen) { toast({ description: 'Please select date/time', variant: 'destructive' }); return }
                    const dt = new Date(rsWhen)
                    if (isNaN(dt.getTime()) || dt.getTime() < Date.now() + 2 * 60 * 1000) { toast({ description: 'Please choose a future time (at least 2 minutes ahead).', variant: 'destructive' }); return }
                    if (rsMode === 'Video' && rsLocation && !/^https?:\/\//i.test(rsLocation)) { toast({ description: 'Please provide a valid URL (starting with http:// or https://).', variant: 'destructive' }); return }
                    try {
                      setUpdatingId(rsId)
                      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
                      const body: any = { scheduledAt: rsWhen, mode: (rsMode === 'In-Person' ? 'onsite' : 'remote'), notes: rsLocation }
                      const res = await fetch(`/api/interviews/${encodeURIComponent(rsId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
                      const data = await res.json().catch(() => ({}))
                      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to reschedule')
                      // Refresh interviews
                      const r = await fetch('/api/interviews')
                      const d = await r.json()
                      if (r.ok && d?.ok) {
                        const items: InterviewItem[] = (d.interviews || []).map((raw: any) => {
                          const dt2 = raw.scheduledAt ? new Date(raw.scheduledAt) : null
                          const date = dt2 ? dt2.toLocaleDateString() : undefined
                          const time = dt2 ? dt2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
                          return {
                            _id: String(raw._id),
                            candidate: raw.candidate || 'Candidate',
                            position: raw.position,
                            date,
                            time,
                            type: raw.mode === 'in_person' ? 'In-Person' : 'Video Call',
                            status: raw.status || 'scheduled',
                            avatar: raw.avatar,
                            location: raw.location || raw.notes,
                            rawMode: raw.mode,
                            rawNotes: raw.notes,
                          }
                        })
                        setUpcoming(items.filter((i) => i.status === 'scheduled'))
                        setPast(items.filter((i) => i.status === 'completed'))
                      }
                      toast({ description: 'Interview rescheduled' })
                      setRsOpen(false)
                      setRsId("")
                    } catch (e: any) {
                      toast({ description: e?.message || 'Failed to reschedule', variant: 'destructive' })
                    } finally {
                      setUpdatingId("")
                    }
                  }} disabled={!!updatingId}>
                    {updatingId ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Notes / Feedback Modal */}
          {nfOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-lg bg-background border border-border p-4 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{nfMode === 'view' ? 'Interview Notes' : 'Add Feedback'}</h3>
                  <p className="text-sm text-muted-foreground">{nfMode === 'view' ? 'View or edit interview notes.' : 'Share feedback and it will be appended to notes.'}</p>
                </div>
                <div>
                  <textarea className="w-full rounded-md border border-border bg-background p-3 text-sm min-h-[140px]" value={nfText} onChange={(e) => setNfText(e.target.value)} placeholder={nfMode === 'feedback' ? 'Type your feedback…' : 'Type notes…'} />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => setNfOpen(false)}>Cancel</Button>
                  <Button onClick={async () => {
                    try {
                      setUpdatingId('nf')
                      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
                      let notesToSave = nfText
                      if (nfMode === 'feedback') {
                        const stamp = new Date().toLocaleString()
                        notesToSave = `${(nfText || '').trim() ? `[Feedback ${stamp}] ${nfText.trim()}` : ''}`
                      }
                      const res = await fetch(`/api/interviews/${encodeURIComponent(nfId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ notes: notesToSave }) })
                      const data = await res.json().catch(() => ({}))
                      if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Failed to save')
                      await fetchInterviews()
                      setNfOpen(false)
                      toast({ description: nfMode === 'feedback' ? 'Feedback added' : 'Notes updated' })
                    } catch (e: any) {
                      toast({ description: e?.message || 'Failed to save', variant: 'destructive' })
                    } finally {
                      setUpdatingId("")
                    }
                  }} disabled={!nfId || updatingId === 'nf'}>
                    {updatingId === 'nf' ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}


