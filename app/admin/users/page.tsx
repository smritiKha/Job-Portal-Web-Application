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
import { LayoutDashboard, Users, Briefcase, TrendingUp, Search, MoreVertical, UserX, Shield, Download, Filter } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useEvents } from "@/hooks/use-events"
import { useToast } from "@/hooks/use-toast"

const navigation = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard, current: false },
  { name: "Users", href: "/admin/users", icon: Users, current: true },
  { name: "Jobs", href: "/admin/jobs", icon: Briefcase, current: false },
  { name: "Reports", href: "/admin/reports", icon: TrendingUp, current: false },
]

type AdminUser = {
  _id: string
  name: string
  email: string
  role: string
  status?: string
  joinedAt?: string
  lastActive?: string
}

export default function AdminUsersPage() {
  const pathname = usePathname()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string>("")
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<string>("")
  const [editName, setEditName] = useState<string>("")
  const [editRole, setEditRole] = useState<'admin' | 'employer' | 'job_seeker'>("job_seeker")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmUserId, setConfirmUserId] = useState<string>("")
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'activate' | null>(null)
  const [confirmReason, setConfirmReason] = useState<string>("")
  const [roleFilter, setRoleFilter] = useState<'all'|'admin'|'employer'|'job_seeker'>("all")
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'suspended'|'pending'>("all")

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  const filteredUsers = users
    .filter((user) => user.name.toLowerCase().includes(searchQuery.toLowerCase()) || user.email.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((u) => roleFilter === 'all' ? true : u.role === roleFilter)
    .filter((u) => statusFilter === 'all' ? true : (u.status || 'active') === statusFilter)

  async function approveUser(id: string) {
    try {
      setUpdatingId(id)
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Approve failed')
      await refreshUsers()
      toast({ description: 'User approved' })
    } catch (e: any) {
      toast({ description: e?.message || 'Approve failed', variant: 'destructive' })
    } finally {
      setUpdatingId("")
    }
  }

  function exportCsv() {
    const rows = [
      ['Name','Email','Role','Status','Joined','Last Active'],
      ...filteredUsers.map(u => [u.name, u.email, u.role, u.status || 'active', u.joinedAt || '', u.lastActive || ''])
    ]
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'users.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function refreshUsers() {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (res.ok && data?.ok) {
        const mapped: AdminUser[] = (data.users || []).map((u: any) => ({
          _id: String(u._id),
          name: u.name || u.email?.split('@')[0] || 'User',
          email: u.email,
          role: u.role,
          status: u.status || 'active',
          joinedAt: u.createdAt ? new Date(u.createdAt).toDateString() : undefined,
          lastActive: u.lastActive,
        }))
        setUsers(mapped)
      }
    } catch {}
  }

  async function updateUser(id: string, body: any) {
    try {
      setUpdatingId(id)
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Update failed')
      await refreshUsers()
      toast({ description: 'User updated' })
    } catch (e: any) {
      toast({ description: e?.message || 'Update failed', variant: 'destructive' })
    } finally {
      setUpdatingId("")
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/users')
        const data = await res.json()
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load users')
        if (mounted) {
          const mapped: AdminUser[] = (data.users || []).map((u: any) => ({
            _id: String(u._id),
            name: u.name || u.email?.split('@')[0] || 'User',
            email: u.email,
            role: u.role,
            status: u.status || 'active',
            joinedAt: u.createdAt ? new Date(u.createdAt).toDateString() : undefined,
            lastActive: u.lastActive,
          }))
          setUsers(mapped)
        }

      } catch (e: any) {
        if (mounted) setError(e?.message || 'Error loading users')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Subscribe to platform events and refresh user list (proxy for changes)
  useEvents({
    events: ['job.created','job.updated','job.deleted','application.created','application.updated','application.deleted','application.status_changed','interview.created','user.created','user.updated'],
    onEvent: () => {
      ;(async () => {
        try {
          const res = await fetch('/api/users')
          const data = await res.json()
          if (res.ok && data?.ok) {
            const mapped: AdminUser[] = (data.users || []).map((u: any) => ({
              _id: String(u._id),
              name: u.name || u.email?.split('@')[0] || 'User',
              email: u.email,
              role: u.role,
              status: u.status || 'active',
              joinedAt: u.createdAt ? new Date(u.createdAt).toDateString() : undefined,
              lastActive: u.lastActive,
            }))
            setUsers(mapped)
            toast({ description: 'Users updated' })
          }
        } catch {}
      })()
    }
  })

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      admin: "default",
      employer: "secondary",
      job_seeker: "outline",
    }
    return (
      <Badge variant={variants[role] || "outline"}>
        {role === "job_seeker" ? "Job Seeker" : role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
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
            title="User Management"
            description="Manage all users across the platform"
            actions={
              <Button>
                <Shield className="mr-2 h-4 w-4" />
                Add Admin
              </Button>
            }
          />

          {/* Search and Filters */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>View and manage user accounts, roles, and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6 flex-wrap">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={roleFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setRoleFilter('all')}>All Roles</Button>
                  <Button variant={roleFilter === 'job_seeker' ? 'default' : 'outline'} size="sm" onClick={() => setRoleFilter('job_seeker')}>Job Seekers</Button>
                  <Button variant={roleFilter === 'employer' ? 'default' : 'outline'} size="sm" onClick={() => setRoleFilter('employer')}>Employers</Button>
                  <Button variant={roleFilter === 'admin' ? 'default' : 'outline'} size="sm" onClick={() => setRoleFilter('admin')}>Admins</Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>All Status</Button>
                  <Button variant={statusFilter === 'active' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('active')}>Active</Button>
                  <Button variant={statusFilter === 'suspended' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('suspended')}>Suspended</Button>
                  <Button variant={statusFilter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('pending')}>Pending</Button>
                </div>
                <div className="ml-auto">
                  <Button variant="outline" size="sm" onClick={exportCsv}>
                    <Download className="mr-2 h-4 w-4" /> Export CSV
                  </Button>
                </div>
              </div>

              {/* Users Table */}
              {loading ? (
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <div className="space-y-1">
                              <Skeleton className="h-4 w-40" />
                              <Skeleton className="h-3 w-56" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-6 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-5 w-20" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="h-8 w-8 ml-auto" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : filteredUsers.length === 0 ? (
                <EmptyState title="No users found" description="Try another search query." />
              ) : (
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user._id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{user.name}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getRoleBadge(user.role)}</TableCell>
                          <TableCell>{getStatusBadge(user.status || 'active')}</TableCell>
                          <TableCell className="text-muted-foreground">{user.joinedAt}</TableCell>
                          <TableCell className="text-muted-foreground">{user.lastActive}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => {
                                  setEditId(user._id)
                                  setEditName(user.name)
                                  setEditRole((user.role as any) || 'job_seeker')
                                  setEditOpen(true)
                                }}>Edit User</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {user.status === 'pending' && (
                                  <DropdownMenuItem onClick={() => approveUser(user._id)} disabled={!!updatingId}>
                                    Approve User
                                  </DropdownMenuItem>
                                )}
                                {user.status === "active" ? (
                                  <DropdownMenuItem className="text-destructive" onClick={() => { setConfirmUserId(user._id); setConfirmAction('suspend'); setConfirmReason(''); setConfirmOpen(true) }}>
                                    <UserX className="mr-2 h-4 w-4" />
                                    Suspend User
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => { setConfirmUserId(user._id); setConfirmAction('activate'); setConfirmReason(''); setConfirmOpen(true) }}>Activate User</DropdownMenuItem>
                                )}
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
          {/* Edit User Modal */}
          {editOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-lg bg-background border border-border p-4 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Edit User</h3>
                  <p className="text-sm text-muted-foreground">Update name and role.</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium mb-1">Name</div>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Role</div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant={editRole === 'job_seeker' ? 'default' : 'outline'} onClick={() => setEditRole('job_seeker')}>Job Seeker</Button>
                      <Button type="button" size="sm" variant={editRole === 'employer' ? 'default' : 'outline'} onClick={() => setEditRole('employer')}>Employer</Button>
                      <Button type="button" size="sm" variant={editRole === 'admin' ? 'default' : 'outline'} onClick={() => setEditRole('admin')}>Admin</Button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                  <Button onClick={async () => {
                    if (!editId) return
                    await updateUser(editId, { name: editName, role: editRole })
                    setEditOpen(false)
                    setEditId("")
                  }} disabled={!!updatingId}>
                    {updatingId ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {/* Confirm Suspend/Activate Modal */}
          {confirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-lg bg-background border border-border p-4 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{confirmAction === 'suspend' ? 'Suspend User' : 'Activate User'}</h3>
                  <p className="text-sm text-muted-foreground">{confirmAction === 'suspend' ? 'Optionally provide a reason for suspension.' : 'Optionally provide a note for activation.'}</p>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Reason (optional)</div>
                  <Input value={confirmReason} onChange={(e) => setConfirmReason(e.target.value)} placeholder={confirmAction === 'suspend' ? 'Violation of terms…' : 'Manual activation…'} />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                  <Button onClick={async () => {
                    if (!confirmUserId || !confirmAction) return
                    const status = confirmAction === 'suspend' ? 'suspended' : 'active'
                    await updateUser(confirmUserId, { status, reason: confirmReason })
                    setConfirmOpen(false)
                    setConfirmUserId('')
                    setConfirmAction(null)
                    setConfirmReason('')
                  }} disabled={!!updatingId}>
                    {updatingId ? 'Saving…' : 'Confirm'}
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
