"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Home, Search, Briefcase, FileText, File, FileArchive, FileImage, FileAudio, FileVideo, FileCode, FileSpreadsheet, Bookmark, MapPin, Calendar, Eye, BookOpen } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { useAuth } from "@/lib/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { useEvents } from "@/hooks/use-events"
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
import { Textarea } from "@/components/ui/textarea"


const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home, current: false },
  { name: "Find Jobs", href: "/dashboard/jobs", icon: Search, current: false },
  { name: "Applications", href: "/dashboard/applications", icon: Briefcase, current: true },
  { name: "Training", href: "/dashboard/training", icon: BookOpen, current: false },
  { name: "Profile", href: "/dashboard/profile", icon: FileText, current: false },
  { name: "Saved Jobs", href: "/dashboard/saved", icon: Bookmark, current: false },
]

type ApplicationItem = {
  _id: string
  title: string
  company?: string
  location?: string
  appliedAt?: string
  status: "submitted" | "under_review" | "interview" | "rejected" | "accepted" | "withdrawn" | string
  type?: string
  interviewDate?: string
  resumeUrl?: string
  coverLetterUrl?: string
  notes?: string
  jobId?: string
  interviewMode?: string
  interviewLocation?: string
}

export default function ApplicationsPage() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [authToken, setAuthToken] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [items, setItems] = useState<ApplicationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string>("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [withdrawingId, setWithdrawingId] = useState<string>("")
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditLogs, setAuditLogs] = useState<Array<{ action: string; createdAt?: string; actorRole?: string; meta?: any }>>([])
  const [openInterviewNotes, setOpenInterviewNotes] = useState<string>("")
  const [prepOpen, setPrepOpen] = useState(false)
  const [prepQuestions, setPrepQuestions] = useState<string[]>([])
  const [prepRole, setPrepRole] = useState<string>("")
  // Offers state
  const [offersByApp, setOffersByApp] = useState<Record<string, any>>({})
  const [offerOpen, setOfferOpen] = useState(false)
  const [offerForAppId, setOfferForAppId] = useState<string>("")
  const [offerResponse, setOfferResponse] = useState<string>("")
  const { toast } = useToast()

  const extIconClass = (ext: string) => {
    const e = (ext || '').toUpperCase()
    if (e === 'PDF') return 'text-red-600 dark:text-red-400'
    if (e === 'DOC' || e === 'DOCX') return 'text-blue-600 dark:text-blue-400'
    return 'text-muted-foreground'
  }

  const extToIcon = (ext: string) => {
    const e = (ext || '').toLowerCase()
    if (['jpg','jpeg','png','gif','webp','svg'].includes(e)) return FileImage
    if (['mp4','mov','avi','mkv','webm'].includes(e)) return FileVideo
    if (['mp3','wav','m4a','flac'].includes(e)) return FileAudio
    if (['zip','rar','7z','gz','tar'].includes(e)) return FileArchive
    if (['js','ts','tsx','py','go','rb','java','c','cpp','json','yaml','yml','md'].includes(e)) return FileCode
    if (['xls','xlsx','csv'].includes(e)) return FileSpreadsheet
    // default
    return FileText
  }

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  const filteredApplications = items.filter((app) => statusFilter === "all" || app.status === statusFilter)

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      submitted: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
      under_review: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      interview: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      interview_completed: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      rejected: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
      accepted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      withdrawn: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    }

    const labels: Record<string, string> = {
      submitted: "Submitted",
      under_review: "Under Review",
      interview: "Interview Scheduled",
      interview_completed: "Interview Scheduled",
      rejected: "Rejected",
      accepted: "Accepted",
      withdrawn: "Withdrawn",
    }
    const key = status in labels ? status : 'submitted'
    return <span className={`text-xs px-2 py-1 rounded-full ${colors[key]}`}>{labels[key]}</span>
  }

  async function withdrawApplication(id: string) {
    if (!id) return
    const ok = typeof window !== 'undefined' ? window.confirm('Are you sure you want to withdraw this application?') : true
    if (!ok) return
    const reason = typeof window !== 'undefined' ? window.prompt('Optional: add a short reason for withdrawing (it may be shared with the employer):') || '' : ''
    try {
      setWithdrawingId(id)
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ status: 'withdrawn', ...(reason ? { notes: reason } : {}) })
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to withdraw')
      // Update in state
      setItems((prev) => prev.map((x) => x._id === id ? { ...x, status: 'withdrawn', notes: reason || x.notes } : x))
      // If dialog shows this app, keep it open but reflect new status
    } catch (e) {
      // optional: toast could be added if hook available
      console.error(e)
    } finally {
      setWithdrawingId("")
    }
  }

  const statusCounts = {
    all: items.length,
    submitted: items.filter((a) => a.status === "submitted").length,
    under_review: items.filter((a) => a.status === "under_review").length,
    interview: items.filter((a) => a.status === "interview").length,
    accepted: items.filter((a) => a.status === "accepted").length,
    rejected: items.filter((a) => a.status === "rejected").length,
    withdrawn: items.filter((a) => a.status === "withdrawn").length,
  }

  useEffect(() => {
    let mounted = true
    if (typeof window !== 'undefined') {
      const t = localStorage.getItem('job_portal_token') || ''
      setAuthToken(t)
    }
    ;(async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const t = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
        const res = await fetch(`/api/applications?userId=${user.id}` , {
          headers: t ? { Authorization: `Bearer ${t}` } : undefined,
        })
        const data = await res.json()
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load applications')
        if (mounted) {
          const normalizeStatus = (s: string): string => {
            if (s === 'reviewed' || s === 'new' || s === 'shortlisted') return 'under_review'
            if (s === 'hired') return 'accepted'
            if (s === 'interview_completed') return 'interview'
            return s
          }
          const mapped: ApplicationItem[] = (data.applications || []).map((a: any) => {
            const rawStatus = a.status || 'submitted'
            const interviewCompleted = String(a.interviewStatus || '').toLowerCase() === 'completed'
            // If hired -> accepted; if interview completed -> interview; map others
            let baseStatus = normalizeStatus(rawStatus)
            // If interview scheduled or completed, show interview unless final states
            const hasInterview = Boolean(a.interviewDate) || interviewCompleted
            const finalStates = ['accepted','rejected','withdrawn']
            const effectiveStatus = (hasInterview && !finalStates.includes(baseStatus)) ? 'interview' : baseStatus
            return {
              _id: String(a._id),
              title: a.title || a.jobTitle || 'Applied Job',
              company: a.company || a.companyName,
              location: a.jobLocation,
              appliedAt: a.createdAt ? new Date(a.createdAt).toDateString() : undefined,
              status: effectiveStatus,
              type: a.jobType,
              interviewDate: a.interviewDate,
              interviewMode: a.interviewMode,
              interviewLocation: a.interviewLocation,
              resumeUrl: a.resumeUrl,
              coverLetterUrl: a.coverLetterUrl,
              notes: a.notes,
              jobId: a.jobId ? String(a.jobId) : undefined,
            }
          })
          setItems(mapped)
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Error loading applications')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [user?.id])

  // Subscribe to application/interview events relevant to the job seeker
  useEvents({
    events: ['application.created', 'application.updated', 'application.deleted', 'application.status_changed', 'interview.created', 'interview.updated'],
    onEvent: (ev) => {
      let payloadId: string | undefined
      try {
        const data = JSON.parse((ev as MessageEvent).data || '{}')
        payloadId = data?.payload?.id ? String(data.payload.id) : undefined
      } catch {}
      ;(async () => {
        try {
          if (!user?.id) return
          const t = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
          const res = await fetch(`/api/applications?userId=${user.id}`, {
            headers: t ? { Authorization: `Bearer ${t}` } : undefined,
          })
          const data = await res.json()
          if (res.ok && data?.ok) {
            const normalizeStatus = (s: string): string => {
              if (s === 'reviewed' || s === 'new' || s === 'shortlisted') return 'under_review'
              if (s === 'hired') return 'accepted'
              if (s === 'interview_completed') return 'interview'
              return s
            }
            const mapped: ApplicationItem[] = (data.applications || []).map((a: any) => {
              const rawStatus = a.status || 'submitted'
              const interviewCompleted = String(a.interviewStatus || '').toLowerCase() === 'completed'
              let baseStatus = normalizeStatus(rawStatus)
              const hasInterview = Boolean(a.interviewDate) || interviewCompleted
              const finalStates = ['accepted','rejected','withdrawn']
              const effectiveStatus = (hasInterview && !finalStates.includes(baseStatus)) ? 'interview' : baseStatus
              return {
                _id: String(a._id),
                title: a.title || a.jobTitle || 'Applied Job',
                company: a.company || a.companyName,
                location: a.jobLocation,
                appliedAt: a.createdAt ? new Date(a.createdAt).toDateString() : undefined,
                status: effectiveStatus,
                type: a.jobType,
                interviewDate: a.interviewDate,
                interviewMode: a.interviewMode,
                interviewLocation: a.interviewLocation,
                resumeUrl: a.resumeUrl,
                coverLetterUrl: a.coverLetterUrl,
                notes: a.notes,
                jobId: a.jobId ? String(a.jobId) : undefined,
              }
            })
            setItems(mapped)
            toast({ description: 'Applications updated' })
          }
        } catch {}
      })()
      // If the details dialog is open for this application, refresh its audit timeline
      ;(async () => {
        try {
          if (!dialogOpen || !openId) return
          // If we got a payload id and it doesn't match the open dialog, skip
          if (payloadId && payloadId !== openId) return
          const t = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
          const res = await fetch(`/api/audit/application/${openId}`, { headers: t ? { Authorization: `Bearer ${t}` } : undefined })
          const data = await res.json()
          if (res.ok && data?.ok) {
            const logs = (data.logs || []).map((l: any) => ({ action: l.action, createdAt: l.createdAt, actorRole: l.actorRole, meta: l.meta }))
            setAuditLogs(logs)
          }
        } catch {}
      })()
    }
  })

  // Open dialog if ?open=<id> is present
  useEffect(() => {
    const id = searchParams.get('open') || ''
    if (id) {
      setOpenId(id)
      setDialogOpen(true)
      // attempt to scroll to the item card
      const el = document.getElementById(`app-${id}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, items.length])

  // Fetch audit history when dialog opens and we have an openId
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!dialogOpen || !openId) return
      try {
        setAuditLoading(true)
        const t = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
        const res = await fetch(`/api/audit/application/${openId}`, {
          headers: t ? { Authorization: `Bearer ${t}` } : undefined,
        })
        const data = await res.json()
        if (mounted) {
          if (res.ok && data?.ok) {
            const logs = (data.logs || []).map((l: any) => ({ action: l.action, createdAt: l.createdAt, actorRole: l.actorRole, meta: l.meta }))
            setAuditLogs(logs)
          } else {
            setAuditLogs([])
          }
        }
      } finally {
        if (mounted) setAuditLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [dialogOpen, openId])

  // Load offers for this seeker and map by applicationId (latest first)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!user?.id) return
        const t = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
        const res = await fetch(`/api/offers?seekerId=${encodeURIComponent(String(user.id))}`, { headers: t ? { Authorization: `Bearer ${t}` } : undefined })
        const data = await res.json()
        if (mounted && res.ok && data?.ok) {
          const byApp: Record<string, any> = {}
          for (const o of (data.offers || [])) {
            const aid = String(o.applicationId)
            if (!byApp[aid]) byApp[aid] = o
            else if (new Date(o.updatedAt || o.createdAt || 0).getTime() > new Date(byApp[aid].updatedAt || byApp[aid].createdAt || 0).getTime()) byApp[aid] = o
          }
          setOffersByApp(byApp)
        }
      } catch {}
    })()
    return () => { mounted = false }
  }, [user?.id])

  // Refresh offers on offer events
  useEvents({
    events: ['offer.created','offer.updated'],
    onEvent: () => {
      ;(async () => {
        try {
          if (!user?.id) return
          const t = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
          const res = await fetch(`/api/offers?seekerId=${encodeURIComponent(String(user.id))}`, { headers: t ? { Authorization: `Bearer ${t}` } : undefined })
          const data = await res.json().catch(() => ({}))
          if (res.ok && data?.ok) {
            const byApp: Record<string, any> = {}
            for (const o of (data.offers || [])) {
              const aid = String(o.applicationId)
              if (!byApp[aid]) byApp[aid] = o
              else if (new Date(o.updatedAt || o.createdAt || 0).getTime() > new Date(byApp[aid].updatedAt || byApp[aid].createdAt || 0).getTime()) byApp[aid] = o
            }
            setOffersByApp(byApp)
          }
        } catch {}
      })()
    }
  })

  // When dialog opens, fetch interviews for this user and extract notes for this application
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!dialogOpen || !openId) return
      try {
        const t = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
        const res = await fetch(`/api/interviews`, { headers: t ? { Authorization: `Bearer ${t}` } : undefined })
        const txt = await res.text().catch(() => '')
        const data = txt ? JSON.parse(txt) : { ok: true, interviews: [] }
        if (mounted && res.ok && data?.ok) {
          const match = (data.interviews || []).find((iv: any) => String(iv.applicationId) === String(openId))
          setOpenInterviewNotes(match?.notes || '')
        }
      } catch {
        if (mounted) setOpenInterviewNotes("")
      }
    })()
    return () => { mounted = false }
  }, [dialogOpen, openId])

  const closeDialog = () => {
    setDialogOpen(false)
    // remove ?open from URL
    const p = new URLSearchParams(searchParams.toString())
    p.delete('open')
    router.replace(p.toString() ? `${pathname}?${p.toString()}` : pathname)
  }

  function buildPrepQuestions(role: string): string[] {
    const r = (role || '').toLowerCase()
    const generic = [
      'Tell me about yourself.',
      'Why are you interested in this role?',
      'What are your strengths?',
      'What are your weaknesses and how do you manage them?',
      'Describe a challenging situation and how you handled it.',
      'Where do you see yourself in 5 years?',
      'Why do you want to work at our company?',
      'Tell me about a time you worked in a team.',
      'How do you prioritize tasks when everything is important?',
      'Describe a time you received critical feedback.',
      'How do you handle pressure and tight deadlines?',
      'What motivates you at work?',
      'Describe a time you took initiative.',
      'Tell me about a time you disagreed with a colleague and how you resolved it.',
      'How do you stay organized?',
      'What does success look like in this position?',
      'Describe a mistake you made and what you learned.',
      'What are your salary expectations?',
      'Why should we hire you?',
      'Do you have any questions for us?',
    ]
    const nursing = [
      'Describe a time you handled a medical emergency. What steps did you take and what was the outcome?',
      'How do you prioritize patient care on a busy shift with limited resources?',
      'How do you communicate complex medical information to patients and their families?',
      'Tell me about your experience with electronic medical records (EMR). Which systems have you used?',
      'How do you ensure patient safety and prevent medication errors? Walk me through your checks.',
      'How do you handle a difficult or non-compliant patient while maintaining rapport?',
      'Describe the infection control procedures you follow for isolation precautions.',
      'How do you collaborate with physicians and the interdisciplinary team to coordinate care?',
      'Describe a time you advocated for a patient. What was the challenge and result?',
      'How do you handle end-of-life care discussions with compassion and clarity?',
      'Explain your approach to triage in the ER or urgent scenarios.',
      'How do you educate patients about discharge instructions to improve adherence?',
      'Describe a situation where you recognized a subtle change in patient condition and acted on it.',
      'What steps do you take to prevent falls and pressure ulcers?',
      'How do you manage pain control balancing efficacy and safety?',
      'Tell me about your experience with IV insertion, maintenance, and complications.',
      'How do you handle a medication reconciliation on admission and discharge?',
      'Explain safe blood administration protocols and monitoring.',
      'How do you de-escalate a tense situation with a stressed family member?',
      'Describe a time you trained or mentored a new nurse or student.',
      'What vital sign changes are most concerning post-op and why?',
      'How do you manage workload when multiple patients need you at once?',
      'Describe a time you caught an error before it reached the patient. How?',
      'How do you document care to ensure legal and clinical accuracy?',
      'Explain your experience with wound care assessment and dressing selection.',
      'How do you screen for and respond to mental health concerns in patients?',
      'Describe your role in antimicrobial stewardship and antibiotic timing.',
      'How do you coordinate care during handoff to the next shift?',
      'Explain your CPR/ACLS experience and a time you participated in a code.',
      'How do you approach cultural sensitivity and language barriers in care?',
      'What is your protocol for handling needlestick injuries and exposure?',
      'How do you evaluate pain in nonverbal patients?',
      'Explain your process for pre-op verification and consent checks.',
      'How do you monitor and manage patients with diabetes (insulin timing, hypo/hyperglycemia)?',
      'Describe best practices for catheter care and reducing CAUTI risk.',
      'How do you recognize and respond to sepsis early warning signs?',
      'Explain fall risk assessments and interventions you implement.',
      'How do you prepare for and assist with bedside procedures?',
      'Describe your experience with telemetry monitoring and interpreting common rhythms.',
      'How do you build trust quickly with a new patient?',
      'Tell me about a time you balanced empathy with boundaries.',
      'How do you handle conflicting priorities from multiple providers?',
      'Describe your experience with pediatric or geriatric patient care.',
      'How do you teach patients about new medications and expected side effects?',
      'Explain the steps you take before administering high-alert medications.',
      'How do you support family members experiencing grief or anxiety?',
      'Describe your approach to continuous improvement and staying current with guidelines.',
      'How do you manage documentation during high-acuity events without missing care?',
      'Tell me about a time you led a safety huddle or contributed to quality improvement.',
      'What does patient-centered care mean to you in practice?'
    ]
    const software = [
      'Explain a system you designed end-to-end.',
      'How do you ensure code quality and reliability?',
      'Describe a challenging bug you fixed.',
      'How do you approach performance optimization?',
      'What is your experience with CI/CD?',
      'How do you handle code reviews?',
      'Explain microservices vs monolith tradeoffs.',
      'How do you design a scalable API?',
      'Tell me about testing strategies you use.',
      'How do you handle incidents in production?',
    ]
    const sales = [
      'Describe your sales process from discovery to close.',
      'How do you handle objections?',
      'Tell me about your most successful deal.',
      'How do you prospect and qualify leads?',
      'How do you manage your pipeline?',
      'Describe a time you lost a deal and why.',
      'How do you build long-term customer relationships?',
      'What CRM tools have you used and how?',
      'How do you handle pricing negotiations?',
      'How do you collaborate with marketing or product teams?',
    ]
    const finance = [
      'Walk me through a financial model you built.',
      'How do you analyze risk in an investment/project?',
      'Describe a time your analysis influenced a decision.',
      'Explain EBITDA and why it matters.',
      'How do you forecast and budget accurately?',
      'What financial KPIs do you track and why?',
      'How do you handle variance analysis?',
      'Describe internal controls you have implemented or followed.',
      'How do you ensure compliance and accuracy?',
      'Tell me about a time you found a cost-saving opportunity.',
    ]
    const category = r.includes('nurse') || r.includes('medical') || r.includes('health') ? nursing
      : r.includes('engineer') || r.includes('developer') || r.includes('software') ? software
      : r.includes('sales') || r.includes('account executive') ? sales
      : r.includes('finance') || r.includes('accountant') || r.includes('analyst') ? finance
      : []
    // Build 50 by combining category + generic + slight variations
    const base = [...category, ...generic]
    const extras = [
      'Describe a time you resolved a conflict at work.',
      'How do you keep your skills up to date?',
      'Tell me about a time you improved a process.',
      'What do you do when you disagree with your manager?',
      'How do you handle multiple stakeholders with competing needs?',
      'Describe a time you mentored or coached someone.',
      'What does good teamwork mean to you?',
      'How do you handle ambiguity?',
      'What would your previous manager say about you?',
      'Describe your ideal work environment.',
      'How do you ensure clear communication?',
      'What is your approach to learning new tools quickly?',
      'How do you set goals and measure progress?',
      'Describe a time you exceeded expectations.',
      'How do you manage stress?',
      'What did you learn from your last role?',
      'How do you prepare for interviews?',
      'How do you prioritize customer satisfaction?',
      'What’s your approach to feedback?',
      'Tell me about a time you showed leadership.',
    ]
    const all = [...base, ...extras]
    // Ensure 50 unique-ish questions
    const unique: string[] = []
    for (const q of all) {
      if (unique.length >= 50) break
      if (!unique.includes(q)) unique.push(q)
    }
    // If still fewer than 50, pad by adding numbered variants
    let i = 1
    while (unique.length < 50) {
      unique.push(`Additional practice question #${i++}`)
    }
    return unique.slice(0, 50)
  }

  return (
    <ProtectedRoute allowedRoles={["job_seeker"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-6">
          {/* Page Header */}
          <PageHeader title="My Applications" description="Track the status of your job applications" />

          {/* Status Overview */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-foreground">{statusCounts.all}</div>
                <p className="text-xs text-muted-foreground">Total Applications</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-sky-600">{statusCounts.submitted}</div>
                <p className="text-xs text-muted-foreground">Submitted</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">{statusCounts.interview}</div>
                <p className="text-xs text-muted-foreground">Interviews</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{statusCounts.accepted}</div>
                <p className="text-xs text-muted-foreground">Offers</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{statusCounts.rejected}</div>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-amber-600">{statusCounts.withdrawn}</div>
                <p className="text-xs text-muted-foreground">Withdrawn</p>
              </CardContent>
            </Card>
          </div>

          {/* Applications List */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>All Applications</CardTitle>
                  <CardDescription>View and manage your job applications</CardDescription>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="interview">Interview</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredApplications.length === 0 ? (
                <EmptyState
                  title="No applications found"
                  description="Change the status filter to see more applications."
                />
              ) : (
                <div className="space-y-4">
                  {filteredApplications.map((app) => (
                    <div id={`app-${app._id}`} key={app._id} className={`p-4 rounded-lg border hover:shadow-sm transition-shadow ${openId === app._id ? 'border-primary shadow-sm' : 'border-border'}`}>
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-foreground mb-1">{app.title}</h3>
                          <p className="text-sm text-muted-foreground">{app.company}</p>
                        </div>
                        {getStatusBadge(app.status)}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {app.location}
                        </span>
                        <Badge variant="outline">{app.type}</Badge>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Applied {app.appliedAt}
                        </span>
                      </div>

                      {app.interviewDate && (
                        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 mb-4">
                          <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                            Interview scheduled for {app.interviewDate}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setOpenId(app._id); setDialogOpen(true); }}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Button>
                        {app.jobId && (
                          <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/jobs/${app.jobId}`)}>
                            View Job
                          </Button>
                        )}
                        {app.status === "interview" && (
                          <Button size="sm" onClick={() => { setPrepRole(app.title || ''); setPrepQuestions(buildPrepQuestions(app.title || '')); setPrepOpen(true) }}>Prepare for Interview</Button>
                        )}
                        {offersByApp[app._id] && (
                          <Button size="sm" variant="secondary" onClick={() => { setOfferForAppId(app._id); setOfferResponse(""); setOfferOpen(true) }}>View Offer</Button>
                        )}
                        {/* Re-apply disabled by server; users can view job instead */}
                        {app.status !== 'accepted' && app.status !== 'rejected' && (
                          <Button size="sm" variant="destructive" disabled={withdrawingId === app._id} onClick={() => withdrawApplication(app._id)}>
                            {withdrawingId === app._id ? 'Withdrawing…' : 'Withdraw'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Details Dialog */}
          <AlertDialog open={dialogOpen} onOpenChange={(v) => v ? setDialogOpen(true) : closeDialog()}>
            <AlertDialogContent className="max-h-[85vh] overflow-hidden flex flex-col">
              <AlertDialogHeader>
                <AlertDialogTitle>Application Details</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  {(() => {
                    const app = items.find(i => i._id === openId)
                    if (!app) return <span className="text-sm text-muted-foreground">No application selected.</span>
                    const extFrom = (u?: string) => (u ? (u.split('?')[0].split('#')[0].split('.').pop() || '') : '').toUpperCase()
                    const resumeExt = extFrom(app.resumeUrl)
                    const coverExt = extFrom(app.coverLetterUrl)
                    const extBadge = (ext: string) => {
                      const e = ext.toUpperCase()
                      const color = e === 'PDF' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : (e === 'DOC' || e === 'DOCX') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-muted text-muted-foreground'
                      return <span className={`ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${color}`}>{e}</span>
                    }
                    const timeline: { label: string; sub?: string; current?: boolean }[] = [
                      { label: 'Submitted', sub: app.appliedAt },
                      { label: 'Under Review', current: app.status === 'under_review' },
                      { label: 'Interview', sub: app.interviewDate, current: app.status === 'interview' },
                      { label: 'Offer', current: app.status === 'accepted' },
                      { label: 'Rejected', current: app.status === 'rejected' },
                      { label: 'Withdrawn', current: app.status === 'withdrawn' },
                    ]
                    return (
                      <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto pr-1">
                        {/* Status Summary */}
                        <div className={`p-3 rounded-lg border ${app.status === 'accepted' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : app.status === 'rejected' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : app.status === 'withdrawn' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">Current status:</span> {getStatusBadge(app.status)}
                            {app.appliedAt && <span className="text-muted-foreground">• Applied {app.appliedAt}</span>}
                            {app.interviewDate && <span className="text-muted-foreground">• Interview {new Date(app.interviewDate).toLocaleString()}</span>}
                          </div>
                        </div>

                        {/* Key Info Grid */}
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-border p-3">
                            <div className="text-xs text-muted-foreground mb-1">Position</div>
                            <div className="font-medium text-foreground">{app.title}</div>
                          </div>
                          <div className="rounded-lg border border-border p-3">
                            <div className="text-xs text-muted-foreground mb-1">Company</div>
                            <div className="font-medium text-foreground">{app.company || '—'}</div>
                          </div>
                          <div className="rounded-lg border border-border p-3">
                            <div className="text-xs text-muted-foreground mb-1">Location</div>
                            <div className="font-medium text-foreground flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {app.location || '—'}</div>
                          </div>
                          <div className="rounded-lg border border-border p-3">
                            <div className="text-xs text-muted-foreground mb-1">Applied</div>
                            <div className="font-medium text-foreground flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> {app.appliedAt || '—'}</div>
                          </div>
                        </div>

                        {/* Interview Details */}
                        {app.interviewDate && (
                          <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-900/20 p-3 space-y-2">
                            <div className="text-sm font-medium">Interview</div>
                            <div className="text-foreground">{new Date(app.interviewDate).toLocaleString()}</div>
                            <div className="flex flex-wrap items-center gap-2">
                              {app.interviewMode && <Badge variant="outline">Mode: {String(app.interviewMode).toLowerCase() === 'remote' ? 'Video' : 'Onsite'}</Badge>}
                              {app.type && <Badge variant="secondary">{app.type}</Badge>}
                              {app.interviewLocation && <Badge variant="outline">Details: {app.interviewLocation}</Badge>}
                            </div>
                            {openInterviewNotes && (
                              <div className="text-sm text-foreground bg-background/60 border border-border rounded-md p-2">
                                <div className="text-xs text-muted-foreground mb-1">Employer Notes</div>
                                <div className="whitespace-pre-wrap">{openInterviewNotes}</div>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => {
                                try {
                                  const dt = new Date(app.interviewDate as string)
                                  const pad = (n: number) => String(n).padStart(2, '0')
                                  const toICSDate = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
                                  const dtStart = toICSDate(dt)
                                  const dtEnd = toICSDate(new Date(dt.getTime() + 60*60*1000))
                                  const summary = `Interview: ${app.title}`
                                  const description = `Interview for ${app.title}${app.company ? ' at ' + app.company : ''}${app.interviewMode ? ' | Mode: ' + app.interviewMode : ''}${app.interviewLocation ? ' | Details: ' + app.interviewLocation : ''}`
                                  const location = app.interviewLocation || ''
                                  const ics = [
                                    'BEGIN:VCALENDAR',
                                    'VERSION:2.0',
                                    'PRODID:-//Job Portal//Interview//EN',
                                    'BEGIN:VEVENT',
                                    `UID:${app._id}@job-portal`,
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
                                  a.download = `interview-${app._id}.ics`
                                  document.body.appendChild(a)
                                  a.click()
                                  a.remove()
                                  URL.revokeObjectURL(url)
                                } catch {}
                              }}>Add to Calendar</Button>
                              {app.interviewLocation && /^(https?:\/\/)/i.test(app.interviewLocation) && (
                                <Button size="sm" variant="secondary" onClick={() => window.open(app.interviewLocation!, '_blank')}>Open Link</Button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Timeline */}
                        <div className="pt-2">
                          <div className="font-medium mb-2">Timeline</div>
                          <ol className="space-y-2">
                            {timeline.map((t, idx) => (
                              <li key={idx} className={`flex items-start gap-3 ${t.current ? 'text-foreground' : 'text-muted-foreground'}`}>
                                <span className={`mt-1 h-2 w-2 rounded-full ${t.current ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                                <div>
                                  <div className="text-sm font-medium">{t.label}</div>
                                  {t.sub && <div className="text-xs text-muted-foreground">{t.sub}</div>}
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>

                        {/* Status History */}
                        <div className="pt-2">
                          <div className="font-medium mb-2">Status History</div>
                          {auditLoading ? (
                            <div className="text-xs text-muted-foreground">Loading history…</div>
                          ) : (
                            (() => {
                              // Build a status timeline starting with Submitted (from appliedAt or audit created)
                              const app = items.find(i => i._id === openId)
                              const initialTs = app?.appliedAt ? new Date(app.appliedAt).toISOString() : undefined
                              const statusLogs = auditLogs.filter(l => l.action === 'application_status_changed')
                              const human = (to: string) => {
                                const t = (to || '').toLowerCase()
                                if (t === 'hired') return 'Accepted'
                                if (t === 'interview' || t === 'interview_scheduled' || t === 'interview_completed') return 'Interview'
                                if (t === 'rejected') return 'Rejected'
                                if (t === 'reviewed' || t === 'new' || t === 'shortlisted' || t === 'under_review') return 'Under Review'
                                if (t === 'submitted') return 'Submitted'
                                return to || 'Status Updated'
                              }
                              const timeline: Array<{ label: string; ts?: string }> = []
                              timeline.push({ label: 'Submitted', ts: initialTs })
                              for (const l of statusLogs) {
                                timeline.push({ label: human(l?.meta?.to || ''), ts: l.createdAt })
                              }
                              return (
                                <ul className="space-y-2 text-xs">
                                  {timeline.map((t, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className={`mt-1 h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-sky-500/70' : 'bg-blue-500/70'}`} />
                                      <div>
                                        <div className="font-medium">{t.label}</div>
                                        <div className="text-muted-foreground">{t.ts ? new Date(t.ts).toLocaleString() : ''}</div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )
                            })()
                          )}
                        </div>

                        {/* Full History */}
                        <div className="pt-2">
                          <div className="font-medium mb-2">History</div>
                          {auditLoading ? (
                            <div className="text-xs text-muted-foreground">Loading history…</div>
                          ) : auditLogs.length === 0 ? (
                            <div className="text-xs text-muted-foreground">No history found.</div>
                          ) : (
                            <ul className="space-y-1 text-xs">
                              {auditLogs.map((h, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                                  <span className="font-medium">{h.action}</span>
                                  {h.actorRole && <span className="text-muted-foreground">• {h.actorRole}</span>}
                                  {h.createdAt && <span className="text-muted-foreground">• {new Date(h.createdAt).toLocaleString()}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Attachments */}
                        {(app.resumeUrl || app.coverLetterUrl) && (
                          <div className="pt-2">
                            <div className="font-medium mb-2">Attachments</div>
                            <div className="flex flex-wrap gap-3">
                              {app.resumeUrl && (
                                <>
                                  <a className="inline-flex items-center gap-1 text-primary underline" href={`/api/files/proxy?path=${encodeURIComponent(app.resumeUrl)}${authToken ? `&token=${encodeURIComponent(authToken)}` : ''}`} target="_blank" rel="noopener noreferrer">
                                    {(() => { const I = extToIcon((resumeExt||'').toLowerCase()); return <I className={`h-3.5 w-3.5 ${extIconClass(resumeExt)}`} /> })()} View Resume {resumeExt && extBadge(resumeExt)}
                                  </a>
                                  <a className="text-muted-foreground underline" href={`/api/files/proxy?path=${encodeURIComponent(app.resumeUrl)}&download=1${authToken ? `&token=${encodeURIComponent(authToken)}` : ''}`}>Download Resume</a>
                                </>
                              )}
                              {app.coverLetterUrl && (
                                <>
                                  <a className="inline-flex items-center gap-1 text-primary underline" href={`/api/files/proxy?path=${encodeURIComponent(app.coverLetterUrl)}${authToken ? `&token=${encodeURIComponent(authToken)}` : ''}`} target="_blank" rel="noopener noreferrer">
                                    {(() => { const I = extToIcon((coverExt||'').toLowerCase()); return <I className={`h-3.5 w-3.5 ${extIconClass(coverExt)}`} /> })()} View Cover Letter {coverExt && extBadge(coverExt)}
                                  </a>
                                  <a className="text-muted-foreground underline" href={`/api/files/proxy?path=${encodeURIComponent(app.coverLetterUrl)}&download=1${authToken ? `&token=${encodeURIComponent(authToken)}` : ''}`}>Download Cover Letter</a>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {app.notes && (
                          <div className="pt-1">
                            <div className="font-medium mb-1">Notes</div>
                            <div className="text-muted-foreground whitespace-pre-wrap">{app.notes}</div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={closeDialog}>Back</AlertDialogCancel>
                <AlertDialogAction onClick={closeDialog}>Close</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DashboardLayout>
    {/* Interview Preparation Modal */}
    <AlertDialog open={prepOpen} onOpenChange={(v) => setPrepOpen(Boolean(v))}>
      <AlertDialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle>Interview Preparation</AlertDialogTitle>
          <AlertDialogDescription>
            {prepRole ? `Role: ${prepRole}` : 'Practice with real interview questions'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2 pb-2">
          <Button size="sm" variant="outline" onClick={() => {
            try {
              const text = prepQuestions.map((q, i) => `${i+1}. ${q}`).join('\n')
              navigator.clipboard.writeText(text)
              toast({ description: 'Copied 50 questions to clipboard' })
            } catch {}
          }}>Copy All</Button>
          <Button size="sm" variant="outline" onClick={() => {
            try {
              const text = prepQuestions.map((q, i) => `${i+1}. ${q}`).join('\n')
              const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `interview-prep-${(prepRole||'role').toLowerCase().replace(/\s+/g,'-')}.txt`
              document.body.appendChild(a)
              a.click()
              a.remove()
              URL.revokeObjectURL(url)
            } catch {}
          }}>Download</Button>
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
          <ol className="space-y-2 list-decimal list-inside">
            {prepQuestions.map((q, idx) => (
              <li key={idx} className="text-sm text-foreground">{q}</li>
            ))}
          </ol>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setPrepOpen(false)}>Close</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {/* View Offer Modal */}
    <AlertDialog open={offerOpen} onOpenChange={(v) => setOfferOpen(Boolean(v))}>
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Offer Details</AlertDialogTitle>
          <AlertDialogDescription asChild>
            {(() => {
              const off = offersByApp[offerForAppId]
              if (!off) return <span className="text-sm text-muted-foreground">No offer found.</span>
              return (
                <div className="space-y-2 text-sm">
                  {off.title && <div><span className="font-medium">Title:</span> {off.title}</div>}
                  {off.message && (
                    <div>
                      <div className="font-medium">Message</div>
                      <div className="text-muted-foreground whitespace-pre-wrap">{off.message}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {off.salary && <div><span className="font-medium">Salary:</span> {off.salary}</div>}
                    {off.startDate && <div><span className="font-medium">Start Date:</span> {off.startDate}</div>}
                  </div>
                  <div><span className="font-medium">Status:</span> {off.status || 'sent'}</div>
                </div>
              )
            })()}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <div className="text-sm font-medium">Your Message (optional)</div>
          <Textarea rows={4} value={offerResponse} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOfferResponse(e.target.value)} placeholder="Optionally add a note when accepting the offer" />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setOfferOpen(false)}>Close</AlertDialogCancel>
          <AlertDialogAction onClick={async () => {
            try {
              const off = offersByApp[offerForAppId]
              if (!off?._id) { toast({ description: 'Offer not found', variant: 'destructive' }); return }
              const t = typeof window !== 'undefined' ? (localStorage.getItem('job_portal_token') || '') : ''
              const res = await fetch(`/api/offers/${encodeURIComponent(String(off._id))}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
                body: JSON.stringify({ status: 'accepted', seekerResponse: offerResponse })
              })
              const data = await res.json().catch(() => ({}))
              if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Failed to accept offer')
              toast({ description: 'Offer accepted' })
              setOfferOpen(false)
              // Refresh applications
              try {
                if (!user?.id) return
                const r = await fetch(`/api/applications?userId=${user.id}`, { headers: t ? { Authorization: `Bearer ${t}` } : undefined })
                const d = await r.json().catch(() => ({}))
                if (r.ok && d?.ok) {
                  const normalizeStatus = (s: string): string => {
                    if (s === 'submitted' || s === 'reviewed' || s === 'new' || s === 'shortlisted') return 'under_review'
                    if (s === 'hired') return 'accepted'
                    if (s === 'interview_completed') return 'interview'
                    return s
                  }
                  const mapped: ApplicationItem[] = (d.applications || []).map((a: any) => {
                    const rawStatus = a.status || 'under_review'
                    const interviewCompleted = String(a.interviewStatus || '').toLowerCase() === 'completed'
                    let baseStatus = normalizeStatus(rawStatus)
                    const hasInterview = Boolean(a.interviewDate) || interviewCompleted
                    const finalStates = ['accepted','rejected','withdrawn']
                    const effectiveStatus = (hasInterview && !finalStates.includes(baseStatus)) ? 'interview' : baseStatus
                    return {
                      _id: String(a._id),
                      title: a.title || a.jobTitle || 'Applied Job',
                      company: a.company || a.companyName,
                      location: a.jobLocation,
                      appliedAt: a.createdAt ? new Date(a.createdAt).toDateString() : undefined,
                      status: effectiveStatus,
                      type: a.jobType,
                      interviewDate: a.interviewDate,
                      interviewMode: a.interviewMode,
                      interviewLocation: a.interviewLocation,
                      resumeUrl: a.resumeUrl,
                      coverLetterUrl: a.coverLetterUrl,
                      notes: a.notes,
                      jobId: a.jobId ? String(a.jobId) : undefined,
                    }
                  })
                  setItems(mapped)
                }
              } catch {}
            } catch (e: any) {
              toast({ description: e?.message || 'Failed to accept offer', variant: 'destructive' })
            }
          }}>Accept Offer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </ProtectedRoute>
  )
}

