"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  Plus,
  Search,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { useAuth } from "@/lib/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

const navigation = [
  { name: "Dashboard", href: "/employer", icon: LayoutDashboard, current: false },
  { name: "My Jobs", href: "/employer/jobs", icon: Briefcase, current: true },
  { name: "Applicants", href: "/employer/applicants", icon: Users, current: false },
  { name: "Interviews", href: "/employer/interviews", icon: Calendar, current: false },
]

type EmployerJob = {
  _id: string
  title: string
  location?: string
  type?: string
  salaryMin?: number
  salaryMax?: number
  status?: 'open' | 'closed' | 'pending'
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  applicants?: number
  views?: number
  postedAt?: string
  companyId?: string
  createdBy?: string
}

export default function EmployerJobsPage() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const npr = new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 })
  const [searchQuery, setSearchQuery] = useState("")
  const [jobs, setJobs] = useState<EmployerJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  const filteredJobs = jobs.filter((job) => job.title.toLowerCase().includes(searchQuery.toLowerCase()))

  // Function to get status badge variant
  const getStatusVariant = (status: string = '') => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'default'
      case 'pending':
        return 'secondary'
      case 'rejected':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  // Removed employer 'View Details' action; details page is for job seekers only

  const editJob = (id: string) => {
    // Reuse the new job page in edit mode
    router.push(`/employer/jobs/new?edit=${encodeURIComponent(id)}`)
  }

  const viewApplicants = (id: string) => {
    router.push(`/employer/applicants?jobId=${encodeURIComponent(id)}`)
  }

  const deleteJob = async (id: string) => {
    try {
      if (typeof window !== 'undefined') {
        const ok = window.confirm('Are you sure you want to delete this job? This action cannot be undone.')
        if (!ok) return
      }
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Failed to delete job')
      toast({ description: 'Job deleted' })
      await fetchJobs()
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to delete job', variant: 'destructive' })
    }
  }

  async function fetchJobs() {
    if (!user?.id) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const token = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
      const res = await fetch(`/api/jobs?createdBy=${user.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load jobs')
      const baseItems: EmployerJob[] = (data.jobs || []).map((j: any) => ({
        _id: String(j._id),
        title: j.title,
        location: j.location,
        type: j.type || 'Full-time',
        salary: (typeof j.salaryMin === 'number' && typeof j.salaryMax === 'number') ? `${npr.format(j.salaryMin)} - ${npr.format(j.salaryMax)}` : undefined,
        status: j.status || 'active',
        applicants: 0,
        views: 0,
        postedAt: j.createdAt ? new Date(j.createdAt).toDateString() : undefined,
      }))
      // Enrich with real counts
      const enriched = await Promise.all(baseItems.map(async (it) => {
        try {
          const [appsRes, viewsRes] = await Promise.all([
            fetch(`/api/applications?jobId=${encodeURIComponent(it._id)}&limit=1`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }),
            fetch(`/api/analytics/views?mine=1&jobId=${encodeURIComponent(it._id)}&periodDays=30`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }),
          ])
          const appsData = await appsRes.json().catch(() => ({}))
          const viewsData = await viewsRes.json().catch(() => ({}))
          return {
            ...it,
            applicants: (appsRes.ok && appsData?.ok) ? Number(appsData.total || 0) : it.applicants,
            views: (viewsRes.ok && viewsData?.ok) ? Number(viewsData.total || 0) : it.views,
          }
        } catch {
          return it
        }
      }))
      setJobs(enriched)
    } catch (e: any) {
      setError(e?.message || 'Error loading jobs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => { if (mounted) await fetchJobs() })()
    return () => { mounted = false }
  }, [user?.id])

  const updateJobStatus = async (id: string, status: 'open' | 'closed') => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Failed to update job')
      toast({ description: status === 'open' ? 'Job published' : 'Job closed' })
      await fetchJobs()
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to update job', variant: 'destructive' })
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      open: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      draft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      closed: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    }
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${colors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const isOpen = (s?: string) => (s === 'open' || s === 'active')

  return (
    <ProtectedRoute allowedRoles={["employer"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-6">
          {/* Page Header */}
          <PageHeader
            title="My Job Posts"
            description="Manage and track all your job postings"
            actions={
              <Link href="/employer/jobs/new">
                <Button size="lg">
                  <Plus className="mr-2 h-5 w-5" />
                  Post New Job
                </Button>
              </Link>
            }
          />

          {/* Search and Filter */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>All Jobs</CardTitle>
              <CardDescription>View and manage your job postings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search jobs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Jobs List */}
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-lg border border-border">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <div className="flex gap-3 items-center">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-5 w-16" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <div className="flex gap-6">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        </div>
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredJobs.length === 0 ? (
                <EmptyState title="No jobs found" description="Try a different search term." />
              ) : (
                <div className="space-y-4">
                  {filteredJobs.map((job) => (
                    <div key={job._id} className="p-4 rounded-lg border border-border hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-foreground">{job.title}</h3>
                            <div className="flex items-center gap-2">
                              <Badge variant={job.status === 'open' ? 'default' : 'secondary'} className="capitalize">
                                {job.status || 'draft'}
                              </Badge>
                              {job.approvalStatus && (
                                <Badge variant={getStatusVariant(job.approvalStatus)} className="capitalize">
                                  {job.approvalStatus}
                                </Badge>
                              )}
                            </div>
                            <span className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              {job.views} views
                            </span>
                            <span>Posted {job.postedAt}</span>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            {/* View Details removed for employers */}
                            <DropdownMenuItem onClick={() => editJob(job._id)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Job
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => viewApplicants(job._id)}>
                              <Users className="mr-2 h-4 w-4" />
                              View Applicants
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {isOpen(job.status) ? (
                              <DropdownMenuItem onClick={() => updateJobStatus(job._id, 'closed')}>Close Job</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => updateJobStatus(job._id, 'open')}>Publish Job</DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteJob(job._id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Job
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
