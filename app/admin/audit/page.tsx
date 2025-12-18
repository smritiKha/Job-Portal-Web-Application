"use client"

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LayoutDashboard, Briefcase, Users, TrendingUp, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert } from '@/components/ui/alert'
import { useEvents } from '@/hooks/use-events'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const navigation = [
  { name: 'Admin', href: '/admin', icon: LayoutDashboard, current: false },
  { name: 'Jobs', href: '/admin/jobs', icon: Briefcase, current: false },
  { name: 'Users', href: '/admin/users', icon: Users, current: false },
  { name: 'Reports', href: '/admin/reports', icon: TrendingUp, current: false },
  { name: 'Audit Logs', href: '/admin/audit', icon: Shield, current: true },
]

type AuditLog = {
  _id?: string
  actorId: string
  actorRole: string
  action: string
  targetType: string
  targetId?: string
  meta?: Record<string, any>
  createdAt: string
  actorUser?: { _id?: string; name?: string; email?: string }
}

export default function AdminAuditLogsPage() {
  const pathname = usePathname()
  const { toast } = useToast()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const [actorId, setActorId] = useState('')
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [targetId, setTargetId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [indexing, setIndexing] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null)
  const actionsQuick = ['job_approve','job_reject','job_close','application_update','file_proxy_access']
  const [activeQuickAction, setActiveQuickAction] = useState<string>('')
  const [activeQuickRange, setActiveQuickRange] = useState<string>('')

  const updatedNav = navigation.map((item) => ({ ...item, current: item.href === pathname }))

  async function fetchLogs(nextPage = 1, keepPage = false) {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(keepPage ? page : nextPage))
      params.set('limit', String(limit))
      if (actorId) params.set('actorId', actorId)
      if (action) params.set('action', action)
      if (targetType) params.set('targetType', targetType)
      if (targetId) params.set('targetId', targetId)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load logs')
      setLogs(data.logs || [])
      setPage(data.page || nextPage)
      setTotal(data.total || 0)
      setHasMore(Boolean(data.hasMore))
    } catch (e: any) {
      setError(e?.message || 'Error loading logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Subscribe to platform events and refresh audit logs automatically
  useEvents({
    events: ['job.created','job.updated','job.deleted','application.created','application.updated','application.deleted','application.status_changed','interview.created'],
    onEvent: () => {
      fetchLogs(page, true)
      toast({ description: 'Audit logs updated' })
    }
  })

  function exportCsv() {
    const rows: string[][] = [[
      'Time','ActorName','ActorEmail','ActorId','ActorRole','Action','TargetType','TargetId','Meta'
    ]]
    for (const l of logs) {
      const actorName = l.actorUser?.name || ''
      const actorEmail = l.actorUser?.email || ''
      rows.push([
        l.createdAt ? new Date(l.createdAt).toISOString() : '',
        actorName,
        actorEmail,
        String(l.actorId || ''),
        String(l.actorRole || ''),
        String(l.action || ''),
        String(l.targetType || ''),
        String(l.targetId || ''),
        JSON.stringify(l.meta || {}),
      ])
    }
    const csv = rows.map(r => r.map(cell => '"' + String(cell).replace(/"/g,'""') + '"').join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filterChips = useMemo(() => {
    const chips: string[] = []
    if (actorId) chips.push(`actorId:${actorId}`)
    if (action) chips.push(`action:${action}`)
    if (targetType) chips.push(`targetType:${targetType}`)
    if (targetId) chips.push(`targetId:${targetId}`)
    if (from) chips.push(`from:${from}`)
    if (to) chips.push(`to:${to}`)
    return chips
  }, [actorId, action, targetType, targetId, from, to])

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-6">
          <PageHeader title="Audit Logs" description="Monitor administrative actions and file access" />

          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Search and filter audit events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input placeholder="Actor ID" value={actorId} onChange={(e) => setActorId(e.target.value)} />
                <Input placeholder="Action (e.g. job_approve)" value={action} onChange={(e) => setAction(e.target.value)} />
                <Input placeholder="Target Type (e.g. job/file/application)" value={targetType} onChange={(e) => setTargetType(e.target.value)} />
                <Input placeholder="Target ID" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">From</label>
                  <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">To</label>
                  <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => fetchLogs(1)}>Apply Filters</Button>
                <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
                <Button
                  variant="outline"
                  disabled={indexing}
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
                >
                  {indexing ? 'Initializing…' : 'Initialize Indexes'}
                </Button>
                <Select value={String(limit)} onValueChange={(v) => { setLimit(parseInt(v, 10)); fetchLogs(1) }}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Page Size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / page</SelectItem>
                    <SelectItem value="20">20 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                    <SelectItem value="100">100 / page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Quick Filters */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Quick Actions:</span>
                  {actionsQuick.map(a => (
                    <Button
                      key={a}
                      size="sm"
                      variant={activeQuickAction === a ? 'default' : 'outline'}
                      onClick={() => {
                        const next = activeQuickAction === a ? '' : a
                        setActiveQuickAction(next)
                        setAction(next)
                        fetchLogs(1)
                      }}
                    >
                      {a}
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => { setActiveQuickAction(''); setAction(''); fetchLogs(1) }}>Clear</Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Date Range:</span>
                  {[
                    { key: '24h', ms: 24*60*60*1000 },
                    { key: '7d', ms: 7*24*60*60*1000 },
                    { key: '30d', ms: 30*24*60*60*1000 },
                  ].map(r => (
                    <Button
                      key={r.key}
                      size="sm"
                      variant={activeQuickRange === r.key ? 'default' : 'outline'}
                      onClick={() => {
                        const now = new Date()
                        const fromDt = new Date(Date.now() - r.ms)
                        const toStr = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,16)
                        const fromStr = new Date(fromDt.getTime() - fromDt.getTimezoneOffset()*60000).toISOString().slice(0,16)
                        const next = activeQuickRange === r.key ? '' : r.key
                        setActiveQuickRange(next)
                        if (next) {
                          setFrom(fromStr)
                          setTo(toStr)
                        } else {
                          setFrom('')
                          setTo('')
                        }
                        fetchLogs(1)
                      }}
                    >
                      {r.key}
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => { setActiveQuickRange(''); setFrom(''); setTo(''); fetchLogs(1) }}>Clear</Button>
                </div>
              </div>
              {filterChips.length > 0 && (
                <div className="text-xs text-muted-foreground">Active: {filterChips.join(' • ')}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>Latest events first</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : error ? (
                <Alert>{error}</Alert>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">Time</th>
                          <th className="text-left p-2">Actor</th>
                          <th className="text-left p-2">Role</th>
                          <th className="text-left p-2">Action</th>
                          <th className="text-left p-2">Target</th>
                          <th className="text-left p-2">Meta</th>
                          <th className="text-left p-2">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((l, idx) => (
                          <tr key={(l._id || idx) + ''} className="border-t">
                            <td className="p-2 whitespace-nowrap">{l.createdAt ? new Date(l.createdAt).toLocaleString() : '-'}</td>
                            <td className="p-2">
                              <div className="flex flex-col">
                                <span>{l.actorUser?.name || l.actorUser?.email || l.actorId}</span>
                                <span className="text-muted-foreground text-xs">{l.actorId}</span>
                              </div>
                            </td>
                            <td className="p-2">{l.actorRole}</td>
                            <td className="p-2">{l.action}</td>
                            <td className="p-2">
                              <div className="flex flex-col">
                                <span>{l.targetType}</span>
                                <span className="text-muted-foreground text-xs">{l.targetId}</span>
                              </div>
                            </td>
                            <td className="p-2 max-w-[360px]">
                              <code className="text-xs break-words">{JSON.stringify(l.meta || {})}</code>
                            </td>
                            <td className="p-2">
                              <Button variant="ghost" size="sm" onClick={() => { setDetailLog(l); setDetailOpen(true) }}>View</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div>Page {page} • Showing {logs.length} of {total}</div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => fetchLogs(page - 1, true)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={!hasMore || loading} onClick={() => fetchLogs(page + 1, true)}>Next</Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Log Detail Dialog */}
          <AlertDialog open={detailOpen} onOpenChange={setDetailOpen}>
            <AlertDialogContent className="max-w-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Audit Event Details</AlertDialogTitle>
                <AlertDialogDescription>Full context for this audit entry</AlertDialogDescription>
              </AlertDialogHeader>
              {detailLog && (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="font-medium">Time:</span> {detailLog.createdAt ? new Date(detailLog.createdAt).toLocaleString() : '-'}</div>
                    <div><span className="font-medium">Action:</span> {detailLog.action}</div>
                    <div><span className="font-medium">Actor:</span> {detailLog.actorUser?.name || detailLog.actorUser?.email || detailLog.actorId}</div>
                    <div><span className="font-medium">Actor ID:</span> {detailLog.actorId}</div>
                    <div><span className="font-medium">Role:</span> {detailLog.actorRole}</div>
                    <div><span className="font-medium">Target:</span> {detailLog.targetType} • {detailLog.targetId}</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">Metadata</span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(JSON.stringify(detailLog.meta || {}, null, 2))
                              toast({ title: 'Copied', description: 'Metadata copied to clipboard' })
                            } catch {}
                          }}
                        >
                          Copy Meta
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(JSON.stringify(detailLog, null, 2))
                              toast({ title: 'Copied', description: 'Full log copied to clipboard' })
                            } catch {}
                          }}
                        >
                          Copy Full
                        </Button>
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3 text-xs">{JSON.stringify(detailLog.meta || {}, null, 2)}</pre>
                  </div>
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
