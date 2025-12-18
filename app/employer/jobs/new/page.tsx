"use client"

import type React from "react"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LayoutDashboard, Briefcase, Users, Calendar, Save, Send } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"

const navigation = [
  { name: "Dashboard", href: "/employer", icon: LayoutDashboard, current: false },
  { name: "My Jobs", href: "/employer/jobs", icon: Briefcase, current: false },
  { name: "Applicants", href: "/employer/applicants", icon: Users, current: false },
  { name: "Interviews", href: "/employer/interviews", icon: Calendar, current: false },
]

export default function NewJobPage() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  // Controlled fields used by API
  const [title, setTitle] = useState("")
  const [location, setLocation] = useState("")
  const [salaryMin, setSalaryMin] = useState("")
  const [salaryMax, setSalaryMax] = useState("")
  const [description, setDescription] = useState("")
  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState("")
  const [jobType, setJobType] = useState<"full-time" | "part-time" | "contract" | "internship" | "">("")
  const [category, setCategory] = useState<string>("")
  const [questionsText, setQuestionsText] = useState<string>("")
  const [errors, setErrors] = useState<{ title?: string; location?: string; description?: string; salary?: string }>(() => ({}))

  const editId = String(searchParams?.get('edit') || '')
  const isEdit = Boolean(editId)

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  const handleSubmit = async (e: React.FormEvent, isDraft: boolean) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      setErrors({})
      // Basic validation
      if (!title?.trim()) { setErrors((e) => ({ ...e, title: 'Title is required' })); throw new Error("Job title is required") }
      if (!location?.trim()) { setErrors((e) => ({ ...e, location: 'Location is required' })); throw new Error("Location is required") }
      if (!description?.trim()) { setErrors((e) => ({ ...e, description: 'Description is required' })); throw new Error("Description is required") }
      const min = salaryMin ? Number(salaryMin) : undefined
      const max = salaryMax ? Number(salaryMax) : undefined
      if (min && max && min > max) { setErrors((e) => ({ ...e, salary: 'Salary min cannot exceed max' })); throw new Error("Salary min cannot exceed max") }

      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const payload = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        salaryMin: typeof min === 'number' && !Number.isNaN(min) ? min : undefined,
        salaryMax: typeof max === 'number' && !Number.isNaN(max) ? max : undefined,
        skills,
        status: isDraft ? 'closed' : 'open',
        type: jobType || undefined,
        category: category || undefined,
        // server normalizes either screeningQuestions[] or questions string into array
        questions: questionsText || undefined,
      }
      const url = isEdit ? `/api/jobs/${encodeURIComponent(editId)}` : '/api/jobs'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok === false) throw new Error(data?.error || (isEdit ? 'Failed to update job' : 'Failed to create job'))
      
      // Show appropriate success message
      if (isEdit) {
        toast({ 
          title: 'Job Updated',
          description: 'Your job has been updated successfully.',
        })
      } else if (isDraft) {
        toast({
          title: 'Draft Saved',
          description: 'Your job has been saved as a draft.',
        })
      } else {
        toast({
          title: 'Job Submitted for Review',
          description: 'Your job posting has been submitted and is pending admin approval. You will be notified once it is approved.',
          duration: 10000, // Show for 10 seconds
        })
      }
      
      router.push('/employer/jobs')
    } catch (err: any) {
      toast({ description: err?.message || (isEdit ? 'Failed to update job' : 'Failed to post job'), variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!isEdit) return
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
        const res = await fetch(`/api/jobs/${encodeURIComponent(editId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data?.ok && mounted) {
          const j = data.job
          setTitle(j?.title || '')
          setLocation(j?.location || '')
          setDescription(j?.description || '')
          setSkills(Array.isArray(j?.skills) ? j.skills : [])
          setSalaryMin(typeof j?.salaryMin === 'number' ? String(j.salaryMin) : '')
          setSalaryMax(typeof j?.salaryMax === 'number' ? String(j.salaryMax) : '')
          setJobType((j?.type as any) || "")
          setCategory(j?.category || "")
          setQuestionsText(Array.isArray(j?.screeningQuestions) ? (j.screeningQuestions as string[]).join('\n') : (j?.questions || ""))
        }
      } catch {}
    })()
    return () => { mounted = false }
  }, [isEdit, editId])

  return (
    <ProtectedRoute allowedRoles={["employer"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">{isEdit ? 'Edit Job' : 'Post a New Job'}</h1>
            <p className="text-muted-foreground mt-2">{isEdit ? 'Update the details of your job posting' : 'Fill in the details to create a new job posting'}</p>
          </div>

          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Essential details about the position</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Job Title *</Label>
                  <Input id="title" placeholder="e.g. Senior React Developer" required value={title} onChange={(e) => setTitle(e.target.value)} />
                  {errors.title && <div className="text-xs text-destructive">{errors.title}</div>}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="type">Employment Type *</Label>
                    <Select required value={jobType} onValueChange={(v) => setJobType(v as any)}>
                      <SelectTrigger id="type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full-time">Full-time</SelectItem>
                        <SelectItem value="part-time">Part-time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select required value={category} onValueChange={(v) => setCategory(v)}>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IT">IT</SelectItem>
                        <SelectItem value="Education">Education</SelectItem>
                        <SelectItem value="Medical">Medical</SelectItem>
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Design">Design</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Administrative/Management">Administrative/Management</SelectItem>
                        <SelectItem value="HR">HR</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="Product">Product</SelectItem>
                        <SelectItem value="Data">Data</SelectItem>
                        <SelectItem value="Legal">Legal</SelectItem>
                        <SelectItem value="Support">Support</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location *</Label>
                    <Input id="location" placeholder="e.g. Remote, New York, NY" required value={location} onChange={(e) => setLocation(e.target.value)} />
                    {errors.location && <div className="text-xs text-destructive">{errors.location}</div>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="experience">Experience Level *</Label>
                    <Select required>
                      <SelectTrigger id="experience">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entry">Entry Level</SelectItem>
                        <SelectItem value="mid">Mid Level</SelectItem>
                        <SelectItem value="senior">Senior Level</SelectItem>
                        <SelectItem value="lead">Lead/Principal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="salary-min">Salary Range (Min, NPR)</Label>
                    <Input id="salary-min" type="number" placeholder="65000" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="salary-max">Salary Range (Max, NPR)</Label>
                    <Input id="salary-max" type="number" placeholder="120000" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
                  </div>
                </div>
                {errors.salary && <div className="text-xs text-destructive">{errors.salary}</div>}

                {/* Skills tags */}
                <div className="space-y-2">
                  <Label>Required Skills</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a skill and press Enter"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const v = newSkill.trim()
                          if (v && !skills.includes(v) && skills.length < 20) setSkills((prev) => [...prev, v])
                          setNewSkill("")
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={() => {
                      const v = newSkill.trim()
                      if (v && !skills.includes(v) && skills.length < 20) setSkills((prev) => [...prev, v])
                      setNewSkill("")
                    }}>Add</Button>
                  </div>
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {skills.map((s) => (
                        <span key={s} className="text-xs px-2 py-1 rounded bg-muted flex items-center gap-2">
                          {s}
                          <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => setSkills(skills.filter((x) => x !== s))}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Job Description */}
            <Card>
              <CardHeader>
                <CardTitle>Job Description</CardTitle>
                <CardDescription>Detailed information about the role</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the role, responsibilities, and what makes this opportunity great..."
                    rows={6}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  {errors.description && <div className="text-xs text-destructive">{errors.description}</div>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requirements">Requirements *</Label>
                  <Textarea
                    id="requirements"
                    placeholder="List the required skills, qualifications, and experience..."
                    rows={6}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="benefits">Benefits</Label>
                  <Textarea
                    id="benefits"
                    placeholder="List the benefits and perks offered with this position..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Application Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Application Settings</CardTitle>
                <CardDescription>Configure how candidates can apply</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="deadline">Application Deadline</Label>
                  <Input id="deadline" type="date" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="questions">Screening Questions</Label>
                  <Textarea
                    id="questions"
                    placeholder="Add custom questions for applicants (one per line)..."
                    rows={4}
                    value={questionsText}
                    onChange={(e) => setQuestionsText(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => router.push("/employer/jobs")}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={(e) => handleSubmit(e as any, true)}
                disabled={isSubmitting}
              >
                <Save className="mr-2 h-4 w-4" />
                {isEdit ? 'Save as Draft' : 'Save as Draft'}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Send className="mr-2 h-4 w-4" />
                {isSubmitting ? (isEdit ? 'Saving...' : 'Publishing...') : (isEdit ? 'Save Changes' : 'Publish Job')}
              </Button>
            </div>
          </form>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
