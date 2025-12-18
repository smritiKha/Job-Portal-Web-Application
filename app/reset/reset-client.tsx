"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Briefcase } from "lucide-react"

export default function ResetClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token") || ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!token) {
      toast({ title: 'Invalid link', description: 'Missing password reset token.', variant: 'destructive' })
    }
  }, [token, toast])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      toast({ title: 'Invalid link', description: 'Missing password reset token.', variant: 'destructive' })
      return
    }
    if (!password || password.length < 8) {
      toast({ title: 'Weak password', description: 'Password must be at least 8 characters.' })
      return
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', description: 'Please re-enter your passwords.' })
      return
    }
    try {
      setSubmitting(true)
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Reset failed')
      toast({ title: 'Password updated', description: 'You can now sign in with your new password.' })
      router.push('/login')
    } catch (e: any) {
      toast({ title: 'Reset failed', description: e?.message || 'Please request a new link.', variant: 'destructive' })
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
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>Enter a new password for your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" disabled={submitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" disabled={submitting} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting || !token}>{submitting ? 'Updating…' : 'Update password'}</Button>
            </form>
            <div className="mt-6 text-center text-sm">
              <Link href="/login" className="text-primary hover:underline">Back to login</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
