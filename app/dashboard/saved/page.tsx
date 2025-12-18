"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Home, Search, Briefcase, FileText, Bookmark, MapPin, DollarSign, Clock, BookmarkX } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home, current: false },
  { name: "Find Jobs", href: "/dashboard/jobs", icon: Search, current: false },
  { name: "Applications", href: "/dashboard/applications", icon: Briefcase, current: false },
  { name: "Profile", href: "/dashboard/profile", icon: FileText, current: false },
  { name: "Saved Jobs", href: "/dashboard/saved", icon: Bookmark, current: true },
]

type SavedItem = {
  _id: string
  jobId: string
  createdAt?: string
  job?: {
    _id?: string
    title?: string
    company?: any
    location?: string
    salaryMin?: number
    salaryMax?: number
    type?: string
    description?: string
    createdAt?: string
  }
}

export default function SavedJobsPage() {
  const pathname = usePathname()
  const { toast } = useToast()
  const [items, setItems] = useState<SavedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
        const res = await fetch('/api/saved', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const json = await res.json()
        if (mounted && res.ok && json?.ok) setItems(json.saved || [])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  return (
    <ProtectedRoute allowedRoles={["job_seeker"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-6">
          {/* Page Header */}
          <PageHeader title="Saved Jobs" description="Jobs you've bookmarked for later" />

          {/* Saved Jobs List */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Your Saved Jobs</CardTitle>
              <CardDescription>
                {items.length} {items.length === 1 ? "job" : "jobs"} saved
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2 text-sm text-muted-foreground">Loading…</div>
              ) : items.length === 0 ? (
                <EmptyState title="No saved jobs" description="Bookmark jobs to view and apply later." />
              ) : (
                <div className="space-y-4">
                  {items.map((s) => {
                    const job = s.job || {}
                    const id = String(s._id)
                    const company = typeof job.company === 'object' ? (job.company?.name || 'Unknown Company') : (job.company || 'Unknown Company')
                    const salary = (typeof job.salaryMin === 'number' && typeof job.salaryMax === 'number') ? `$${job.salaryMin} - $${job.salaryMax}` : undefined
                    const savedAt = s.createdAt ? new Date(s.createdAt).toDateString() : ''
                    return (
                    <div key={id} className="p-4 rounded-lg border border-border hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-foreground">{job.title || 'Saved Job'}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">{company}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Remove from Saved"
                          onClick={async () => {
                            try {
                              const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
                              if (!token) { toast({ description: 'Please log in', variant: 'destructive' }); return }
                              const res = await fetch(`/api/saved?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
                              const json = await res.json().catch(() => ({}))
                              if (!res.ok || json?.ok === false) throw new Error(json?.error || 'Failed to remove')
                              setItems((prev) => prev.filter(x => String(x._id) !== id))
                              toast({ description: 'Removed from Saved' })
                            } catch (e: any) {
                              toast({ description: e?.message || 'Failed to remove', variant: 'destructive' })
                            }
                          }}
                        >
                          <BookmarkX className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {job.location || '—'}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {salary || '—'}
                        </span>
                        <Badge variant="outline">{job.type || '—'}</Badge>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Saved {savedAt}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {job._id ? (
                          <>
                            <Button size="sm" onClick={() => window.location.assign(`/dashboard/jobs/${String(job._id)}`)}>Apply Now</Button>
                            <Button size="sm" variant="outline" onClick={() => window.location.assign(`/dashboard/jobs/${String(job._id)}`)}>View Details</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" disabled>Job Unavailable</Button>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
