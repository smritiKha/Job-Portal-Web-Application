"use client"

import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function MessagesRedirect() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      if (user.role === "job_seeker") {
        router.push("/dashboard/messages")
      } else if (user.role === "employer") {
        router.push("/employer/messages")
      } else if (user.role === "admin") {
        router.push("/admin")
      }
    } else {
      router.push("/login")
    }
  }, [user, router])

  return null
}
