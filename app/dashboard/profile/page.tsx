"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Home, Search, Briefcase, FileText, Bookmark, Plus, X, Upload, Save, BookOpen } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useEffect, useMemo, useRef, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { useToast } from "@/hooks/use-toast"
import { useEvents } from "@/hooks/use-events"
import { DREAM_JOBS } from "@/lib/constants/dream-jobs"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home, current: false },
  { name: "Find Jobs", href: "/dashboard/jobs", icon: Search, current: false },
  { name: "Applications", href: "/dashboard/applications", icon: Briefcase, current: false },
  { name: "Training", href: "/dashboard/training", icon: BookOpen, current: false },
  { name: "Profile", href: "/dashboard/profile", icon: FileText, current: true },
  { name: "Saved Jobs", href: "/dashboard/saved", icon: Bookmark, current: false },
]

export default function ProfilePage() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState("")
  const suggestedSkills = [
    'JavaScript','TypeScript','React','Next.js','Node.js','Express','Redux','Tailwind CSS','GraphQL','REST APIs','Docker','Kubernetes','AWS','MongoDB','PostgreSQL','SQL','CI/CD','Testing','Jest','Cypress','System Design'
  ]
  const { toast } = useToast()
  const [firstName, setFirstName] = useState<string>(user?.name?.split(" ")[0] || "")
  const [lastName, setLastName] = useState<string>(user?.name?.split(" ")[1] || "")
  const [email, setEmail] = useState<string>(user?.email || "")
  const [phone, setPhone] = useState<string>("")
  const [location, setLocation] = useState<string>("")
  const [title, setTitle] = useState<string>("")
  const [bio, setBio] = useState<string>("")
  const [salaryExpectation, setSalaryExpectation] = useState<string>("")
  const [dreamJob, setDreamJob] = useState<string>("")
  const [dreamJobId, setDreamJobId] = useState<string>("")
  const [isFresher, setIsFresher] = useState<boolean>(false)
  const [openToInternships, setOpenToInternships] = useState<boolean>(false)
  const [availabilityStartDate, setAvailabilityStartDate] = useState<string>("")
  const [preferredInternshipDuration, setPreferredInternshipDuration] = useState<string>("")
  const [avatarUrl, setAvatarUrl] = useState<string>(user?.avatar || "/placeholder-user.jpg")
  const [experiences, setExperiences] = useState<Array<{ title: string; company: string; start: string; end: string; description: string }>>([])
  const [education, setEducation] = useState<Array<{ degree: string; school: string; start: string; end: string; description: string }>>([])
  const [resume, setResume] = useState<{ url?: string; name?: string; id?: string } | null>(null)
  const [resumes, setResumes] = useState<Array<{ id: string; url: string; name: string; uploadedAt?: string }>>([])
  const [docCover, setDocCover] = useState<{ url?: string; name?: string } | null>(null)
  const [docPortfolio, setDocPortfolio] = useState<{ url?: string; name?: string } | null>(null)
  const [docCertificates, setDocCertificates] = useState<Array<{ url: string; name: string }>>([])
  const [docOther, setDocOther] = useState<Array<{ url: string; name: string }>>([])
  const [uploadCategory, setUploadCategory] = useState<'resume' | 'coverletter' | 'portfolio' | 'certificate' | 'other'>('resume')
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [projects, setProjects] = useState<Array<{ name: string; role: string; link: string; start: string; end: string; description: string; tech: string }>>([])
  const [certifications, setCertifications] = useState<Array<{ name: string; issuer: string; date: string; credentialId: string; link: string }>>([])
  const [authToken, setAuthToken] = useState<string>("")
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [showSave, setShowSave] = useState<boolean>(true)
  const [uploadBusy, setUploadBusy] = useState<boolean>(false)
  const [uploadStatus, setUploadStatus] = useState<string>("")
  const [viewMode, setViewMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    // Default to view mode unless the user explicitly switched to edit last time
    return localStorage.getItem('profile_view_mode') !== 'edit'
  })
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const docsInputRef = useRef<HTMLInputElement | null>(null)
  const onPickPhoto = () => fileInputRef.current?.click()
  const onPickDocs = () => docsInputRef.current?.click()
  const onAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Upload failed')
      setAvatarUrl(String(data.url))
      toast({ description: 'Photo updated' })
      // Clear the input so selecting the same file again triggers change
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e: any) {
      toast({ description: e?.message || 'Upload failed', variant: 'destructive' })
    }
  }

  // Handle category-based multi-file upload via /api/upload
  const onUploadDocuments = async () => {
    try {
      if (!uploadFiles.length) { toast({ description: 'Please select one or more files to upload.' }); return }
      if (!user?.id) { toast({ description: 'Please sign in to upload documents.', variant: 'destructive' }); return }
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      if (!token) { toast({ description: 'Your session expired. Please log in again.', variant: 'destructive' }); return }
      setUploadBusy(true)
      setUploadStatus('Uploading...')
      const maxBytes = 10 * 1024 * 1024
      let uploadedCount = 0
      for (const f of uploadFiles) {
        if (f.size > maxBytes) {
          throw new Error(`File "${f.name}" is too large (max 10MB)`) 
        }
        const fd = new FormData()
        fd.append('file', f)
        fd.append('category', uploadCategory)
        const res = await fetch('/api/upload', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Upload failed')
        uploadedCount++
      }
      toast({ description: `Uploaded ${uploadedCount} document${uploadedCount > 1 ? 's' : ''}.` })
      setUploadStatus('Upload complete')
      setUploadFiles([])
      await fetchProfile()
    } catch (e: any) {
      toast({ description: e?.message || 'Upload failed', variant: 'destructive' })
      setUploadStatus(`Upload failed: ${e?.message || 'Unknown error'}`)
    }
    finally {
      setUploadBusy(false)
    }
  }

  const onRemoveResume = async (id?: string) => {
    try {
      const ok = typeof window === 'undefined' ? true : window.confirm('Remove this document? This cannot be undone.')
      if (!ok) return
      const url = id ? `/api/profile/resume?id=${encodeURIComponent(id)}` : '/api/profile/resume'
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      const res = await fetch(url, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Failed to remove resume')
      setResume({ url: '', name: '' } as any)
      await fetchProfile()
      toast({ description: 'Document removed' })
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to remove resume', variant: 'destructive' })
    }
  }

  const onSetDefaultResume = async (id: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      const res = await fetch('/api/profile/resume', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id })
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to set default')
      await fetchProfile()
      toast({ description: 'Default document updated' })
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to set default', variant: 'destructive' })
    }
  }

  // Projects handlers
  const addProject = () => setProjects(prev => [...prev, { name: '', role: '', link: '', start: '', end: '', description: '', tech: '' }])
  const removeProject = (idx: number) => setProjects(prev => prev.filter((_, i) => i !== idx))
  const updateProject = (idx: number, key: keyof (typeof projects)[number], value: string) => {
    setProjects(prev => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p))
  }

  // Certifications handlers
  const addCertification = () => setCertifications(prev => [...prev, { name: '', issuer: '', date: '', credentialId: '', link: '' }])
  const removeCertification = (idx: number) => setCertifications(prev => prev.filter((_, i) => i !== idx))
  const updateCertification = (idx: number, key: keyof (typeof certifications)[number], value: string) => {
    setCertifications(prev => prev.map((c, i) => i === idx ? { ...c, [key]: value } : c))
  }

  // Basic validation
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')
  const isValidUrl = (v: string) => {
    if (!v) return true
    try { new URL(v); return true } catch { return false }
  }
  const invalidProjectLinks = projects.some(p => p.link && !isValidUrl(p.link))
  const invalidCertificationLinks = certifications.some(c => c.link && !isValidUrl(c.link))
  const saveDisabled = !emailValid || invalidProjectLinks || invalidCertificationLinks

  async function fetchProfile() {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      setFirstName(user?.name?.split(" ")[0] || "")
      setLastName(user?.name?.split(" ")[1] || "")
      setEmail(user?.email || "")
      if (!user?.id) return
      const res = await fetch(`/api/users/${user.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const data = await res.json()
      if (res.ok && data?.ok && data.user) {
        const u = data.user
        const n = String(u.name || '')
        const parts = n.split(' ')
        setFirstName(parts[0] || '')
        setLastName(parts.slice(1).join(' ') || '')
        setEmail(String(u.email || ''))
        setPhone(String(u.phone || ''))
        setLocation(String(u.location || ''))
        setTitle(String(u.title || ''))
        setBio(String(u.bio || ''))
        setSalaryExpectation(String((u as any).salaryExpectation || ''))
        setDreamJob(String((u as any).dreamJob || ''))
        setDreamJobId(String((u as any).dreamJobId || ''))
        setIsFresher(Boolean((u as any).isFresher || false))
        setOpenToInternships(Boolean((u as any).openToInternships || false))
        setAvailabilityStartDate(String((u as any).availabilityStartDate || ''))
        setPreferredInternshipDuration(String((u as any).preferredInternshipDuration || ''))
        setSkills(Array.isArray(u.skills) ? u.skills : [])
        setAvatarUrl(String(u.avatar || '/placeholder.svg'))
        setExperiences(Array.isArray(u.experiences) ? u.experiences.map((e: any) => ({
          title: String(e.title || ''),
          company: String(e.company || ''),
          start: String(e.start || ''),
          end: String(e.end || ''),
          description: String(e.description || '')
        })) : [])
        setEducation(Array.isArray(u.education) ? u.education.map((e: any) => ({
          degree: String(e.degree || ''),
          school: String(e.school || ''),
          start: String(e.start || ''),
          end: String(e.end || ''),
          description: String(e.description || '')
        })) : [])
        setProjects(Array.isArray(u.projects) ? u.projects.map((p: any) => ({
          name: String(p.name || ''),
          role: String(p.role || ''),
          link: String(p.link || ''),
          start: String(p.start || ''),
          end: String(p.end || ''),
          description: String(p.description || ''),
          tech: Array.isArray(p.tech) ? p.tech.join(', ') : String(p.tech || '')
        })) : [])
        setCertifications(Array.isArray(u.certifications) ? u.certifications.map((c: any) => ({
          name: String(c.name || ''),
          issuer: String(c.issuer || ''),
          date: String(c.date || ''),
          credentialId: String(c.credentialId || ''),
          link: String(c.link || '')
        })) : [])
        const r = (u.documents && u.documents.resume) ? u.documents.resume : null
        setResume(r ? { id: String(r._id || ''), url: String(r.url || ''), name: String(r.name || 'Resume') } : null)
        const arr = Array.isArray(u.documents?.resumes) ? u.documents.resumes : []
        setResumes(arr.map((it: any) => ({ id: String(it._id || ''), url: String(it.url || ''), name: String(it.name || 'Resume'), uploadedAt: it.uploadedAt })))
        setDocCover(u.documents?.coverLetter ? { url: String(u.documents.coverLetter.url || ''), name: String(u.documents.coverLetter.name || 'Cover Letter') } : null)
        setDocPortfolio(u.documents?.portfolio ? { url: String(u.documents.portfolio.url || ''), name: String(u.documents.portfolio.name || 'Portfolio') } : null)
        setDocCertificates(Array.isArray(u.documents?.certificates) ? u.documents.certificates.map((c: any) => ({ url: String(c.url || ''), name: String(c.name || 'Certificate') })) : [])
        setDocOther(Array.isArray(u.documents?.other) ? u.documents.other.map((o: any) => ({ url: String(o.url || ''), name: String(o.name || 'Document') })) : [])
      }
    } catch {}
  }

  useEffect(() => {
    // Initialize when auth user changes (e.g., after login)
    fetchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Read JWT token for file proxy links (anchor clicks don't include Authorization headers)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const t = localStorage.getItem('job_portal_token') || ''
      setAuthToken(t)
    }
  }, [])

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  // Dynamic profile strength calculation (focus on essentials)
  const { profileStrength, requiredRemaining } = useMemo(() => {
    const essentials: Array<{ label: string; ok: boolean }> = [
      { label: 'Email', ok: !!email },
      { label: 'Headline', ok: !!title || !!dreamJob },
      { label: 'Bio', ok: !!bio },
      { label: 'Skills (3+)', ok: (skills.filter(Boolean).length >= 3) },
      { label: 'Supporting document', ok: !!resume?.url },
      { label: 'Experience or Education', ok: (experiences.length > 0 || education.length > 0) },
    ]
    const completed = essentials.filter(e => e.ok).length
    const total = essentials.length
    const pct = Math.min(100, Math.max(0, Math.round((completed / total) * 100)))
    const remaining = essentials.filter(e => !e.ok).map(e => e.label)
    return { profileStrength: pct, requiredRemaining: remaining }
  }, [email, title, dreamJob, bio, skills, resume?.url, experiences.length, education.length])

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()])
      setNewSkill("")
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter((skill) => skill !== skillToRemove))
  }

  const saveProfile = async () => {
    try {
      if (!user?.id) {
        toast({ description: 'Not signed in. Please log in again.', variant: 'destructive' })
        return
      }
      setIsSaving(true)
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      if (!token) {
        toast({ description: 'Session expired. Please log in again.', variant: 'destructive' })
        return
      }
      
      // First save the dream job using the dedicated endpoint
      if (dreamJobId) {
        const dreamJobRes = await fetch('/api/profile/dream-job', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            userId: user.id,
            jobId: dreamJobId
          })
        });
        
        if (!dreamJobRes.ok) {
          const error = await dreamJobRes.json().catch(() => ({}));
          throw new Error(error.error || 'Failed to save dream job');
        }
      }
      
      // Then save the rest of the profile
      const name = [firstName, lastName].filter(Boolean).join(" ")
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          location,
          title,
          bio,
          salaryExpectation,
          isFresher,
          openToInternships,
          availabilityStartDate,
          preferredInternshipDuration,
          skills,
          experiences,
          education,
          projects: projects.map(p => ({
            name: p.name,
            role: p.role,
            link: p.link,
            start: p.start,
            end: p.end,
            description: p.description,
            tech: p.tech.split(',').map(s => s.trim()).filter(Boolean)
          })),
          certifications,
        }),
      })
      
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to save profile')
      
      await fetchProfile()
      toast({ description: 'Profile saved successfully' })
      setShowSave(false)
      setViewMode(true)
      if (typeof window !== 'undefined') localStorage.setItem('profile_view_mode', 'view')
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to save profile', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  // Listen for user.updated SSE events and refresh fields if this user was updated elsewhere
  useEvents({
    events: ['user.updated'],
    onEvent: (evt: MessageEvent) => {
      try {
        const ev = JSON.parse((evt as MessageEvent).data || '{}')
        const id = ev?.payload?.id
        if (user?.id && id === user.id) {
          ;(async () => { await fetchProfile(); toast({ description: 'Profile updated' }) })()
        }
      } catch {}
    }
  })

  // Handlers for dynamic Experience
  const addExperience = () => setExperiences(prev => [...prev, { title: '', company: '', start: '', end: '', description: '' }])
  const removeExperience = (idx: number) => setExperiences(prev => prev.filter((_, i) => i !== idx))
  const updateExperience = (idx: number, key: keyof (typeof experiences)[number], value: string) => {
    setExperiences(prev => prev.map((e, i) => i === idx ? { ...e, [key]: value } : e))
  }

  // Handlers for dynamic Education
  const addEducation = () => setEducation(prev => [...prev, { degree: '', school: '', start: '', end: '', description: '' }])
  const removeEducation = (idx: number) => setEducation(prev => prev.filter((_, i) => i !== idx))
  const updateEducation = (idx: number, key: keyof (typeof education)[number], value: string) => {
    setEducation(prev => prev.map((e, i) => i === idx ? { ...e, [key]: value } : e))
  }

  // Resume upload
  const resumeInputRef = useRef<HTMLInputElement | null>(null)
  const onPickResume = () => resumeInputRef.current?.click()
  const onResumeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Client-side validation
    const maxBytes = 5 * 1024 * 1024 // 5MB
    const allowedExt = ["pdf", "doc", "docx"]
    const name = file.name || ""
    const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : ''
    if (!ext || !allowedExt.includes(ext)) {
      toast({ description: 'Only PDF/DOC/DOCX are allowed', variant: 'destructive' })
      if (resumeInputRef.current) resumeInputRef.current.value = ''
      return
    }
    if (file.size > maxBytes) {
      toast({ description: 'File is too large (max 5MB)', variant: 'destructive' })
      if (resumeInputRef.current) resumeInputRef.current.value = ''
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : ''
      const res = await fetch('/api/profile/resume', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Upload failed')
      setResume({ url: String(data.resume?.url || ''), name: String(data.resume?.name || file.name) })
      toast({ description: 'Resume uploaded' })
      // Re-fetch profile from DB to ensure UI reflects persisted state immediately
      await fetchProfile()
      if (resumeInputRef.current) resumeInputRef.current.value = ''
    } catch (e: any) {
      toast({ description: e?.message || 'Upload failed', variant: 'destructive' })
    }
  }

  return (
    <ProtectedRoute allowedRoles={["job_seeker"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="max-w-4xl mx-auto space-y-6" onChangeCapture={() => { setShowSave(true); if (typeof window !== 'undefined') localStorage.setItem('profile_view_mode', 'edit') }}>
          {/* Page Header */}
          <PageHeader title="My Profile" description="Manage your professional profile and supporting documents" />

          {/* Read-Only Summary (Elegant view) */}
          {viewMode && (
            <>
              <Card className="hover:shadow-sm transition-shadow">
                <CardHeader>
                  <CardTitle>Profile Overview</CardTitle>
                  <CardDescription className="flex items-center justify-between">
                    <span>A concise view of your profile information</span>
                    <Button size="sm" variant="outline" onClick={() => { setViewMode(false); if (typeof window !== 'undefined') localStorage.setItem('profile_view_mode', 'edit') }}>Edit Profile</Button>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-start gap-6">
                    <Avatar className="h-24 w-24 rounded-full overflow-hidden ring-1 ring-border">
                      <AvatarImage className="h-full w-full object-cover" src={avatarUrl} alt={user?.name} />
                      <AvatarFallback className="text-2xl">{(user?.name?.charAt(0) ?? '?').toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 grid gap-2">
                      <div className="text-2xl font-bold text-foreground">{[firstName, lastName].filter(Boolean).join(' ') || user?.name || '—'}</div>
                      <div className="text-sm text-muted-foreground mb-1">Bio</div>
                      <div className="text-foreground whitespace-pre-wrap">{bio}</div>
                    </div>
                  </div>

                  {/* Career Preferences */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Fresher</div>
                      <div className="text-sm">{isFresher ? 'Yes' : 'No'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Open to internships</div>
                      <div className="text-sm">{openToInternships ? 'Yes' : 'No'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Availability</div>
                      <div className="text-sm">{availabilityStartDate || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Internship duration</div>
                      <div className="text-sm">{preferredInternshipDuration || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Salary expectation</div>
                      <div className="text-sm">{salaryExpectation || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Dream job</div>
                      <div className="text-sm">{
                        DREAM_JOBS.find(job => job.id === dreamJobId)?.title || dreamJob || '—'
                      }</div>
                    </div>
                  </div>

                  {/* Skills */}
                  <div>
                    <div className="text-sm font-medium mb-2">Skills</div>
                    {skills.length ? (
                      <div className="flex flex-wrap gap-2">
                        {skills.map((s) => (
                          <Badge key={s} variant="secondary" className="text-sm py-1 px-3">{s}</Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No skills added</div>
                    )}
                  </div>

                  {/* Projects */}
                  {projects.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">Projects</div>
                      <div className="space-y-3">
                        {projects.map((p, i) => (
                          <div key={i} className="p-3 rounded-lg border">
                            <div className="font-medium">{p.name || 'Untitled Project'}</div>
                            {p.role && <div className="text-sm text-muted-foreground">Role: {p.role}</div>}
                            {p.link && <a className="text-sm text-primary underline" href={p.link} target="_blank" rel="noopener noreferrer">{p.link}</a>}
                            {p.description && <div className="text-sm mt-1 whitespace-pre-wrap">{p.description}</div>}
                            {(p.start || p.end) && <div className="text-xs text-muted-foreground mt-1">{p.start || '—'} — {p.end || 'Present'}</div>}
                            {p.tech && <div className="text-xs text-muted-foreground mt-1">Tech: {p.tech}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {education.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">Education</div>
                      <div className="space-y-3">
                        {education.map((ed, i) => (
                          <div key={i} className="p-3 rounded-lg border">
                            <div className="font-medium">{ed.degree || 'Degree'}</div>
                            {ed.school && <div className="text-sm text-muted-foreground">{ed.school}</div>}
                            {(ed.start || ed.end) && <div className="text-xs text-muted-foreground mt-1">{ed.start || '—'} — {ed.end || 'Present'}</div>}
                            {ed.description && <div className="text-sm mt-1 whitespace-pre-wrap">{ed.description}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Certifications */}
                  {certifications.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">Certifications</div>
                      <div className="space-y-3">
                        {certifications.map((c, i) => (
                          <div key={i} className="p-3 rounded-lg border">
                            <div className="font-medium">{c.name || 'Certification'}</div>
                            {c.issuer && <div className="text-sm text-muted-foreground">{c.issuer}</div>}
                            {(c.date || c.credentialId) && <div className="text-xs text-muted-foreground mt-1">{c.date || '—'}{c.credentialId ? ` • ${c.credentialId}` : ''}</div>}
                            {c.link && <a className="text-sm text-primary underline" href={c.link} target="_blank" rel="noopener noreferrer">View Credential</a>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Supporting Documents (view) */}
                  <div>
                    <div className="text-sm font-medium mb-2">Supporting Documents</div>
                    {resume?.url ? (
                      <div className="text-sm flex items-center gap-2">
                        <a className="text-primary underline" href={`/api/files/proxy?path=${encodeURIComponent(resume.url)}${authToken ? `&token=${encodeURIComponent(authToken)}` : ''}`} target="_blank" rel="noopener noreferrer">{resume.name || 'Resume'}</a>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No document uploaded</div>
                    )}
                    {/* Additional categories quick view */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      {docCover?.url && (
                        <div className="text-xs text-muted-foreground">Cover Letter: <a className="underline" href={`/api/files/proxy?path=${encodeURIComponent(docCover.url)}${authToken ? `&token=${encodeURIComponent(authToken)}` : ''}`} target="_blank">{docCover.name}</a></div>
                      )}
                      {docPortfolio?.url && (
                        <div className="text-xs text-muted-foreground">Portfolio: <a className="underline" href={`/api/files/proxy?path=${encodeURIComponent(docPortfolio.url)}${authToken ? `&token=${encodeURIComponent(authToken)}` : ''}`} target="_blank">{docPortfolio.name}</a></div>
                      )}
                      {docCertificates.length > 0 && (
                        <div className="text-xs text-muted-foreground">Certificates: {docCertificates.length}</div>
                      )}
                      {docOther.length > 0 && (
                        <div className="text-xs text-muted-foreground">Other Docs: {docOther.length}</div>
                      )}
                    </div>
                    {/* Uploader hidden in view mode */}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Hide the form content when in view mode */}
          {!viewMode && (
            <>

          {/* Profile Header */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                <Avatar className="h-24 w-24 rounded-full overflow-hidden ring-1 ring-border">
                  <AvatarImage className="h-full w-full object-cover" src={avatarUrl} alt={user?.name} />
                  <AvatarFallback className="text-2xl">{(user?.name?.charAt(0) ?? '?').toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-foreground">{user?.name}</h2>
                  <p className="text-muted-foreground">{user?.email}</p>
                  <div className="flex items-center gap-2 mt-4">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarFileChange} />
                    <Button size="sm" variant="outline" onClick={onPickPhoto}>
                      <Upload className="mr-2 h-4 w-4" />
                      Change Photo
                    </Button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground mb-1">Profile Strength</div>
                  <div className="text-2xl font-bold text-foreground">{profileStrength}%</div>
                  <div className="h-2 w-32 rounded-full bg-muted overflow-hidden mt-2">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${profileStrength}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents section removed */}

          {/* Projects */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Projects</CardTitle>
                  <CardDescription>Highlight key projects</CardDescription>
                </div>
                <Button size="sm" onClick={addProject}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Project
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projects.length === 0 && (
                  <div className="text-sm text-muted-foreground">No projects yet. Click "Add Project".</div>
                )}
                {projects.map((p, idx) => (
                  <div key={idx} className="p-4 rounded-lg border border-border">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input value={p.name} onChange={(e) => updateProject(idx, 'name', e.target.value)} placeholder="Project Name" />
                      </div>
                      <div>
                        <Label className="text-xs">Role</Label>
                        <Input value={p.role} onChange={(e) => updateProject(idx, 'role', e.target.value)} placeholder="Lead Developer" />
                      </div>
                      <div>
                        <Label className="text-xs">Link</Label>
                        <Input
                          value={p.link}
                          onChange={(e) => updateProject(idx, 'link', e.target.value)}
                          placeholder="https://..."
                          aria-invalid={!!(p.link && !isValidUrl(p.link))}
                        />
                        {p.link && !isValidUrl(p.link) && (
                          <div className="text-xs text-destructive mt-1">Please enter a valid URL (e.g., https://example.com)</div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Start</Label>
                          <Input value={p.start} onChange={(e) => updateProject(idx, 'start', e.target.value)} placeholder="2023-01" />
                        </div>
                        <div>
                          <Label className="text-xs">End</Label>
                          <Input value={p.end} onChange={(e) => updateProject(idx, 'end', e.target.value)} placeholder="2023-07" />
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">Description</Label>
                        <Textarea rows={3} value={p.description} onChange={(e) => updateProject(idx, 'description', e.target.value)} placeholder="What was built? Impact?" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">Technologies (comma separated)</Label>
                        <Input value={p.tech} onChange={(e) => updateProject(idx, 'tech', e.target.value)} placeholder="React, Node.js, Postgres" />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeProject(idx)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Certifications (optional) */}
          {!isFresher && (
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Certifications (optional)</CardTitle>
                  <CardDescription>Showcase professional certifications if you have them</CardDescription>
                </div>
                <Button size="sm" onClick={addCertification}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Certification
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {certifications.length === 0 && (
                  <div className="text-sm text-muted-foreground">No certifications yet. Click "Add Certification".</div>
                )}
                {certifications.map((c, idx) => (
                  <div key={idx} className="p-4 rounded-lg border border-border">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input value={c.name} onChange={(e) => updateCertification(idx, 'name', e.target.value)} placeholder="AWS Certified Cloud Practitioner" />
                      </div>
                      <div>
                        <Label className="text-xs">Issuer</Label>
                        <Input value={c.issuer} onChange={(e) => updateCertification(idx, 'issuer', e.target.value)} placeholder="Amazon" />
                      </div>
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input value={c.date} onChange={(e) => updateCertification(idx, 'date', e.target.value)} placeholder="2024-05" />
                      </div>
                      <div>
                        <Label className="text-xs">Credential ID</Label>
                        <Input value={c.credentialId} onChange={(e) => updateCertification(idx, 'credentialId', e.target.value)} placeholder="ABC-123" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">Link</Label>
                        <Input
                          value={c.link}
                          onChange={(e) => updateCertification(idx, 'link', e.target.value)}
                          placeholder="https://..."
                          aria-invalid={!!(c.link && !isValidUrl(c.link))}
                        />
                        {c.link && !isValidUrl(c.link) && (
                          <div className="text-xs text-destructive mt-1">Please enter a valid URL (e.g., https://example.com)</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeCertification(idx)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Basic Information */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="San Francisco, CA" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="salaryExpectation">Salary Expectation</Label>
                  <Input
                    id="salaryExpectation"
                    placeholder="e.g. $80,000 - $100,000 USD / year"
                    value={salaryExpectation}
                    onChange={(e) => setSalaryExpectation(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dreamJob">Dream Job</Label>
                  <Select 
                    value={dreamJobId} 
                    onValueChange={(value) => {
                      setDreamJobId(value);
                      setDreamJob(DREAM_JOBS.find(job => job.id === value)?.title || '');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your dream job" />
                    </SelectTrigger>
                    <SelectContent>
                      {DREAM_JOBS.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Professional Title</Label>
                <Input id="title" placeholder="e.g. Senior React Developer" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell employers about yourself, your experience, and what you're looking for..."
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Skills */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Skills</CardTitle>
              <CardDescription>Add your technical and professional skills</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-sm py-1 px-3">
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="ml-2 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Add a skill..."
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addSkill()}
                />
                <Button onClick={addSkill}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Suggested skills quick-add */}
              <div className="pt-2">
                <div className="text-xs text-muted-foreground mb-2">Suggested skills</div>
                <div className="flex flex-wrap gap-2">
                  {suggestedSkills.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!skills.includes(s)) setSkills([...skills, s])
                      }}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Career Preferences */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Career Preferences</CardTitle>
              <CardDescription>Tell employers about your current status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={isFresher}
                  onChange={(e) => setIsFresher(e.target.checked)}
                />
                <span>I'm a fresher (no prior full-time experience)</span>
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={openToInternships}
                  onChange={(e) => setOpenToInternships(e.target.checked)}
                />
                <span>Open to internships</span>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="availabilityStartDate">Availability start date</Label>
                  <Input
                    id="availabilityStartDate"
                    type="date"
                    value={availabilityStartDate}
                    onChange={(e) => setAvailabilityStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredInternshipDuration">Preferred internship duration</Label>
                  <Input
                    id="preferredInternshipDuration"
                    placeholder="e.g. 3 months, 6 months"
                    value={preferredInternshipDuration}
                    onChange={(e) => setPreferredInternshipDuration(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Experience (optional) */}
          {!isFresher && (
            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Work Experience (optional)</CardTitle>
                    <CardDescription>Add your professional experience if applicable</CardDescription>
                  </div>
                  <Button size="sm" onClick={addExperience}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Experience
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {experiences.length === 0 && (
                    <div className="text-sm text-muted-foreground">No experience yet. Click "Add Experience".</div>
                  )}
                  {experiences.map((exp, idx) => (
                    <div key={idx} className="p-4 rounded-lg border border-border">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label className="text-xs">Title</Label>
                          <Input value={exp.title} onChange={(e) => updateExperience(idx, 'title', e.target.value)} placeholder="Senior Developer" />
                        </div>
                        <div>
                          <Label className="text-xs">Company</Label>
                          <Input value={exp.company} onChange={(e) => updateExperience(idx, 'company', e.target.value)} placeholder="Tech Company Inc." />
                        </div>
                        <div>
                          <Label className="text-xs">Start</Label>
                          <Input value={exp.start} onChange={(e) => updateExperience(idx, 'start', e.target.value)} placeholder="2020" />
                        </div>
                        <div>
                          <Label className="text-xs">End</Label>
                          <Input value={exp.end} onChange={(e) => updateExperience(idx, 'end', e.target.value)} placeholder="Present" />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs">Description</Label>
                          <Textarea rows={3} value={exp.description} onChange={(e) => updateExperience(idx, 'description', e.target.value)} placeholder="What did you work on?" />
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeExperience(idx)}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Education */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Education</CardTitle>
                  <CardDescription>Add your educational background</CardDescription>
                </div>
                <Button size="sm" onClick={addEducation}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Education
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {education.length === 0 && (
                  <div className="text-sm text-muted-foreground">No education yet. Click "Add Education".</div>
                )}
                {education.map((ed, idx) => (
                  <div key={idx} className="p-4 rounded-lg border border-border">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label className="text-xs">Degree</Label>
                        <Input value={ed.degree} onChange={(e) => updateEducation(idx, 'degree', e.target.value)} placeholder="B.Sc. in Computer Science" />
                      </div>
                      <div>
                        <Label className="text-xs">School</Label>
                        <Input value={ed.school} onChange={(e) => updateEducation(idx, 'school', e.target.value)} placeholder="Your University" />
                      </div>
                      <div>
                        <Label className="text-xs">Start</Label>
                        <Input value={ed.start} onChange={(e) => updateEducation(idx, 'start', e.target.value)} placeholder="2016" />
                      </div>
                      <div>
                        <Label className="text-xs">End</Label>
                        <Input value={ed.end} onChange={(e) => updateEducation(idx, 'end', e.target.value)} placeholder="2020" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">Description</Label>
                        <Textarea rows={3} value={ed.description} onChange={(e) => updateEducation(idx, 'description', e.target.value)} placeholder="Highlights or thesis" />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeEducation(idx)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Resume */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>Supporting Documents</CardTitle>
              <CardDescription>Upload your supporting documents (e.g., resume, certificates, portfolio)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={uploadCategory} onValueChange={(v) => setUploadCategory(v as any)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resume">Resume</SelectItem>
                      <SelectItem value="coverletter">Cover Letter</SelectItem>
                      <SelectItem value="portfolio">Portfolio</SelectItem>
                      <SelectItem value="certificate">Certificates</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Files</Label>
                  <input ref={docsInputRef} type="file" multiple onChange={(e) => setUploadFiles(e.target.files ? Array.from(e.target.files) : [])} />
                  <div className="text-xs text-muted-foreground mt-1">Max 10MB each. PDF, DOC/DOCX, images, etc.</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!uploadFiles.length) {
                      onPickDocs()
                    } else {
                      onUploadDocuments()
                    }
                  }}
                  disabled={uploadBusy}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadFiles.length ? 'Upload' : 'Choose Files'}
                </Button>
                {uploadStatus && (
                  <span className="text-xs text-muted-foreground">{uploadStatus}</span>
                )}
                <Button variant="outline" disabled>
                  <FileText className="mr-2 h-4 w-4" />
                  Build Resume (coming soon)
                </Button>
              </div>
              {/* Documents list (default resume set plus history) */}
              {resumes.length > 0 ? (
                <div className="space-y-2">
                  {resumes.map((r) => {
                    const isDefault = resume?.id && r.id && String(resume.id) === String(r.id)
                    const uploaded = r.uploadedAt ? new Date(r.uploadedAt).toLocaleString() : ''
                    const sizeBytes = (r as any).size as number | undefined
                    const sizeText = typeof sizeBytes === 'number' ? `${(sizeBytes / 1024).toFixed(1)} KB` : ''
                    const tokenQs = authToken ? `&token=${encodeURIComponent(authToken)}` : ''
                    return (
                      <div key={r.id} className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <a
                          className="text-primary underline"
                          href={`/api/files/proxy?path=${encodeURIComponent(r.url)}${tokenQs}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {r.name || 'Document'}
                        </a>
                        {isDefault && <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs">Default</span>}
                        {(uploaded || sizeText) && <span className="text-xs">{uploaded}{uploaded && sizeText ? ' • ' : ''}{sizeText}</span>}
                        <span>•</span>
                        <a className="underline" href={`/api/files/proxy?path=${encodeURIComponent(r.url)}${tokenQs}`} target="_blank" rel="noopener noreferrer">View</a>
                        <a className="underline text-muted-foreground" href={`/api/files/proxy?path=${encodeURIComponent(r.url)}&download=1${tokenQs}`}>Download</a>
                        {!isDefault && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onSetDefaultResume(r.id)}>Set Default</Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600" onClick={() => onRemoveResume(r.id)}>Remove</Button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No documents uploaded yet.</div>
              )}
              <p className="text-sm text-muted-foreground">Accepted formats: PDF, DOC, DOCX (Max 5MB)</p>
            </CardContent>
          </Card>

          </>

          )}

          {/* Save Button (only in edit mode) */}
          {!viewMode && (
            <div className="flex items-center justify-end gap-4">
              <Button variant="outline" onClick={async () => { await fetchProfile(); setViewMode(true); if (typeof window !== 'undefined') localStorage.setItem('profile_view_mode', 'view'); toast({ description: 'Changes discarded' }) }}>Cancel</Button>
              <div className="text-xs text-muted-foreground mr-auto">
                {!emailValid && <span className="text-destructive">Invalid email address</span>}
              </div>
              {showSave && (
                <Button onClick={saveProfile} disabled={saveDisabled || isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
