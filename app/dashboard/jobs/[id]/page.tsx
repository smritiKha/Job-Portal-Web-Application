"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useParams } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { ArrowLeft, MapPin, DollarSign, Clock, Building2, FileText, Home, Search, Briefcase, BookOpen, FileImage, FileVideo, FileAudio, FileArchive, FileCode, FileSpreadsheet } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
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
import { Input } from "@/components/ui/input"

type DocOption = { url: string; name: string; size?: number }

export default function JobDetailsPage() {
  const routeParams = useParams<{ id: string }>()
  const id = String(routeParams?.id || "")
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const { toast } = useToast()
  const [job, setJob] = useState<any | null>(null)
  const npr = new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [docsLoading, setDocsLoading] = useState(false)
  const [resumeOptions, setResumeOptions] = useState<DocOption[]>([])
  const [coverOptions, setCoverOptions] = useState<DocOption[]>([])
  const [resumeUrl, setResumeUrl] = useState<string>("")
  const [coverLetterUrl, setCoverLetterUrl] = useState<string>("")
  const [coverLetterText, setCoverLetterText] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [applying, setApplying] = useState(false)
  const [attachmentsOptions, setAttachmentsOptions] = useState<DocOption[]>([])
  const [attachments, setAttachments] = useState<string[]>([])
  const [similarJobs, setSimilarJobs] = useState<any[]>([])
  const [screeningAnswers, setScreeningAnswers] = useState<string[]>([])
  const [authToken, setAuthToken] = useState<string>("")
  const [similarLoading, setSimilarLoading] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [createdAppId, setCreatedAppId] = useState<string>("")
  const [templateBusy, setTemplateBusy] = useState(false)
  const [hasApplied, setHasApplied] = useState(false)
  const [existingAppId, setExistingAppId] = useState<string>("")

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home, current: false },
    { name: "Find Jobs", href: "/dashboard/jobs", icon: Search, current: false },
    { name: "Applications", href: "/dashboard/applications", icon: Briefcase, current: false },
    { name: "Training", href: "/dashboard/training", icon: BookOpen, current: false },
    { name: "Profile", href: "/dashboard/profile", icon: FileText, current: false },
  ]
  const updatedNav = navigation.map((item) => ({ ...item, current: item.href === pathname }))

  // Removed template generation; using free-text cover letter instead

  const toDocOption = (d: any): DocOption | null => {
    if (!d) return null
    if (typeof d === 'string') {
      const name = d.split('/').pop() || 'Document'
      return { url: d, name }
    }
    const url = d?.url || ''
    if (!url) return null
    const name = d?.name || (url.split('/').pop() || 'Document')
    const size = typeof d?.size === 'number' ? d.size : undefined
    return { url, name, size }
  }

  // Removed template generator

  const extToIcon = (ext: string) => {
    const e = (ext || '').toLowerCase()
    if (['jpg','jpeg','png','gif','webp','svg'].includes(e)) return FileImage
    if (['mp4','mov','avi','mkv','webm'].includes(e)) return FileVideo
    if (['mp3','wav','m4a','flac'].includes(e)) return FileAudio
    if (['zip','rar','7z','gz','tar'].includes(e)) return FileArchive
    if (['js','ts','tsx','py','go','rb','java','c','cpp','json','yaml','yml','md'].includes(e)) return FileCode
    if (['xls','xlsx','csv'].includes(e)) return FileSpreadsheet
    return FileText
  }

  const extBadge = (ext: string) => {
    const e = (ext || '').toUpperCase()
    const color = e === 'PDF' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : (e === 'DOC' || e === 'DOCX') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-muted text-muted-foreground'
    return <span className={`ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${color}`}>{e}</span>
  }

  const extIconClass = (ext: string) => {
    const e = (ext || '').toUpperCase()
    if (e === 'PDF') return 'text-red-600 dark:text-red-400'
    if (e === 'DOC' || e === 'DOCX') return 'text-blue-600 dark:text-blue-400'
    return 'text-muted-foreground'
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/jobs/${id}`)
        const data = await res.json()
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load job')
        if (mounted) {
          setJob(data.job)
          // initialize screening answers inputs based on job questions
          const qs = Array.isArray(data.job?.screeningQuestions) ? (data.job.screeningQuestions as string[]) : []
          setScreeningAnswers(qs.length ? Array(qs.length).fill("") : [])
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Error loading job')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id])

  // Track employer profile views (job views) for analytics
  useEffect(() => {
    ;(async () => {
      try {
        if (!job?._id) return
        const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
        await fetch('/api/analytics/views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ type: 'job', jobId: job._id })
        }).catch(() => {})
        // Also record an employer-level view if createdBy is present
        const employerId = (job as any)?.createdBy
        if (employerId) {
          await fetch('/api/analytics/views', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ type: 'employer', employerId })
          }).catch(() => {})
        }
      } catch {}
    })()
  }, [job?._id])

  // Read JWT for anchor-based file links (anchors do not send Authorization headers)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAuthToken(localStorage.getItem('job_portal_token') || '')
    }
  }, [])

  // Check if the current user has already applied to this job
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!user?.id || !id) return
        const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
        const res = await fetch(`/api/applications?userId=${encodeURIComponent(String(user.id))}&jobId=${encodeURIComponent(String(id))}&limit=1`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        const data = await res.json()
        if (!mounted) return
        if (res.ok && data?.ok) {
          const first = Array.isArray(data.applications) ? data.applications[0] : null
          if (first?._id) {
            setHasApplied(true)
            setExistingAppId(String(first._id))
          } else {
            setHasApplied(false)
            setExistingAppId("")
          }
        }
      } catch {}
    })()
    return () => { mounted = false }
  }, [user?.id, id])

  async function refreshUserDocs() {
    if (!user?.id) return
    try {
      setDocsLoading(true)
      const res = await fetch(`/api/users/${user.id}`)
      const data = await res.json()
      if (res.ok && data?.ok) {
        const u = data.user
        const docs = u?.documents || {}
        const resumeDoc = toDocOption(docs?.resume)
        const coverDoc = toDocOption(docs?.coverLetter)
        const portfolioDoc = toDocOption(docs?.portfolio)
        const certDocs: DocOption[] = (Array.isArray(docs?.certificates) ? docs.certificates : []).map(toDocOption).filter(Boolean) as DocOption[]
        const otherDocs: DocOption[] = (Array.isArray(docs?.other) ? docs.other : []).map(toDocOption).filter(Boolean) as DocOption[]

        const dedupe = (arr: DocOption[]) => {
          const seen = new Set<string>()
          const out: DocOption[] = []
          for (const x of arr) { if (!seen.has(x.url)) { seen.add(x.url); out.push(x) } }
          return out
        }

        const resumeList = dedupe([resumeDoc, portfolioDoc, ...certDocs, ...otherDocs].filter(Boolean) as DocOption[])
        const coverList = dedupe([coverDoc, ...otherDocs].filter(Boolean) as DocOption[])
        const attachList = dedupe([portfolioDoc, ...certDocs, ...otherDocs].filter(Boolean) as DocOption[])
        setResumeOptions(resumeList)
        setCoverOptions(coverList)
        setAttachmentsOptions(attachList)
      }
    } finally {
      setDocsLoading(false)
    }
  }

  // Load user documents
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!user?.id) return
      try {
        setDocsLoading(true)
        const res = await fetch(`/api/users/${user.id}`)
        const data = await res.json()
        if (res.ok && data?.ok && mounted) {
          const u = data.user
          const docs = u?.documents || {}
          const resumeDoc = toDocOption(docs?.resume)
          const coverDoc = toDocOption(docs?.coverLetter)
          const portfolioDoc = toDocOption(docs?.portfolio)
          const certDocs: DocOption[] = (Array.isArray(docs?.certificates) ? docs.certificates : []).map(toDocOption).filter(Boolean) as DocOption[]
          const otherDocs: DocOption[] = (Array.isArray(docs?.other) ? docs.other : []).map(toDocOption).filter(Boolean) as DocOption[]

          const dedupe = (arr: DocOption[]) => {
            const seen = new Set<string>()
            const out: DocOption[] = []
            for (const x of arr) { if (!seen.has(x.url)) { seen.add(x.url); out.push(x) } }
            return out
          }

          const resumeList = dedupe([resumeDoc, portfolioDoc, ...certDocs, ...otherDocs].filter(Boolean) as DocOption[])
          const coverList = dedupe([coverDoc, ...otherDocs].filter(Boolean) as DocOption[])
          const attachList = dedupe([portfolioDoc, ...certDocs, ...otherDocs].filter(Boolean) as DocOption[])

          setResumeOptions(resumeList)
          setCoverOptions(coverList)
          setAttachmentsOptions(attachList)
          if (resumeDoc) setResumeUrl(resumeDoc.url)
          if (coverDoc) setCoverLetterUrl(coverDoc.url)
        }
      } finally {
        if (mounted) setDocsLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [user?.id])

  // Load similar jobs after job is loaded
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!job) return
      try {
        setSimilarLoading(true)
        const res = await fetch('/api/jobs')
        const data = await res.json()
        if (res.ok && data?.ok && mounted) {
          const items = (data.jobs || [])
            .filter((j: any) => String(j._id) !== String(job._id))
            .filter((j: any) => j.type === job.type || j.companyName === job.companyName)
            .slice(0, 3)
          setSimilarJobs(items)
        }
      } finally {
        if (mounted) setSimilarLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [job])

  async function applyNow() {
    if (!user?.id) {
      toast({ title: 'Please sign in', description: 'You must be signed in to apply.', variant: 'destructive' })
      router.push('/login')
      return
    }
    if (job?.requiresResume && !resumeUrl) {
      toast({ title: 'Resume required', description: 'This job requires a resume. Please select or upload one before applying.', variant: 'destructive' })
      return
    }
    try {
      setApplying(true)
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      // If user typed a cover letter but didn't select a file, upload it as a text file now
      if (!coverLetterUrl && coverLetterText.trim()) {
        try {
          const blob = new Blob([coverLetterText], { type: 'text/plain' })
          const file = new File([blob], 'cover-letter.txt', { type: 'text/plain' })
          const form = new FormData()
          form.append('file', file)
          form.append('category', 'coverLetter')
          const upRes = await fetch('/api/upload', { method: 'POST', body: form })
          const upData = await upRes.json()
          if (upRes.ok && upData?.ok) setCoverLetterUrl(String(upData.url || ''))
        } catch {}
      }
      // prepare screening answers payload (only include non-empty)
      const qs: string[] = Array.isArray(job?.screeningQuestions) ? (job!.screeningQuestions as string[]) : []
      const sa = qs.map((q, i) => ({ question: String(q), answer: String(screeningAnswers[i] || '').trim() })).filter(x => x.answer)

      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ jobId: id, resumeUrl: resumeUrl || undefined, coverLetterUrl: (coverLetterUrl || undefined), notes: notes || undefined, attachments, screeningAnswers: sa })
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        // If duplicate application, guide the user to the existing application
        if (data?.code === 'duplicate_application') {
          const exId = String(data?.existingId || '')
          setHasApplied(true)
          if (exId) setExistingAppId(exId)
          toast({ title: 'Already applied', description: 'You have already applied to this job. Opening your application.' })
          window.location.assign(`/dashboard/applications${exId ? `?open=${encodeURIComponent(exId)}` : ''}`)
          return
        }
        throw new Error(data?.error || 'Failed to apply')
      }
      setCreatedAppId(String(data.id || ""))
      setSuccessOpen(true)
      toast({ title: 'Application submitted', description: 'We have sent your application to the employer.' })
    } catch (e: any) {
      toast({ title: 'Apply failed', description: e?.message || 'Please try again.', variant: 'destructive' })
    } finally {
      setApplying(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={["job_seeker"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <PageHeader title="Job Details" description="Review the full job description and apply" />
            </div>
            <div className="flex items-center gap-2">
              {job?.createdBy && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(`/dashboard/messages?peerId=${encodeURIComponent(String(job.createdBy))}`)}
                >
                  Message Employer
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-40" />
                <div className="flex gap-4">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
            </Card>
          ) : job ? (
            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <CardTitle className="text-2xl">{job.title}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1"><Building2 className="h-4 w-4" />
                    {(() => {
                      const raw = (job as any)?.companyName ?? (job as any)?.company
                      if (raw && typeof raw === 'object') return String((raw as any).name || 'Company')
                      return String(raw || 'Company')
                    })()}
                  </span>
                  {job.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {job.location}</span>}
                  {job.type && <Badge variant="outline">{job.type}</Badge>}
                  {job.createdAt && <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {new Date(job.createdAt).toDateString()}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(typeof job.salaryMin === 'number' && typeof job.salaryMax === 'number') && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1"><DollarSign className="h-4 w-4" /> {`${npr.format(job.salaryMin)} - ${npr.format(job.salaryMax)}`}</div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {job.description || 'No description provided.'}
                </div>
                {/* Extra Job Details */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Status</div>
                      <div className="font-medium">{job.status ? String(job.status).toUpperCase() : 'OPEN'}</div>
                      <div className="text-muted-foreground">Posted</div>
                      <div className="font-medium">{job.createdAt ? new Date(job.createdAt).toLocaleString() : '—'}</div>
                      <div className="text-muted-foreground">Location</div>
                      <div className="font-medium">{job.location || '—'}</div>
                      <div className="text-muted-foreground">Type</div>
                      <div className="font-medium">{job.type || '—'}</div>
                      {job.department && (<><div className="text-muted-foreground">Department</div><div className="font-medium">{job.department}</div></>)}
                      {job.experienceLevel && (<><div className="text-muted-foreground">Experience</div><div className="font-medium">{job.experienceLevel}</div></>)}
                    </div>
                    {(Array.isArray(job.skills) && job.skills.length > 0) && (
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Required Skills</div>
                        <div className="flex flex-wrap gap-2">
                          {job.skills.map((s: any, i: number) => (
                            <Badge key={String(s)+i} variant="outline">{String(s)}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {job.moderatedByUser && (
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Moderated By</div>
                        <div className="text-sm text-muted-foreground">
                          {job.moderatedByUser.name || '—'}{job.moderatedByUser.email ? ` • ${job.moderatedByUser.email}` : ''}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Role Details (Responsibilities, Requirements, Benefits, Environment) */}
                {(job.responsibilities || job.requirements || job.benefits || job.workingEnvironment || job.environment) && (
                  <div className="grid gap-6 md:grid-cols-2">
                    {(job.responsibilities || job.requirements) && (
                      <div className="space-y-3">
                        {job.responsibilities && (
                          <div className="space-y-1">
                            <div className="text-sm font-medium">Responsibilities</div>
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{job.responsibilities}</div>
                          </div>
                        )}
                        {job.requirements && (
                          <div className="space-y-1">
                            <div className="text-sm font-medium">Requirements</div>
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{job.requirements}</div>
                          </div>
                        )}
                      </div>
                    )}
                    {(job.benefits || job.workingEnvironment || job.environment) && (
                      <div className="space-y-3">
                        {job.benefits && (
                          <div className="space-y-1">
                            <div className="text-sm font-medium">Benefits</div>
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{job.benefits}</div>
                          </div>
                        )}
                        {(job.workingEnvironment || job.environment) && (
                          <div className="space-y-1">
                            <div className="text-sm font-medium">Working Environment</div>
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{job.workingEnvironment || job.environment}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Screening Questions (Job Seeker answers) */}
                {(() => {
                  const screeningQs: string[] = Array.isArray((job as any).screeningQuestions)
                    ? ((job as any).screeningQuestions as string[])
                    : (typeof (job as any).questions === 'string'
                        ? String((job as any).questions)
                            .split(/\r?\n/)
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : [])
                  return screeningQs.length > 0 ? (
                    <div className="space-y-3">
                      <div className="text-sm font-medium">Screening Questions</div>
                      <div className="space-y-4">
                        {screeningQs.map((q: string, i: number) => (
                          <div key={i} className="space-y-1">
                            <div className="text-sm text-foreground">{q}</div>
                            <Textarea
                              rows={3}
                              placeholder="Your answer"
                              value={screeningAnswers[i] || ''}
                              onChange={(e) => {
                                const v = e.target.value
                                setScreeningAnswers(prev => {
                                  const next = [...prev]
                                  next[i] = v
                                  return next
                                })
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                })()}

                {/* Company & Contact */}
                {(job.companyWebsite || job.contactPhone || job.contactEmail) && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Company & Contact</div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {job.companyWebsite && (
                          <div>
                            Website: <a className="underline" href={String(job.companyWebsite)} target="_blank" rel="noopener noreferrer">{String(job.companyWebsite)}</a>
                          </div>
                        )}
                        {job.contactEmail && (
                          <div>
                            Email: <a className="underline" href={`mailto:${String(job.contactEmail)}`}>{String(job.contactEmail)}</a>
                          </div>
                        )}
                        {job.contactPhone && (
                          <div>
                            Phone: <a className="underline" href={`tel:${String(job.contactPhone)}`}>{String(job.contactPhone)}</a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium mb-1">Documents</div>
                      <div className="flex items-center gap-2">
                        <Select value={resumeUrl ? resumeUrl : "__none__"} onValueChange={(v) => setResumeUrl(v === "__none__" ? "" : v)}>
                          <SelectTrigger className="w-56">
                            <SelectValue placeholder="Select a document (e.g., resume, certificate)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {resumeOptions.map((opt, i) => {
                              const ext = (opt.name.split('.').pop() || '')
                              return (
                                <SelectItem key={opt.url + i} value={opt.url}>
                                  <span className="inline-flex items-center gap-2">
                                    {(() => { const I = extToIcon(ext); return <I className={`h-3.5 w-3.5 ${extIconClass(ext)}`} /> })()}
                                    {opt.name}
                                    {ext && extBadge(ext)}
                                    {opt.size ? <span className="text-[10px] text-muted-foreground">• {(opt.size/1024).toFixed(0)} KB</span> : null}
                                  </span>
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                        {resumeUrl ? (
                          <>
                            <a className="text-primary underline text-sm" href={`/api/files/proxy?path=${encodeURIComponent(resumeUrl)}${authToken ? `&token=${encodeURIComponent(authToken)}` : ''}`} target="_blank" rel="noopener noreferrer">View</a>
                            <a className="text-muted-foreground underline text-sm" href={`/api/files/proxy?path=${encodeURIComponent(resumeUrl)}&download=1${authToken ? `&token=${encodeURIComponent(authToken)}` : ''}`}>Download</a>
                          </>
                        ) : (
                          <Link href="/dashboard/profile" className="text-xs text-primary underline">Upload documents in Profile</Link>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-1">Cover Letter</div>
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Type your cover letter here (optional)"
                          value={coverLetterText}
                          onChange={(e) => setCoverLetterText(e.target.value)}
                          rows={6}
                        />
                        <div className="text-xs text-muted-foreground">
                          {coverLetterText.length} characters
                          {coverLetterUrl ? (
                            <>
                              {' '}• Attached file ready •{' '}
                              <a className="underline" href={`/api/files/proxy?path=${encodeURIComponent(coverLetterUrl)}`} target="_blank" rel="noopener noreferrer">View</a>
                            </>
                          ) : null}
                        </div>
                        {/* Optional: also allow selecting an existing uploaded cover letter */}
                        {coverOptions.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Select value={coverLetterUrl ? coverLetterUrl : "__none__"} onValueChange={(v) => setCoverLetterUrl(v === "__none__" ? "" : v)}>
                              <SelectTrigger className="w-56">
                                <SelectValue placeholder="Or select an uploaded cover letter" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {coverOptions.map((opt, i) => (
                                  <SelectItem key={opt.url + i} value={opt.url}>{opt.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {coverLetterUrl && (
                              <a className="text-xs underline" href={`/api/files/proxy?path=${encodeURIComponent(coverLetterUrl)}`} target="_blank" rel="noopener noreferrer">View</a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Notes (optional)</div>
                      <Textarea placeholder="Add a short note for the hiring team" value={notes} onChange={(e) => setNotes(e.target.value)} />
                      {job?.requiresResume && !resumeUrl && (
                        <div className="text-xs text-destructive">A resume is required to apply for this job. Please select or upload one.</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Attachments (optional)</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {attachmentsOptions.length === 0 ? (
                          <div className="text-xs text-muted-foreground">No additional documents found. Upload from your profile.</div>
                        ) : attachmentsOptions.map((opt, i) => {
                          const ext = (opt.name.split('.').pop() || '')
                          const checked = attachments.includes(opt.url)
                          return (
                            <label key={opt.url + i} className="flex items-center gap-2 text-sm border rounded-md p-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={checked}
                                onChange={(e) => {
                                  setAttachments(prev => {
                                    if (e.target.checked) return Array.from(new Set([...prev, opt.url]))
                                    return prev.filter(u => u !== opt.url)
                                  })
                                }}
                              />
                              {(() => { const I = extToIcon(ext); return <I className={`h-4 w-4 ${extIconClass(ext)}`} /> })()}
                              <span className="truncate">{opt.name}</span>
                              {ext && extBadge(ext)}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {hasApplied ? (
                        <>
                          <Button variant="secondary" onClick={() => window.location.assign(`/dashboard/applications${existingAppId ? `?open=${encodeURIComponent(existingAppId)}` : ''}`)}>
                            View Application
                          </Button>
                          <Button variant="outline" disabled>
                            Already Applied
                          </Button>
                        </>
                      ) : (
                        <Button disabled={applying || docsLoading} onClick={applyNow}>{applying ? 'Submitting…' : 'Apply Now'}</Button>
                      )}
                      {/* Upload button removed; direct users to Profile for uploads */}
                      <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Similar Jobs */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Similar Jobs</h3>
            {similarLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-5 space-y-3">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <div className="pt-2"><Skeleton className="h-9 w-24" /></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : similarJobs.length === 0 ? (
              <Card>
                <CardContent className="p-5 text-sm text-muted-foreground">No similar jobs found right now.</CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {similarJobs.map((sj: any) => (
                  <Card key={String(sj._id)} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-foreground truncate pr-2">{sj.title}</div>
                        <Badge variant="outline">{sj.type || 'Full-time'}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{(() => { const raw = (sj as any)?.companyName ?? (sj as any)?.company; if (raw && typeof raw === 'object') return String(raw.name || 'Company'); return String(raw || 'Company') })()}</div>
                      <div className="text-xs text-muted-foreground">{sj.location || 'Remote'}</div>
                      <div className="pt-2">
                        <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/jobs/${String(sj._id)}`)}>View Details</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Upload Modal removed; use Profile page for document uploads */}

          {/* Success Dialog */}
          <AlertDialog open={successOpen} onOpenChange={setSuccessOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Application submitted</AlertDialogTitle>
                <AlertDialogDescription>
                  Your application has been sent to the employer. You can track its status in Applications.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                {createdAppId ? (
                  <>
                    <AlertDialogAction onClick={() => { setSuccessOpen(false); window.location.assign(`/dashboard/applications`); }}>View Applications</AlertDialogAction>
                    <AlertDialogAction onClick={() => { setSuccessOpen(false); window.location.assign(`/dashboard/applications?open=${encodeURIComponent(createdAppId)}`); }}>Open This Application</AlertDialogAction>
                  </>
                ) : (
                  <AlertDialogAction onClick={() => { setSuccessOpen(false); window.location.assign(`/dashboard/applications`); }}>View Applications</AlertDialogAction>
                )}
                <AlertDialogCancel onClick={() => setSuccessOpen(false)}>Close</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
