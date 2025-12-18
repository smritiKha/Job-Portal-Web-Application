"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Home, Search, Briefcase, FileText, Bookmark, Printer, GraduationCap, Award, FolderGit2, BookOpen } from "lucide-react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { useToast } from "@/hooks/use-toast"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home, current: false },
  { name: "Find Jobs", href: "/dashboard/jobs", icon: Search, current: false },
  { name: "Applications", href: "/dashboard/applications", icon: Briefcase, current: false },
  { name: "Training", href: "/dashboard/training", icon: BookOpen, current: false },
  { name: "Profile", href: "/dashboard/profile", icon: FileText, current: false },
  { name: "Saved Jobs", href: "/dashboard/saved", icon: Bookmark, current: false },
]

export default function ResumeBuilderPage() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any | null>(null)
  const [resumeTemplate, setResumeTemplate] = useState<string>("modern")
  const { toast } = useToast()

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!user?.id) return
        const res = await fetch(`/api/users/${user.id}`)
        const data = await res.json()
        if (mounted && res.ok && data?.ok) {
          setProfile(data.user)
          if (data.user?.resumeTemplate) setResumeTemplate(String(data.user.resumeTemplate))
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [user?.id])

  const printResume = () => {
    window.print()
  }

  const fullName = (() => {
    const n = String(profile?.name || "")
    return n || String(user?.name || "")
  })()

  async function onChangeTemplate(next: string) {
    try {
      setResumeTemplate(next)
      if (!user?.id) return
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeTemplate: next })
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to save template')
      toast({ description: 'Template updated' })
    } catch (e: any) {
      toast({ description: e?.message || 'Failed to save template', variant: 'destructive' })
    }
  }

  return (
    <ProtectedRoute allowedRoles={["job_seeker"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="max-w-4xl mx-auto space-y-6">
          <PageHeader
            title="Resume Builder"
            description="Preview and print your resume as a PDF."
            actions={
              <Button onClick={printResume}>
                <Printer className="mr-2 h-4 w-4" />
                Print / Save as PDF
              </Button>
            }
          />

          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Preview</CardTitle>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Template</label>
                  <select
                    className="border rounded-md px-2 py-1 text-sm bg-background"
                    value={resumeTemplate}
                    onChange={(e) => onChangeTemplate(e.target.value)}
                  >
                    <option value="modern">Modern</option>
                    <option value="minimal">Minimal</option>
                    <option value="compact">Compact</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading profile…</div>
              ) : !profile ? (
                <div className="text-sm text-muted-foreground">No profile data.</div>
              ) : (
                <div className={`bg-white text-black p-8 rounded-md shadow-sm print:shadow-none print:p-0 ${resumeTemplate === 'compact' ? 'text-sm' : ''}`}>
                  {/* Header */}
                  <div className={`flex items-start justify-between ${resumeTemplate === 'minimal' ? 'border-b pb-3' : ''}`}>
                    <div>
                      <h1 className={`font-bold ${resumeTemplate === 'modern' ? 'text-2xl text-job-blue-900' : 'text-xl'}`}>{fullName}</h1>
                      <div className="text-sm text-gray-600">
                        <span>{profile.email}</span>
                        {profile.phone ? <span className="ml-3">{profile.phone}</span> : null}
                        {profile.location ? <span className="ml-3">{profile.location}</span> : null}
                      </div>
                      {profile.title ? (
                        <div className={`text-sm mt-1 ${resumeTemplate === 'modern' ? 'text-job-blue-700' : 'text-gray-700'}`}>{profile.title}</div>
                      ) : null}
                    </div>
                  </div>

                  {/* Summary / Bio */}
                  {profile.bio ? (
                    <div className={`mt-6 ${resumeTemplate === 'minimal' ? '' : ''}`}>
                      <div className={`flex items-center gap-2 ${resumeTemplate === 'modern' ? 'text-job-blue-800' : ''}`}>
                        <FileText className="h-4 w-4" />
                        <h2 className="text-lg font-semibold">Summary</h2>
                      </div>
                      {resumeTemplate === 'modern' && <div className="mt-1 h-[2px] w-10 bg-job-blue-300" />}
                      <p className="text-sm leading-6 mt-1 whitespace-pre-wrap">{profile.bio}</p>
                    </div>
                  ) : null}

                  {/* Skills */}
                  {Array.isArray(profile.skills) && profile.skills.length > 0 ? (
                    <div className="mt-6">
                      <div className={`flex items-center gap-2 ${resumeTemplate === 'modern' ? 'text-job-blue-800' : ''}`}>
                        <Bookmark className="h-4 w-4" />
                        <h2 className="text-lg font-semibold">Skills</h2>
                      </div>
                      {resumeTemplate === 'modern' && <div className="mt-1 h-[2px] w-10 bg-job-blue-300" />}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profile.skills.map((s: string, i: number) => (
                          <span key={i} className={`text-xs px-2 py-1 rounded-full border ${resumeTemplate === 'modern' ? 'border-job-blue-200 text-job-blue-900' : 'border-gray-300'}`}>{s}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Experience */}
                  {Array.isArray(profile.experiences) && profile.experiences.length > 0 ? (
                    <div className="mt-6">
                      <div className={`flex items-center gap-2 ${resumeTemplate === 'modern' ? 'text-job-blue-800' : ''}`}>
                        <Briefcase className="h-4 w-4" />
                        <h2 className="text-lg font-semibold">Experience</h2>
                      </div>
                      {resumeTemplate === 'modern' && <div className="mt-1 h-[2px] w-10 bg-job-blue-300" />}
                      <div className="mt-2 space-y-4">
                        {profile.experiences.map((e: any, idx: number) => (
                          <div key={idx}>
                            <div className="flex items-center justify-between">
                              <div className={`font-medium ${resumeTemplate === 'modern' ? 'text-job-blue-900' : ''}`}>{e.title}</div>
                              <div className="text-sm text-gray-600">{e.start}{e.end ? ` - ${e.end}` : ''}</div>
                            </div>
                            <div className={`text-sm ${resumeTemplate === 'modern' ? 'text-job-blue-700' : 'text-gray-700'}`}>{e.company}</div>
                            {e.description ? (
                              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{e.description}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Education */}
                  {Array.isArray(profile.education) && profile.education.length > 0 ? (
                    <div className="mt-6">
                      <div className={`flex items-center gap-2 ${resumeTemplate === 'modern' ? 'text-job-blue-800' : ''}`}>
                        <GraduationCap className="h-4 w-4" />
                        <h2 className="text-lg font-semibold">Education</h2>
                      </div>
                      {resumeTemplate === 'modern' && <div className="mt-1 h-[2px] w-10 bg-job-blue-300" />}
                      <div className="mt-2 space-y-4">
                        {profile.education.map((e: any, idx: number) => (
                          <div key={idx}>
                            <div className="flex items-center justify-between">
                              <div className={`font-medium ${resumeTemplate === 'modern' ? 'text-job-blue-900' : ''}`}>{e.degree}</div>
                              <div className="text-sm text-gray-600">{e.start}{e.end ? ` - ${e.end}` : ''}</div>
                            </div>
                            <div className={`text-sm ${resumeTemplate === 'modern' ? 'text-job-blue-700' : 'text-gray-700'}`}>{e.school}</div>
                            {e.description ? (
                              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{e.description}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Projects */}
                  {Array.isArray(profile.projects) && profile.projects.length > 0 ? (
                    <div className="mt-6">
                      <div className={`flex items-center gap-2 ${resumeTemplate === 'modern' ? 'text-job-blue-800' : ''}`}>
                        <FolderGit2 className="h-4 w-4" />
                        <h2 className="text-lg font-semibold">Projects</h2>
                      </div>
                      {resumeTemplate === 'modern' && <div className="mt-1 h-[2px] w-10 bg-job-blue-300" />}
                      <div className="mt-2 space-y-4">
                        {profile.projects.map((p: any, idx: number) => (
                          <div key={idx}>
                            <div className="flex items-center justify-between">
                              <div className={`font-medium ${resumeTemplate === 'modern' ? 'text-job-blue-900' : ''}`}>{p.name}</div>
                              <div className="text-sm text-gray-600">{p.start}{p.end ? ` - ${p.end}` : ''}</div>
                            </div>
                            <div className={`text-sm ${resumeTemplate === 'modern' ? 'text-job-blue-700' : 'text-gray-700'}`}>{p.role} {p.link ? (<a className="ml-2 underline" href={p.link} target="_blank" rel="noreferrer">Link</a>) : null}</div>
                            {p.description ? (
                              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{p.description}</p>
                            ) : null}
                            {Array.isArray(p.tech) && p.tech.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-2">
                                {p.tech.map((t: string, i: number) => (
                                  <span key={i} className={`text-xs px-2 py-1 rounded-full border ${resumeTemplate === 'modern' ? 'border-job-blue-200 text-job-blue-900' : 'border-gray-300'}`}>{t}</span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Certifications */}
                  {Array.isArray(profile.certifications) && profile.certifications.length > 0 ? (
                    <div className="mt-6">
                      <div className={`flex items-center gap-2 ${resumeTemplate === 'modern' ? 'text-job-blue-800' : ''}`}>
                        <Award className="h-4 w-4" />
                        <h2 className="text-lg font-semibold">Certifications</h2>
                      </div>
                      {resumeTemplate === 'modern' && <div className="mt-1 h-[2px] w-10 bg-job-blue-300" />}
                      <div className="mt-2 space-y-4">
                        {profile.certifications.map((c: any, idx: number) => (
                          <div key={idx}>
                            <div className="flex items-center justify-between">
                              <div className={`font-medium ${resumeTemplate === 'modern' ? 'text-job-blue-900' : ''}`}>{c.name}</div>
                              <div className="text-sm text-gray-600">{c.date}</div>
                            </div>
                            <div className={`text-sm ${resumeTemplate === 'modern' ? 'text-job-blue-700' : 'text-gray-700'}`}>{c.issuer} {c.link ? (<a className="ml-2 underline" href={c.link} target="_blank" rel="noreferrer">Verify</a>) : null}</div>
                            {c.credentialId ? (
                              <div className="text-xs text-gray-600 mt-1">Credential ID: {c.credentialId}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <style jsx global>{`
          @media print {
            header, nav, .print\:hidden, .print\:sr-only, .container.mx-auto.px-4.py-8 > :not(.print-area) { display: none !important; }
            .print-area { display: block !important; }
            .bg-white { background: white !important; }
          }
        `}</style>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
