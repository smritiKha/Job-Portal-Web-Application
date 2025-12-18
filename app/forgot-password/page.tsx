"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Briefcase } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const [resetUrl, setResetUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) {
      toast({ title: "Email required", description: "Please enter your account email." })
      return
    }
    try {
      setSubmitting(true)
      const res = await fetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Request failed')
      toast({ title: 'Check your email', description: 'If your email exists, we sent password reset instructions.' })
      // Dev helpers: show reset link(s) if the API returned them
      setResetUrl(data?.resetUrl || null)
      setPreviewUrl(data?.previewUrl || null)
    } catch (e: any) {
      toast({ title: 'Unable to send reset link', description: e?.message || 'Try again later', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/60">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Briefcase className="h-10 w-10 text-primary" />
          <span className="text-3xl font-bold text-foreground">JobPortal</span>
        </div>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-2xl">Forgot Password</CardTitle>
            <CardDescription>We will send password reset instructions to your email</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Sending…' : 'Send reset link'}</Button>
            </form>
            {(resetUrl || previewUrl) && (
              <div className="mt-6 rounded-lg border p-4 text-sm space-y-2">
                <div className="font-medium">Developer shortcuts</div>
                {resetUrl && (
                  <div>
                    <span className="text-muted-foreground">Reset URL: </span>
                    <a className="text-primary underline break-all" href={resetUrl}>{resetUrl}</a>
                  </div>
                )}
                {previewUrl && (
                  <div>
                    <span className="text-muted-foreground">Email preview: </span>
                    <a className="text-primary underline break-all" href={previewUrl} target="_blank" rel="noreferrer">{previewUrl}</a>
                  </div>
                )}
              </div>
            )}
            <div className="mt-6 text-center text-sm">
              <Link href="/login" className="text-primary hover:underline">Back to login</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
