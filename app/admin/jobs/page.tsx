"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LayoutDashboard, Users, Briefcase, TrendingUp, Search, MoreVertical, CheckCircle, XCircle } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useEvents } from "@/hooks/use-events"
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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"


const navigation = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard, current: false },
  { name: "Users", href: "/admin/users", icon: Users, current: false },
  { name: "Jobs", href: "/admin/jobs", icon: Briefcase, current: true },
  { name: "Reports", href: "/admin/reports", icon: TrendingUp, current: false },
]

type AdminJob = {
  _id: string
  title: string
  company?: string
  location?: string
  type?: string
  status?: string
  applications?: number
  postedAt?: string
  featured?: boolean
}

export default function AdminJobsPage() {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState("")
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ id: string; action: 'approve' | 'reject' | 'close' } | null>(null)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [detailsJob, setDetailsJob] = useState<any | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null)
  const [appsOpen, setAppsOpen] = useState(false)
  const [appsLoading, setAppsLoading] = useState(false)
  const [appsError, setAppsError] = useState<string | null>(null)
  const [apps, setApps] = useState<any[]>([])
  const [appsStatus, setAppsStatus] = useState<'all' | 'submitted' | 'reviewed' | 'shortlisted' | 'interview' | 'rejected' | 'hired'>('all')
  const [appsJobTitle, setAppsJobTitle] = useState<string>("")
  const [appsJobId, setAppsJobId] = useState<string>("")
  const [appsPage, setAppsPage] = useState<number>(1)
  const [appsLimit, setAppsLimit] = useState<number>(20)
  const [appsTotal, setAppsTotal] = useState<number>(0)
  const [appsHasMore, setAppsHasMore] = useState<boolean>(false)
  const [appsProfileOpen, setAppsProfileOpen] = useState(false)
  const [appsProfileLoading, setAppsProfileLoading] = useState(false)
  const [appsProfileError, setAppsProfileError] = useState<string | null>(null)
  const [appsProfile, setAppsProfile] = useState<any | null>(null)
  const [appsSelected, setAppsSelected] = useState<Record<string, boolean>>({})
  const [appsBulkStatus, setAppsBulkStatus] = useState<'reviewed' | 'shortlisted' | 'interview' | 'rejected' | 'hired' | ''>('')
  const [appsPreviewOpen, setAppsPreviewOpen] = useState(false)
  const [appsPreviewUrl, setAppsPreviewUrl] = useState<string>("")

  // Create Job dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [cTitle, setCTitle] = useState("")
  const [cCompany, setCCompany] = useState("")
  const [cLocation, setCLocation] = useState("")
  const [cType, setCType] = useState<'full-time'|'part-time'|'contract'|'internship'>('full-time')
  const [cCategory, setCCategory] = useState("")
  const [cDescription, setCDescription] = useState("")
  const [cFeatured, setCFeatured] = useState(false)
  const [cSubmitting, setCSubmitting] = useState(false)

  // Create Ad dialog state
  const [adOpen, setAdOpen] = useState(false)
  const [aTitle, setATitle] = useState("")
  const [aDescription, setADescription] = useState("")
  const [aImageUrl, setAImageUrl] = useState("")
  const [aLinkUrl, setALinkUrl] = useState("")
  const [aActive, setAActive] = useState(true)
  const [aFeatured, setAFeatured] = useState(false)
  const [aStartsAt, setAStartsAt] = useState("")
  const [aEndsAt, setAEndsAt] = useState("")
  const [aSubmitting, setASubmitting] = useState(false)

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  const filteredJobs = jobs.filter(
    (job) =>
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.company || "").toLowerCase().includes(searchQuery.toLowerCase()),
  )

  async function moderate(jobId: string, action: 'approve' | 'reject' | 'close', opts?: { note?: string }) {
    try {
      const endpoint = action === 'close' ? 'close' : action
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const res = await fetch(`/api/admin/jobs/${jobId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ note: opts?.note || undefined }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Failed to ${action} job`)
      const pastTense = action === 'close' ? 'closed' : `${action}d`
      toast({ title: `Job ${pastTense}`, description: `The job has been ${pastTense}.` })
      // refresh list
      setJobs((prev) => prev.map(j => {
        if (j._id !== jobId) return j
        if (action === 'approve') return { ...j, status: 'active' }
        if (action === 'reject') return { ...j, status: 'rejected' }
        return { ...j, status: 'closed' }
      }))
    } catch (e: any) {
      toast({ title: 'Action failed', description: e?.message || 'Something went wrong', variant: 'destructive' })
    }

  }

  async function createAd() {
    try {
      if (!aTitle.trim()) { toast({ description: 'Ad title is required', variant: 'destructive' }); return }
      setASubmitting(true)
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const body: any = {
        title: aTitle.trim(),
        description: aDescription,
        imageUrl: aImageUrl || undefined,
        linkUrl: aLinkUrl || undefined,
        active: aActive,
        featured: aFeatured,
        startsAt: aStartsAt ? new Date(aStartsAt) : null,
        endsAt: aEndsAt ? new Date(aEndsAt) : null,
      }
      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to create ad')
      setAdOpen(false)
      setATitle(""); setADescription(""); setAImageUrl(""); setALinkUrl(""); setAActive(true); setAFeatured(false); setAStartsAt(""); setAEndsAt("")
      toast({ description: 'Ad created. It will appear on the homepage if active/in date.' })
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to create ad', variant: 'destructive' })
    } finally {
      setASubmitting(false)
    }
  }


  async function createJob() {
    try {
      if (!cTitle.trim()) { toast({ description: 'Title is required', variant: 'destructive' }); return }
      setCSubmitting(true)
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const body: any = {
        title: cTitle.trim(),
        description: cDescription,
        location: cLocation,
        type: cType,
        category: cCategory,
        featured: cFeatured,
      }
      if (cCompany.trim()) body.companyName = cCompany.trim()
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to create job')
      // Prepend into table
      const j = data.doc || {}
      setJobs(prev => [{
        _id: String(data.id || j._id || Math.random()),
        title: j.title,
        company: j.companyName || j.company || cCompany,
        location: j.location,
        type: j.type || cType,
        status: j.status || 'active',
        applications: 0,
        postedAt: new Date().toDateString(),
        featured: Boolean(j.featured),
      }, ...prev])
      setCreateOpen(false)
      setCTitle(""); setCCompany(""); setCLocation(""); setCType('full-time'); setCCategory(""); setCDescription(""); setCFeatured(false)
      toast({ description: 'Job created' })
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to create job', variant: 'destructive' })
    } finally {
      setCSubmitting(false)
    }
  }

  async function setFeatured(jobId: string, value: boolean) {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const endpoint = value ? 'feature' : 'unfeature'
      const res = await fetch(`/api/admin/jobs/${jobId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to update featured')
      setJobs(prev => prev.map(j => j._id === jobId ? { ...j, featured: value } : j))
      toast({ description: value ? 'Marked as Featured' : 'Removed from Featured' })
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to update featured', variant: 'destructive' })
    }
  }

  async function approveApplication(appId: string) {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const res = await fetch(`/api/admin/applications/${encodeURIComponent(appId)}/approve`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Approve failed')
      toast({ description: 'Application approved for review' })
      if (appsJobId) await fetchApplications(appsJobId, appsPage, appsStatus)
    } catch (e: any) {
      toast({ description: e?.message || 'Approve failed', variant: 'destructive' })
    }
  }

  async function rejectApplication(appId: string) {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const res = await fetch(`/api/admin/applications/${encodeURIComponent(appId)}/reject`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Reject failed')
      toast({ description: 'Application rejected' })
      if (appsJobId) await fetchApplications(appsJobId, appsPage, appsStatus)
    } catch (e: any) {
      toast({ description: e?.message || 'Reject failed', variant: 'destructive' })
    }
  }


  function onToggleAllApps(currentPageSelected: boolean) {
    const next: Record<string, boolean> = {}
    for (const a of apps) next[String(a._id)] = !currentPageSelected
    setAppsSelected(next)
  }

  function isAllSelected() {
    if (!apps.length) return false
    return apps.every(a => appsSelected[String(a._id)])
  }

  function toggleOne(appId: string) {
    setAppsSelected(prev => ({ ...prev, [appId]: !prev[appId] }))
  }

  async function applyBulkStatus() {
    if (!appsBulkStatus) {
      toast({ title: 'Select a status', description: 'Choose a status to apply to selected applications.' })
      return
    }
    const ids = apps.filter(a => appsSelected[String(a._id)]).map(a => String(a._id))
    if (!ids.length) {
      toast({ title: 'No applications selected', description: 'Select at least one application.' })
      return
    }
    let ok = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/applications/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: appsBulkStatus }) })
        const data = await res.json()
        if (res.ok && data?.ok) ok++
      } catch {}
    }
    toast({ title: 'Bulk update', description: `Updated ${ok} of ${ids.length} applications.` })
    // refresh current page
    if (appsJobId) await fetchApplications(appsJobId, appsPage, appsStatus)
  }

  async function fetchApplications(jobId: string, page: number, status: typeof appsStatus, limitOverride?: number) {
    setAppsLoading(true)
    setAppsError(null)
    try {
      const params = new URLSearchParams()
      params.set('jobId', jobId)
      params.set('page', String(page))
      params.set('limit', String(limitOverride ?? appsLimit))
      if (status !== 'all') params.set('status', status)
      const res = await fetch(`/api/applications?${params.toString()}`)
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load applications')
      setApps(data.applications || [])
      setAppsTotal(data.total || 0)
      setAppsHasMore(Boolean(data.hasMore))
      setAppsPage(data.page || page)
    } catch (e: any) {
      setAppsError(e?.message || 'Error loading applications')
    } finally {
      setAppsLoading(false)
    }
  }

  async function openApplications(job: AdminJob) {
    setAppsOpen(true)
    setApps([])
    setAppsJobTitle(job.title)
    setAppsJobId(job._id)
    setAppsSelected({})
    await fetchApplications(job._id, 1, appsStatus)
  }

  async function openApplicantProfile(userId: string) {
    setAppsProfileOpen(true)
    setAppsProfileLoading(true)
    setAppsProfileError(null)
    setAppsProfile(null)
    try {
      const res = await fetch(`/api/users/${userId}`)
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load user')
      setAppsProfile(data.user)
    } catch (e: any) {
      setAppsProfileError(e?.message || 'Error loading user')
    } finally {
      setAppsProfileLoading(false)
    }
  }

  function exportAppsCsv() {
    const rows = [
      ['ApplicantName','ApplicantEmail','ApplicantId','UserId','JobId','Status','CreatedAt','UpdatedAt','ResumeUrl','CoverLetterUrl']
    ]
    const filtered = apps.filter(a => appsStatus === 'all' || a.status === appsStatus)
    for (const a of filtered) {
      const name = a.user?.name || ''
      const email = a.user?.email || ''
      rows.push([
        String(name),
        String(email),
        String(a._id || ''),
        String(a.userId || ''),
        String(a.jobId || ''),
        String(a.status || ''),
        a.createdAt ? new Date(a.createdAt).toISOString() : '',
        a.updatedAt ? new Date(a.updatedAt).toISOString() : '',
        String(a.resumeUrl || ''),
        String(a.coverLetterUrl || ''),
      ])
    }
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `applications-${appsJobTitle || 'job'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function openDetails(jobId: string) {
    setDetailsOpen(true)
    setDetailsLoading(true)
    setDetailsError(null)
    setDetailsJob(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}`)
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load job')
      setDetailsJob(data.job)
    } catch (e: any) {
      setDetailsError(e?.message || 'Error loading job')
    } finally {
      setDetailsLoading(false)
    }
  }

  async function deleteJob(jobId: string) {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to delete job')
      toast({ title: 'Job deleted', description: 'The job has been removed.' })
      setJobs(prev => prev.filter(j => j._id !== jobId))
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message || 'Something went wrong', variant: 'destructive' })
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
        const res = await fetch('/api/admin/jobs', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const data = await res.json()
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load jobs')
        if (mounted) {
          const mapped: AdminJob[] = (data.jobs || []).map((j: any) => {
            const rawCompany = j.companyName || j.company
            const companyStr = typeof rawCompany === 'object' && rawCompany !== null
              ? (rawCompany.name || '')
              : (rawCompany || '')
            return {
              _id: String(j._id),
              title: j.title,
              company: companyStr,
              location: j.location,
              type: j.type || 'Full-time',
              status: j.status || 'active',
              applications: typeof j.applicationsCount === 'number' ? j.applicationsCount : (j.applications || 0),
              postedAt: j.createdAt ? new Date(j.createdAt).toDateString() : undefined,
              featured: Boolean(j.featured),
            }
          })
          setJobs(mapped)
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Error loading jobs')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Subscribe to realtime events and refresh tables accordingly
  useEvents({
    events: ['job.created','job.updated','job.deleted','application.created','application.updated','application.deleted','application.status_changed','interview.created'],
    onEvent: () => {
      // Refresh jobs list
      ;(async () => {
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
          const res = await fetch('/api/admin/jobs', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
          const data = await res.json()
          if (res.ok && data?.ok) {
            const mapped: AdminJob[] = (data.jobs || []).map((j: any) => {
              const rawCompany = j.companyName || j.company
              const companyStr = typeof rawCompany === 'object' && rawCompany !== null
                ? (rawCompany.name || '')
                : (rawCompany || '')
              return {
                _id: String(j._id),
                title: j.title,
                company: companyStr,
                location: j.location,
                type: j.type || 'Full-time',
                status: j.status || 'active',
                applications: typeof j.applicationsCount === 'number' ? j.applicationsCount : (j.applications || 0),
                postedAt: j.createdAt ? new Date(j.createdAt).toDateString() : undefined,
                featured: Boolean(j.featured),
              }
            })
            setJobs(mapped)
            toast({ description: 'Jobs updated' })
          }
        } catch {}
      })()
      // If applications dialog is open, refresh current page
      ;(async () => {
        try {
          if (appsOpen && appsJobId) {
            await fetchApplications(appsJobId, appsPage, appsStatus)
          }
        } catch {}
      })()
    }
  })

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      closed: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    }
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${colors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-6">
          {/* Page Header */}
          <PageHeader
            title="Job Management"
            description="Review and moderate job postings across the platform"
          />

          {/* Create Job */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Create Job</CardTitle>
                <CardDescription>Admins can add new jobs and optionally mark as featured.</CardDescription>
              </div>
              <Button onClick={() => setCreateOpen(true)}>New Job</Button>
            </CardHeader>
          </Card>

          {/* Create Ad */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Create Ad</CardTitle>
                <CardDescription>Post an advertisement shown on the homepage.</CardDescription>
              </div>
              <Button variant="outline" onClick={() => setAdOpen(true)}>New Ad</Button>
            </CardHeader>
          </Card>

          {/* Jobs Table */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>All Job Posts</CardTitle>
              <CardDescription>Approve, reject, or manage job postings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search jobs by title or company..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {loading ? (
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job Title</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Featured</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Applications</TableHead>
                        <TableHead>Posted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : error ? (
                <EmptyState title="Error loading jobs" description={error} />
              ) : filteredJobs.length === 0 ? (
                <EmptyState title="No jobs found" description="Try another search or filter." />
              ) : (
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job Title</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Applications</TableHead>
                        <TableHead>Posted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredJobs.map((job) => (
                        <TableRow key={job._id}>
                          <TableCell className="font-medium text-foreground">{job.title}</TableCell>
                          <TableCell className="text-muted-foreground">{job.company}</TableCell>
                          <TableCell className="text-muted-foreground">{job.location}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{job.type}</Badge>
                          </TableCell>
                          <TableCell>
                            {job.featured ? <Badge>Featured</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>{getStatusBadge(job.status || 'active')}</TableCell>
                          <TableCell className="text-muted-foreground">{job.applications}</TableCell>
                          <TableCell className="text-muted-foreground">{job.postedAt}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openDetails(job._id)}>View Details</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openApplications(job)}>View Applications</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {job.featured ? (
                                  <DropdownMenuItem onClick={() => setFeatured(job._id, false)}>
                                    Remove Featured
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => setFeatured(job._id, true)}>
                                    Mark as Featured
                                  </DropdownMenuItem>
                                )}
                                {job.status === 'pending' && (
                                  <>
                                    <DropdownMenuItem
                                      className="text-green-600"
                                      onClick={() => { setPendingAction({ id: job._id, action: 'approve' }); setDialogOpen(true); setNote("") }}
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => { setPendingAction({ id: job._id, action: 'reject' }); setDialogOpen(true); setNote("") }}
                                    >
                                      <XCircle className="mr-2 h-4 w-4" />
                                      Reject
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {job.status === 'active' && (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => { setPendingAction({ id: job._id, action: 'close' }); setDialogOpen(true); setNote("") }}
                                  >
                                    Close Job
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => { setDeleteJobId(job._id); setDeleteOpen(true) }}
                                >
                                  Delete Job
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Moderation Dialog */}
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingAction?.action === 'approve' && 'Approve Job Posting'}
                {pendingAction?.action === 'reject' && 'Reject Job Posting'}
                {pendingAction?.action === 'close' && 'Close Job Posting'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingAction?.action === 'approve' && 'This will make the job visible to job seekers.'}
                {pendingAction?.action === 'reject' && 'This will reject the job and hide it from listings.'}
                {pendingAction?.action === 'close' && 'This will close the job and stop receiving new applications.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Moderation note (optional)</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for audit trail..." />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={submitting}
                onClick={async () => {
                  if (!pendingAction) return
                  try {
                    setSubmitting(true)
                    await moderate(pendingAction.id, pendingAction.action, { note })
                    setDialogOpen(false)
                    setNote("")
                    setPendingAction(null)
                  } finally {
                    setSubmitting(false)
                  }
                }}
              >
                {submitting ? 'Processing...' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create Ad Dialog */}
        <AlertDialog open={adOpen} onOpenChange={setAdOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>New Ad</AlertDialogTitle>
              <AlertDialogDescription>Fill in the ad details. Active ads within date range appear on the homepage.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-3">
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={aTitle} onChange={(e) => setATitle(e.target.value)} placeholder="e.g. Bootcamp Enrollment" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea value={aDescription} onChange={(e) => setADescription(e.target.value)} placeholder="Ad details..." />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Image URL</Label>
                  <Input value={aImageUrl} onChange={(e) => setAImageUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <Label className="text-xs">Link URL</Label>
                  <Input value={aLinkUrl} onChange={(e) => setALinkUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Starts At</Label>
                  <Input type="date" value={aStartsAt} onChange={(e) => setAStartsAt(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Ends At</Label>
                  <Input type="date" value={aEndsAt} onChange={(e) => setAEndsAt(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <div className="font-medium">Active</div>
                  <div className="text-xs text-muted-foreground">Only active ads are shown.</div>
                </div>
                <Switch checked={aActive} onCheckedChange={setAActive} />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <div className="font-medium">Featured</div>
                  <div className="text-xs text-muted-foreground">Featured ads appear first.</div>
                </div>
                <Switch checked={aFeatured} onCheckedChange={setAFeatured} />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={aSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={aSubmitting} onClick={createAd}>{aSubmitting ? 'Creating...' : 'Create Ad'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create Job Dialog */}
        <AlertDialog open={createOpen} onOpenChange={setCreateOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>New Job</AlertDialogTitle>
              <AlertDialogDescription>Fill in the details and publish.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-3">
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="e.g. Frontend Engineer" />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Company</Label>
                  <Input value={cCompany} onChange={(e) => setCCompany(e.target.value)} placeholder="e.g. Acme Inc." />
                </div>
                <div>
                  <Label className="text-xs">Location</Label>
                  <Input value={cLocation} onChange={(e) => setCLocation(e.target.value)} placeholder="e.g. Remote" />
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Type</Label>
                  <select className="border rounded-md bg-background px-2 py-2 w-full" value={cType} onChange={(e) => setCType(e.target.value as any)}>
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Category</Label>
                  <Input value={cCategory} onChange={(e) => setCCategory(e.target.value)} placeholder="e.g. Engineering" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea value={cDescription} onChange={(e) => setCDescription(e.target.value)} placeholder="Role details, responsibilities, requirements..." />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <div className="font-medium">Featured</div>
                  <div className="text-xs text-muted-foreground">Show near the top of Featured Jobs on the homepage</div>
                </div>
                <Switch checked={cFeatured} onCheckedChange={setCFeatured} />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={cSubmitting} onClick={createJob}>{cSubmitting ? 'Creating...' : 'Create'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Job Details Dialog */}
        <AlertDialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Job Details</AlertDialogTitle>
              <AlertDialogDescription>Full information, including moderation metadata.</AlertDialogDescription>
            </AlertDialogHeader>
            {detailsLoading ? (
              <div className="py-4">Loading…</div>
            ) : detailsError ? (
              <div className="py-2 text-destructive text-sm">{detailsError}</div>
            ) : detailsJob ? (
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Title:</span> {detailsJob.title}</div>
                <div>
                  <span className="font-medium">Company:</span>{' '}
                  {(() => {
                    const raw = detailsJob.companyName || detailsJob.company
                    if (raw && typeof raw === 'object') return String(raw.name || '')
                    return String(raw || '')
                  })()}
                </div>
                <div><span className="font-medium">Location:</span> {detailsJob.location}</div>
                <div><span className="font-medium">Type:</span> {detailsJob.type}</div>
                <div><span className="font-medium">Status:</span> {detailsJob.status}</div>
                <div><span className="font-medium">Created At:</span> {detailsJob.createdAt ? new Date(detailsJob.createdAt).toLocaleString() : '-'}</div>
                <div><span className="font-medium">Updated At:</span> {detailsJob.updatedAt ? new Date(detailsJob.updatedAt).toLocaleString() : '-'}</div>
                <div><span className="font-medium">Moderated By:</span> {detailsJob.moderatedBy || '-'}</div>
                <div><span className="font-medium">Moderated At:</span> {detailsJob.moderatedAt ? new Date(detailsJob.moderatedAt).toLocaleString() : '-'}</div>
                <div><span className="font-medium">Moderation Note:</span> {detailsJob.moderationNote || '-'}</div>
                <div className="pt-2"><span className="font-medium">Description:</span>
                  <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{detailsJob.description || '-'}</div>
                </div>
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirm Dialog */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Job</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone. The job will be permanently removed.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => { if (deleteJobId) { await deleteJob(deleteJobId); setDeleteOpen(false); setDeleteJobId(null) } }}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* View Applications Dialog */}
        <AlertDialog open={appsOpen} onOpenChange={setAppsOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Applications for {appsJobTitle}</AlertDialogTitle>
              <AlertDialogDescription>Filter and export applications for this job.</AlertDialogDescription>
            </AlertDialogHeader>
            {appsLoading ? (
              <div className="py-4">Loading…</div>
            ) : appsError ? (
              <div className="py-2 text-destructive text-sm">{appsError}</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <select
                    className="border rounded-md px-2 py-1 text-sm bg-background"
                    value={appsStatus}
                    onChange={async (e) => { const v = e.target.value as any; setAppsStatus(v); if (appsJobId) { await fetchApplications(appsJobId, 1, v) } }}
                  >
                    <option value="all">All statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="interview">Interview</option>
                    <option value="rejected">Rejected</option>
                    <option value="hired">Hired</option>
                  </select>
                  <Button variant="outline" size="sm" onClick={exportAppsCsv}>Export CSV</Button>
                  <select
                    className="border rounded-md px-2 py-1 text-sm bg-background"
                    value={appsLimit}
                    onChange={async (e) => {
                      const next = parseInt(e.target.value, 10) || 20
                      setAppsLimit(next)
                      if (appsJobId) {
                        await fetchApplications(appsJobId, 1, appsStatus, next)
                      }
                    }}
                  >
                    <option value={10}>10 / page</option>
                    <option value={20}>20 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>
                <div className="max-h-80 overflow-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 align-middle">
                          <input
                            type="checkbox"
                            checked={isAllSelected()}
                            onChange={() => onToggleAllApps(isAllSelected())}
                          />
                        </th>
                        <th className="text-left p-2">Applicant</th>
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Created</th>
                        <th className="text-left p-2">Updated</th>
                        <th className="text-left p-2">Resume</th>
                        <th className="text-left p-2">Cover Letter</th>
                        <th className="text-left p-2">Profile</th>
                        <th className="text-left p-2">Preview</th>
                        <th className="text-left p-2">Moderation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apps.filter(a => appsStatus === 'all' || a.status === appsStatus).map((a) => (
                        <tr key={String(a._id)} className="border-t">
                          <td className="p-2 align-middle">
                            <input type="checkbox" checked={!!appsSelected[String(a._id)]} onChange={() => toggleOne(String(a._id))} />
                          </td>
                          <td className="p-2">{a.user?.name || a.user?.email || String(a.userId)}</td>
                          <td className="p-2">{a.user?.email || '-'}</td>
                          <td className="p-2">{a.status}</td>
                          <td className="p-2">{a.createdAt ? new Date(a.createdAt).toLocaleString() : '-'}</td>
                          <td className="p-2">{a.updatedAt ? new Date(a.updatedAt).toLocaleString() : '-'}</td>
                          <td className="p-2">
                            {a.resumeUrl ? (
                              <div className="flex items-center gap-2">
                                <a className="text-primary underline" href={`/api/files/proxy?path=${encodeURIComponent(String(a.resumeUrl))}`} target="_blank" rel="noopener noreferrer">Resume</a>
                                <a className="text-muted-foreground underline" href={`/api/files/proxy?path=${encodeURIComponent(String(a.resumeUrl))}&download=1`}>
                                  Download
                                </a>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-2">
                            {a.coverLetterUrl ? (
                              <a className="text-primary underline" href={`/api/files/proxy?path=${encodeURIComponent(String(a.coverLetterUrl))}`} target="_blank" rel="noopener noreferrer">Cover Letter</a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-2">
                            <Button variant="ghost" size="sm" onClick={() => openApplicantProfile(String(a.user?._id || a.userId))}>View</Button>
                          </td>
                          <td className="p-2">
                            <Button variant="ghost" size="sm" onClick={() => { setAppsPreviewOpen(true); setAppsPreviewUrl(String(a.resumeUrl || '')) }} disabled={!a.resumeUrl}>Preview</Button>
                          </td>
                          <td className="p-2">
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => approveApplication(String(a._id))}>Approve</Button>
                              <Button variant="destructive" size="sm" onClick={() => rejectApplication(String(a._id))}>Reject</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <select
                    className="border rounded-md px-2 py-1 text-sm bg-background"
                    value={appsBulkStatus}
                    onChange={(e) => setAppsBulkStatus(e.target.value as any)}
                  >
                    <option value="">Bulk status…</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="interview">Interview</option>
                    <option value="rejected">Rejected</option>
                    <option value="hired">Hired</option>
                  </select>
                  <Button size="sm" onClick={applyBulkStatus}>Apply</Button>
                </div>
                <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
                  <div>
                    Page {appsPage}, showing {apps.length} of {appsTotal}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={appsPage <= 1 || appsLoading} onClick={() => fetchApplications(appsJobId, appsPage - 1, appsStatus)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={!appsHasMore || appsLoading} onClick={() => fetchApplications(appsJobId, appsPage + 1, appsStatus)}>Next</Button>
                  </div>
                </div>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Applicant Profile Dialog */}
        <AlertDialog open={appsProfileOpen} onOpenChange={setAppsProfileOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Applicant Profile</AlertDialogTitle>
              <AlertDialogDescription>Basic applicant information</AlertDialogDescription>
            </AlertDialogHeader>
            {appsProfileLoading ? (
              <div className="py-4">Loading…</div>
            ) : appsProfileError ? (
              <div className="py-2 text-destructive text-sm">{appsProfileError}</div>
            ) : appsProfile ? (
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Name:</span> {appsProfile.name || '-'}</div>
                <div><span className="font-medium">Email:</span> {appsProfile.email || '-'}</div>
                <div><span className="font-medium">Role:</span> {appsProfile.role || '-'}</div>
                <div><span className="font-medium">Joined:</span> {appsProfile.createdAt ? new Date(appsProfile.createdAt).toLocaleString() : '-'}</div>
                <div><span className="font-medium">Last Active:</span> {appsProfile.lastActive ? new Date(appsProfile.lastActive).toLocaleString() : '-'}</div>
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Resume Preview Dialog */}
        <AlertDialog open={appsPreviewOpen} onOpenChange={setAppsPreviewOpen}>
          <AlertDialogContent className="max-w-4xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Resume Preview</AlertDialogTitle>
              <AlertDialogDescription>Preview the applicant's resume</AlertDialogDescription>
            </AlertDialogHeader>
            {appsPreviewUrl ? (
              <div className="h-[70vh]">
                <iframe src={appsPreviewUrl} className="w-full h-full rounded-md border" />
              </div>
            ) : (
              <div className="py-4 text-sm text-muted-foreground">No resume to preview.</div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
