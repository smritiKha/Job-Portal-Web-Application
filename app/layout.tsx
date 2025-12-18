import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/lib/auth-context"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Job Portal - Find Your Dream Career",
  description: "AI-powered job portal connecting employers with talented professionals",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased min-h-screen bg-background text-foreground [--bg-gradient:linear-gradient(120deg,hsl(216 40% 96%),hsl(220 40% 98%))] dark:[--bg-gradient:linear-gradient(120deg,hsl(222 47% 11%),hsl(221 39% 12%))] bg-[image:var(--bg-gradient)]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
