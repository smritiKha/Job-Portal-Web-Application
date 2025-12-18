"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LayoutDashboard, Briefcase, Users, Calendar, Building2, Save } from "lucide-react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useEffect, useState, useRef } from "react"
import { PageHeader } from "@/components/page-header"
import { useToast } from "@/hooks/use-toast"
import { useEvents } from "@/hooks/use-events"
import { Upload } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/employer", icon: LayoutDashboard, current: false },
  { name: "My Jobs", href: "/employer/jobs", icon: Briefcase, current: false },
  { name: "Applicants", href: "/employer/applicants", icon: Users, current: false },
  { name: "Interviews", href: "/employer/interviews", icon: Calendar, current: false },
  { name: "Profile", href: "/employer/profile", icon: Building2, current: true },
]

export default function EmployerProfilePage() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { toast } = useToast()
  // View/Edit mode (default to view unless user explicitly chose edit)
  const [viewMode, setViewMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('employer_profile_view_mode') !== 'edit'
  })

  // Personal/contact
  const [name, setName] = useState<string>("")
  const [email, setEmail] = useState<string>("")
  const [phone, setPhone] = useState<string>("")
  const [location, setLocation] = useState<string>("")
  // Company profile
  const [companyName, setCompanyName] = useState<string>("")
  const [companyWebsite, setCompanyWebsite] = useState<string>("")
  const [companyLocation, setCompanyLocation] = useState<string>("")
  const [companyBio, setCompanyBio] = useState<string>("")
  const [companyLinkedin, setCompanyLinkedin] = useState<string>("")
  const [companyTwitter, setCompanyTwitter] = useState<string>("")
  const [companyFacebook, setCompanyFacebook] = useState<string>("")
  const [teamSize, setTeamSize] = useState<string>("")
  const [industry, setIndustry] = useState<string>("")
  const [benefits, setBenefits] = useState<string>("")
  const [hiringPreferences, setHiringPreferences] = useState<string>("")
  const [companyLogo, setCompanyLogo] = useState<string>("")
  const logoInputRef = useRef<HTMLInputElement | null>(null)
  const onPickLogo = () => logoInputRef.current?.click()
  const onLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      const upRes = await fetch('/api/profile/company-logo', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd })
      const upData = await upRes.json().catch(() => ({}))
      if (!upRes.ok || !upData?.ok || !upData?.url) throw new Error(upData?.error || 'Upload failed')
      const url = String(upData.url)
      setCompanyLogo(url)
      if (logoInputRef.current) logoInputRef.current.value = ''
    } catch (e: any) {
      toast({ description: e?.message || 'Upload failed', variant: 'destructive' })
    }
  }

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  async function loadProfile() {
    try {
      if (!user?.id) return
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      const res = await fetch(`/api/users/${user.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const data = await res.json()
      if (res.ok && data?.ok && data.user) {
        const u = data.user
        setName(String(u.name || ''))
        setEmail(String(u.email || ''))
        setPhone(String(u.phone || ''))
        setLocation(String(u.location || ''))
        setCompanyName(String(u.companyName || ''))
        setCompanyWebsite(String(u.companyWebsite || ''))
        setCompanyLocation(String(u.companyLocation || ''))
        setCompanyBio(String(u.companyBio || ''))
        setCompanyLinkedin(String(u.companyLinkedin || ''))
        setCompanyTwitter(String(u.companyTwitter || ''))
        setCompanyFacebook(String(u.companyFacebook || ''))
        setTeamSize(String(u.teamSize || ''))
        setIndustry(String(u.industry || ''))
        setBenefits(String(u.benefits || ''))
        setHiringPreferences(String(u.hiringPreferences || ''))
        setCompanyLogo(String(u.companyLogo || ''))
      }
    } catch {}
  }

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function saveProfile() {
    try {
      if (!user?.id) return
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      const body = {
        name,
        email,
        phone,
        location,
        companyName,
        companyWebsite,
        companyLocation,
        companyBio,
        companyLinkedin,
        companyTwitter,
        companyFacebook,
        teamSize,
        industry,
        benefits,
        hiringPreferences,
      }
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to save')
      toast({ description: 'Profile saved' })
      setViewMode(true)
      if (typeof window !== 'undefined') localStorage.setItem('employer_profile_view_mode', 'view')
      await loadProfile()
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to save', variant: 'destructive' })
    }
  }

  // React to realtime user.updated events
  useEvents({
    events: ['user.updated'],
    onEvent: (evt: MessageEvent) => {
      try {
        const ev = JSON.parse((evt as MessageEvent).data || '{}')
        const id = ev?.payload?.id
        if (user?.id && id === user.id) {
          loadProfile()
          toast({ description: 'Profile updated' })
        }
      } catch {}
    }
  })

  return (
    <ProtectedRoute allowedRoles={["employer"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Page Header */}
          <PageHeader title="Company Profile" description="Manage your company details and contact information" />

          {/* Header */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                <Avatar className="h-24 w-24 rounded-full overflow-hidden ring-1 ring-border">
                  <AvatarImage className="h-full w-full object-cover" src={companyLogo || "/placeholder-user.jpg"} alt={name} />
                  <AvatarFallback className="text-2xl">{name?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-foreground">{companyName || name}</h2>
                  <p className="text-muted-foreground">{email}</p>
                  <div className="flex items-center gap-2 mt-4">
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onLogoFileChange} />
                    <Button size="sm" variant="outline" onClick={onPickLogo}>
                      <Upload className="mr-2 h-4 w-4" />
                      Change Company Logo
                    </Button>
                    {viewMode ? (
                      <Button size="sm" variant="outline" onClick={() => { setViewMode(false); if (typeof window !== 'undefined') localStorage.setItem('employer_profile_view_mode', 'edit') }}>Edit Profile</Button>
                    ) : null}
                  </div>
                </div>
              </div>
              {companyLogo && (
                <div className="pt-3 text-sm text-muted-foreground">Current logo:
                  <span className="inline-block ml-2 align-middle">
                    <img src={companyLogo} alt="Company Logo" className="h-8 w-8 rounded" />
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Read-only summary when in view mode */}
          {viewMode && (
            <>
              <Card className="hover:shadow-sm transition-shadow">
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                  <CardDescription>Your saved personal details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="text-muted-foreground">Full Name</div>
                    <div className="font-medium text-foreground">{name || '—'}</div>
                    <div className="text-muted-foreground">Email</div>
                    <div className="font-medium text-foreground">{email || '—'}</div>
                    <div className="text-muted-foreground">Phone</div>
                    <div className="font-medium text-foreground">{phone || '—'}</div>
                    <div className="text-muted-foreground">Location</div>
                    <div className="font-medium text-foreground">{location || '—'}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-sm transition-shadow">
                <CardHeader>
                  <CardTitle>Company Details</CardTitle>
                  <CardDescription>Your saved organization profile</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="text-muted-foreground">Company Name</div>
                    <div className="font-medium text-foreground">{companyName || '—'}</div>
                    <div className="text-muted-foreground">Website</div>
                    <div className="font-medium text-foreground break-all">
                      {companyWebsite ? (<a className="underline" href={companyWebsite} target="_blank" rel="noopener noreferrer">{companyWebsite}</a>) : '—'}
                    </div>
                    <div className="text-muted-foreground">Company Location</div>
                    <div className="font-medium text-foreground">{companyLocation || '—'}</div>
                    <div className="text-muted-foreground">Industry</div>
                    <div className="font-medium text-foreground">{industry || '—'}</div>
                    <div className="text-muted-foreground">Team Size</div>
                    <div className="font-medium text-foreground">{teamSize || '—'}</div>
                    <div className="text-muted-foreground">LinkedIn</div>
                    <div className="font-medium text-foreground break-all">{companyLinkedin ? (<a className="underline" href={companyLinkedin} target="_blank" rel="noopener noreferrer">{companyLinkedin}</a>) : '—'}</div>
                    <div className="text-muted-foreground">Twitter/X</div>
                    <div className="font-medium text-foreground break-all">{companyTwitter ? (<a className="underline" href={companyTwitter} target="_blank" rel="noopener noreferrer">{companyTwitter}</a>) : '—'}</div>
                    <div className="text-muted-foreground">Facebook</div>
                    <div className="font-medium text-foreground break-all">{companyFacebook ? (<a className="underline" href={companyFacebook} target="_blank" rel="noopener noreferrer">{companyFacebook}</a>) : '—'}</div>
                  </div>
                  <div className="pt-2">
                    <div className="text-muted-foreground mb-1">About Company</div>
                    <div className="whitespace-pre-wrap text-foreground">{companyBio || '—'}</div>
                  </div>
                  <div className="pt-2">
                    <div className="text-muted-foreground mb-1">Benefits</div>
                    <div className="whitespace-pre-wrap text-foreground">{benefits || '—'}</div>
                  </div>
                  <div className="pt-2">
                    <div className="text-muted-foreground mb-1">Hiring Preferences</div>
                    <div className="whitespace-pre-wrap text-foreground">{hiringPreferences || '—'}</div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Company */}
          {!viewMode && (
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Company Details</CardTitle>
              <CardDescription>Keep your organization profile up to date</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyWebsite">Website</Label>
                  <Input id="companyWebsite" placeholder="https://" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyLocation">Company Location</Label>
                  <Input id="companyLocation" value={companyLocation} onChange={(e) => setCompanyLocation(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teamSize">Team Size</Label>
                  <Input id="teamSize" placeholder="e.g., 11-50" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="companyLinkedin">LinkedIn</Label>
                  <Input id="companyLinkedin" placeholder="https://linkedin.com/company/..." value={companyLinkedin} onChange={(e) => setCompanyLinkedin(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyTwitter">Twitter/X</Label>
                  <Input id="companyTwitter" placeholder="https://x.com/..." value={companyTwitter} onChange={(e) => setCompanyTwitter(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyFacebook">Facebook</Label>
                  <Input id="companyFacebook" placeholder="https://facebook.com/..." value={companyFacebook} onChange={(e) => setCompanyFacebook(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyBio">About Company</Label>
                <Textarea id="companyBio" rows={4} value={companyBio} onChange={(e) => setCompanyBio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="benefits">Benefits</Label>
                <Textarea id="benefits" rows={3} placeholder="List key benefits (one per line)" value={benefits} onChange={(e) => setBenefits(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hiringPreferences">Hiring Preferences</Label>
                <Textarea id="hiringPreferences" rows={3} placeholder="e.g., preferred skills, locations, experience" value={hiringPreferences} onChange={(e) => setHiringPreferences(e.target.value)} />
              </div>
            </CardContent>
          </Card>
          )}

          {/* Save (only in edit mode) */}
          {!viewMode && (
            <div className="flex items-center justify-end gap-4">
              <Button variant="outline" onClick={async () => { await loadProfile(); setViewMode(true); if (typeof window !== 'undefined') localStorage.setItem('employer_profile_view_mode', 'view'); toast({ description: 'Changes discarded' }) }}>Cancel</Button>
              <Button onClick={saveProfile}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
