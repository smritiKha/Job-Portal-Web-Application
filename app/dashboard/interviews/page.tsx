"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Home, Search, Briefcase, BookOpen, FileText, Calendar, MapPin, Video, Link as LinkIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth-context"
import { useEvents } from "@/hooks/use-events"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home, current: false },
  { name: "Find Jobs", href: "/dashboard/jobs", icon: Search, current: false },
  { name: "Applications", href: "/dashboard/applications", icon: Briefcase, current: false },
  { name: "Training", href: "/dashboard/training", icon: BookOpen, current: false },
  { name: "Profile", href: "/dashboard/profile", icon: FileText, current: false },
]

type InterviewItem = {
  _id: string
  applicationId: string
  scheduledAt: string
  mode?: 'onsite' | 'remote'
  notes?: string
}

export default function InterviewsPage() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [items, setItems] = useState<InterviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const updatedNav = useMemo(() => navigation.map((i) => ({ ...i, current: i.href === pathname })), [pathname])

  async function load() {
    try {
      setLoading(true)
      const token = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
      const res = await fetch('/api/interviews', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load interviews')
      const items: InterviewItem[] = (data.interviews || []).map((d: any) => ({
        _id: String(d._id),
        applicationId: String(d.applicationId),
        scheduledAt: d.scheduledAt,
        mode: d.mode,
        notes: d.notes,
      }))
      setItems(items)
    } catch (e: any) {
      setError(e?.message || 'Error loading interviews')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEvents({
    events: ['interview.created','interview.updated','interview.deleted'],
    onEvent: () => { load() }
  })

  const upcoming = items.filter(i => new Date(i.scheduledAt).getTime() >= Date.now()).sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  const past = items.filter(i => new Date(i.scheduledAt).getTime() < Date.now()).sort((a,b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())

  function addToCalendar(it: InterviewItem) {
    try {
      const dt = new Date(it.scheduledAt)
      const pad = (n: number) => String(n).padStart(2, '0')
      const toICSDate = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
      const dtStart = toICSDate(dt)
      const dtEnd = toICSDate(new Date(dt.getTime() + 60*60*1000))
      const summary = `Interview`
      const description = `Scheduled interview${it.mode ? ' | Mode: ' + it.mode : ''}${it.notes ? ' | Details: ' + it.notes : ''}`
      const location = it.notes || ''
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Job Portal//Interview//EN',
        'BEGIN:VEVENT',
        `UID:${it._id}@job-portal`,
        `DTSTAMP:${dtStart}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${summary.replace(/\n/g,' ')}`,
        `DESCRIPTION:${description.replace(/\n/g,' ')}`,
        `LOCATION:${location.replace(/\n/g,' ')}`,
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n')
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `interview-${it._id}.ics`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {}
  }

  return (
    <ProtectedRoute allowedRoles={["job_seeker"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-6">
          <PageHeader title="Interviews" description="View your upcoming and past interviews" />

          {loading ? (
            <Card>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming</CardTitle>
                  <CardDescription>Interviews scheduled in the future</CardDescription>
                </CardHeader>
                <CardContent>
                  {upcoming.length === 0 ? (
                    <EmptyState title="No upcoming interviews" description="Your scheduled interviews will appear here." />
                  ) : (
                    <div className="space-y-3">
                      {upcoming.map(it => (
                        <div key={it._id} className="p-3 rounded-lg border border-border">
                          <div className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> {new Date(it.scheduledAt).toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1">{it.mode === 'remote' ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />} {it.mode || '—'}</span>
                            {it.notes && (
                              <span className="inline-flex items-center gap-1"><LinkIcon className="h-3.5 w-3.5" /> {it.notes}</span>
                            )}
                          </div>
                          <div className="pt-2 flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => addToCalendar(it)}>Add to Calendar</Button>
                            {it.notes && /^(https?:\/\/)/i.test(it.notes) && (
                              <Button size="sm" variant="secondary" onClick={() => window.open(it.notes!, '_blank')}>Open Link</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Past</CardTitle>
                  <CardDescription>Interviews that have already occurred</CardDescription>
                </CardHeader>
                <CardContent>
                  {past.length === 0 ? (
                    <EmptyState title="No past interviews" description="Completed interviews will appear here." />
                  ) : (
                    <div className="space-y-3">
                      {past.map(it => (
                        <div key={it._id} className="p-3 rounded-lg border border-border">
                          <div className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> {new Date(it.scheduledAt).toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1">{it.mode === 'remote' ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />} {it.mode || '—'}</span>
                            {it.notes && (
                              <span className="inline-flex items-center gap-1"><LinkIcon className="h-3.5 w-3.5" /> {it.notes}</span>
                            )}
                          </div>
                          <div className="pt-2">
                            <Button size="sm" variant="outline" onClick={() => addToCalendar(it)}>Add to Calendar</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
