"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Home, Search, Briefcase, FileText, Bookmark, MapPin, DollarSign, Clock, Filter, BookOpen } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useEvents } from "@/hooks/use-events"
import { useToast } from "@/hooks/use-toast"
import { getAppliedJobs } from "@/lib/job-utils"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home, current: false },
  { name: "Find Jobs", href: "/dashboard/jobs", icon: Search, current: true },
  { name: "Applications", href: "/dashboard/applications", icon: Briefcase, current: false },
  { name: "Training", href: "/dashboard/training", icon: BookOpen, current: false },
  { name: "Profile", href: "/dashboard/profile", icon: FileText, current: false },
  { name: "Saved Jobs", href: "/dashboard/saved", icon: Bookmark, current: false },
]

type JobItem = {
  _id: string
  id?: string  // For backward compatibility
  title: string
  company?: string
  location?: string
  salary?: string
  type?: string
  description?: string
  postedAt?: string
  match?: number
  hasApplied?: boolean
}

export default function FindJobsPage() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const npr = new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 })
  // Helper to compute a simple skill match % between user and job
  const computeMatch = (job: any, currentUser: any): number | undefined => {
    const uSkills: string[] = Array.isArray(currentUser?.skills) ? currentUser.skills : []
    const jSkills: string[] = Array.isArray(job?.skills) ? job.skills : []
    if (!uSkills.length || !jSkills.length) return undefined
    const uset = new Set(uSkills.map((s) => String(s).toLowerCase()))
    let overlap = 0
    for (const s of jSkills) {
      const v = String(s || '').toLowerCase()
      if (uset.has(v)) overlap++
    }
    const score = Math.round((overlap / jSkills.length) * 100)
    return Math.max(0, Math.min(100, score))
  }
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [locationFilter, setLocationFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  const [urlSyncTimer, setUrlSyncTimer] = useState<any>(null)
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set())

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.company || "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLocation =
      locationFilter === "all" || (job.location || "").toLowerCase().includes(locationFilter.toLowerCase())
    const matchesType = typeFilter === "all" || (job.type || '').toLowerCase() === typeFilter.toLowerCase()
    return matchesSearch && matchesLocation && matchesType
  })

  useEffect(() => {
    // Initialize filters from URL params
    const q = (searchParams.get('query') || searchParams.get('q') || '').trim()
    const cat = (searchParams.get('category') || '').trim()
    const loc = (searchParams.get('location') || '').trim()
    const typ = (searchParams.get('type') || '').trim()
    if (q || cat) setSearchQuery(q || cat)
    if (loc) setLocationFilter(loc)
    if (typ) setTypeFilter(typ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch jobs first
        const jobsResponse = await fetch('/api/jobs');
        const jobsData = await jobsResponse.json();
        
        if (!isMounted) return;
        
        if (jobsResponse.ok) {
          // Initialize jobs without application status first
          const initialJobs = jobsData.jobs.map((job: any) => ({
            ...job,
            _id: String(job._id || job.id || ''),
            id: String(job._id || job.id || ''),
            match: computeMatch(job, user),
            hasApplied: false // Will be updated after fetching applied jobs
          }));
          
          setJobs(initialJobs);
          
          // If user is logged in, fetch their applications in the background
          if (user?.id) {
            getAppliedJobs()
              .then(appliedJobIds => {
                if (isMounted) {
                  setAppliedJobIds(appliedJobIds);
                  setJobs(prevJobs => 
                    prevJobs.map(job => ({
                      ...job,
                      hasApplied: appliedJobIds.has(job._id || '')
                    }))
                  );
                }
              })
              .catch(err => {
                console.error('Failed to fetch applied jobs:', err);
                toast({
                  title: 'Warning',
                  description: 'Could not load application status. Some features may be limited.',
                  variant: 'destructive'
                });
              });
          }
        } else {
          setError(jobsData.error || 'Failed to fetch jobs');
        }
      } catch (err) {
        setError('An error occurred while fetching jobs')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  // Subscribe to job events and refetch
  useEvents({
    events: ['job.created', 'job.updated', 'job.deleted'],
    onEvent: () => {
      // lightweight refetch without resetting filters
      ;(async () => {
        try {
          const res = await fetch('/api/jobs')
          const data = await res.json()
          if (res.ok && data?.ok) {
            const items: JobItem[] = (data.jobs || []).map((j: any) => {
              const rawCompany = j.companyName || j.company || 'Unknown Company'
              const companyStr = rawCompany && typeof rawCompany === 'object' ? (rawCompany.name || 'Unknown Company') : String(rawCompany)
              const match = computeMatch(j, user)
              return {
                _id: String(j._id),
                title: j.title,
                company: companyStr,
                location: j.location,
                salary: (typeof j.salaryMin === 'number' && typeof j.salaryMax === 'number') ? `${npr.format(j.salaryMin)} - ${npr.format(j.salaryMax)}` : undefined,
                type: j.type || 'Full-time',
                description: j.description,
                postedAt: j.createdAt ? new Date(j.createdAt).toDateString() : undefined,
                match: typeof match === 'number' ? match : undefined,
              }
            })
            setJobs(items)
            toast({ description: 'Job listings updated' })
          }
        } catch {}
      })()
    }
  })

  const handleApply = (jobId: string) => {
    router.push(`/dashboard/jobs/${jobId}/apply`)
  }

  const refreshAppliedStatus = async () => {
    try {
      const applied = await getAppliedJobs();
      setAppliedJobIds(applied);
      setJobs(prevJobs => 
        prevJobs.map(job => {
          const jobId = String(job._id || job.id || '');
          return {
            ...job,
            _id: jobId,
            id: jobId,
            hasApplied: applied.has(jobId)
          };
        })
      );
      
      // Show success message if we have applied jobs
      if (applied.size > 0) {
        toast({
          title: 'Applications loaded',
          description: `Found ${applied.size} applied jobs`,
        });
      }
    } catch (error: any) {
      console.error('Failed to refresh application status:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to refresh application status',
        variant: 'destructive'
      });
    }
  }

  return (
    <ProtectedRoute allowedRoles={["job_seeker"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-6">
          {/* Page Header */}
          <PageHeader
            title="Find Jobs"
            description="Discover opportunities that match your skills and interests"
          />

          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Search Jobs</CardTitle>
              <CardDescription>Filter jobs by title, location, and type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by job title or company..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="san francisco">San Francisco</SelectItem>
                      <SelectItem value="new york">New York</SelectItem>
                      <SelectItem value="boston">Boston</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Job Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="Full-time">Full-time</SelectItem>
                      <SelectItem value="Part-time">Part-time</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                      <SelectItem value="Internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                      setSearchQuery("")
                      setLocationFilter("all")
                      setTypeFilter("all")
                      router.replace(pathname)
                    }}>
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Showing {filteredJobs.length} {filteredJobs.length === 1 ? "job" : "jobs"}
            </p>

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-8 w-20" />
                      </div>
                      <div className="flex gap-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <Skeleton className="h-4 w-full" />
                      <div className="flex gap-2">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-28" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredJobs.length === 0 ? (
              <EmptyState
                title="No results"
                description="Try adjusting your search or filters to find more opportunities."
              />
            ) : (
              <div className="space-y-4">
                {filteredJobs.map((job) => (
                  <Card key={job._id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-semibold text-foreground">{job.title}</h3>
                            {typeof job.match === 'number' && (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              >
                                {job.match}% Match
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground">{job.company}</p>
                        </div>
                        <Button
                          variant={savedJobIds.has(job._id) ? 'default' : 'outline'}
                          size="sm"
                          onClick={async () => {
                            try {
                              const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
                              if (!token) { toast({ description: 'Please log in to save jobs', variant: 'destructive' }); return }
                              if (savedJobIds.has(job._id)) {
                                const res = await fetch(`/api/saved?jobId=${encodeURIComponent(job._id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
                                const json = await res.json().catch(() => ({}))
                                if (!res.ok || json?.ok === false) throw new Error(json?.error || 'Failed to remove')
                                setSavedJobIds(prev => { const copy = new Set(prev); copy.delete(job._id); return copy })
                                toast({ description: 'Removed from Saved' })
                              } else {
                                const res = await fetch('/api/saved', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ jobId: job._id }) })
                                const json = await res.json()
                                if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to save')
                                setSavedJobIds(prev => { const copy = new Set(prev); copy.add(job._id); return copy })
                                toast({ description: 'Saved job' })
                              }
                            } catch (e: any) {
                              toast({ description: e?.message || 'Action failed', variant: 'destructive' })
                            }
                          }}
                          title={savedJobIds.has(job._id) ? 'Remove from Saved' : 'Save job'}
                        >
                          <Bookmark className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {job.salary}
                        </span>
                        <Badge variant="outline">{job.type}</Badge>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {job.postedAt}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{job.description}</p>

                      <div className="flex items-center gap-2">
                        {job.hasApplied ? (
                          <Button 
                            variant="outline" 
                            className="w-full sm:w-auto" 
                            disabled
                          >
                            Already Applied
                          </Button>
                        ) : (
                          <Button 
                            className="w-full sm:w-auto" 
                            onClick={() => handleApply(job._id)}
                          >
                            Apply Now
                            {appliedJobIds.has(job._id) && ' (Processing...)'}
                          </Button>
                        )}
                        <Button variant="outline" onClick={() => window.location.assign(`/dashboard/jobs/${job._id}`)}>View Details</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
