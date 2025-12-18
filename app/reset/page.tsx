"use client"

import ResetClient from "./reset-client"
import { Suspense } from "react"

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground">Loading…</div>}>
      <ResetClient />
    </Suspense>
  )
}
