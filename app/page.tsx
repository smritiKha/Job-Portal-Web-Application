"use client"

import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Briefcase, Users, Sparkles, TrendingUp } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FunActivity } from "@/components/fun-activity"

export default function HomePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [featuredJobs, setFeaturedJobs] = useState<any[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [ads, setAds] = useState<any[]>([])
  const [adsLoading, setAdsLoading] = useState(true)

  function CountUp({ end, duration = 1200 }: { end: number; duration?: number }) {
    const [val, setVal] = useState(0)
    useEffect(() => {
      let raf = 0
      const start = performance.now()
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / duration)
        setVal(Math.floor(end * p))
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
      return () => cancelAnimationFrame(raf)
    }, [end, duration])
    return <span>{val.toLocaleString()}</span>
  }

  useEffect(() => {
    // Auto-redirect removed so signed-in users can view the home page.
  }, [user, router])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setJobsLoading(true)
        setJobsError(null)
        const res = await fetch('/api/jobs')
        const txt = await res.text().catch(() => '')
        const data = txt ? JSON.parse(txt) : { ok: true, jobs: [] }
        if (!res.ok || data?.ok === false) {
          if (mounted) setJobsError(data?.error || 'Failed to load jobs')
          if (mounted) setFeaturedJobs([])
          return
        }
        const items = Array.isArray(data.jobs) ? data.jobs : []
        const filtered = items.filter((j: any) => (j?.status === 'active' || j?.status === 'open')).slice(0, 6)
        if (mounted) setFeaturedJobs(filtered)
      } catch (e: any) {
        if (mounted) {
          setJobsError(e?.message || 'Failed to load jobs')
          setFeaturedJobs([])
        }
      } finally {
        if (mounted) setJobsLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  // Fetch homepage ads
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setAdsLoading(true)
        const res = await fetch('/api/ads')
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data?.ok === false) {
          if (mounted) setAds([])
          return
        }
        const items = Array.isArray(data.ads) ? data.ads : []
        if (mounted) setAds(items)
      } catch {
        if (mounted) setAds([])
      } finally {
        if (mounted) setAdsLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
              <Briefcase className="h-5 w-5" />
            </span>
            <span className="text-2xl font-bold text-foreground tracking-tight">JobPortal</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="hover:bg-muted/70">Login</Button>
            </Link>
            <Link href="/signup">
              <Button className="shadow-sm hover:shadow-md transition-shadow">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 lg:py-28">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-5xl lg:text-7xl font-bold text-foreground mb-6 text-balance tracking-tight">
            Find your next great opportunity
          </h1>
          <p className="text-xl text-muted-foreground mb-8 text-pretty leading-relaxed">
            Connect with leading employers, explore roles that fit your strengths, and move your career forward with confidence.
          </p>
          <div className="grid gap-3 sm:grid-cols-12 max-w-3xl mx-auto">
            <div className="sm:col-span-8">
              <Input
                placeholder="Search job titles, skills, or companies"
                className="h-12"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const target = query ? `/dashboard/jobs?query=${encodeURIComponent(query)}` : '/dashboard/jobs'
                    router.push(target)
                  }
                }}
              />
            </div>
            <div className="sm:col-span-4 flex gap-3">
              <Button
                size="lg"
                className="flex-1 w-full shadow-sm hover:shadow-md transition-shadow h-12"
                onClick={() => {
                  const target = query ? `/dashboard/jobs?query=${encodeURIComponent(query)}` : '/dashboard/jobs'
                  router.push(target)
                }}
              >
                Browse Jobs
              </Button>
              <Link href="/signup?role=employer">
                <Button size="lg" variant="outline" className="h-12 bg-background hover:bg-muted/70">
                  Post a Job
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Ads Section */}
      {ads.length > 0 && (
        <section className="container mx-auto px-4 pb-6 -mt-8">
          <div className="max-w-5xl mx-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              {ads.slice(0, 2).map((ad: any) => (
                <Card key={String(ad._id)} className="overflow-hidden border-primary/20">
                  <CardContent className="p-0">
                    {ad.imageUrl ? (
                      <a href={ad.linkUrl || '#'} target={ad.linkUrl ? '_blank' : undefined} rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ad.imageUrl} alt={ad.title} className="w-full h-44 object-cover" />
                      </a>
                    ) : null}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-foreground truncate pr-2">{ad.title}</h4>
                        {ad.featured ? <Badge>Ad</Badge> : <Badge variant="outline">Ad</Badge>}
                      </div>
                      {ad.description ? (
                        <p className="text-sm text-muted-foreground line-clamp-3">{ad.description}</p>
                      ) : null}
                      {ad.linkUrl ? (
                        <div className="pt-2">
                          <Link href={ad.linkUrl} target="_blank">
                            <Button size="sm" variant="outline">Learn more</Button>
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Fun Activity */}
      <section className="container mx-auto px-4 pb-8 -mt-8">
        <div className="max-w-5xl mx-auto">
          <FunActivity />
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-4 py-16 border-t border-border">
        <div className="mb-6 text-center">
          <h3 className="text-2xl font-semibold text-foreground">What professionals say</h3>
          <p className="text-sm text-muted-foreground">Real stories from people who advanced their careers</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[{
            quote: 'I landed a great frontend role in just two weeks. The experience was seamless.',
            name: 'Aarav S.', title: 'Frontend Engineer'
          },{
            quote: 'The platform helped our team hire faster with high-quality candidates.',
            name: 'Priya K.', title: 'Engineering Manager'
          },{
            quote: 'Clean interface, relevant roles, and simple applications. Highly recommend.',
            name: 'Rahul M.', title: 'Product Designer'
          }].map((t, i) => (
            <Card key={i} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5 space-y-3">
                <p className="text-sm text-foreground">“{t.quote}”</p>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{t.name}</span> • {t.title}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Trusted by companies - removed */}

      {/* Featured Categories */}
      <section className="container mx-auto px-4 py-16 border-t border-border">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-2xl font-semibold text-foreground">Popular Categories</h3>
          <Link href="/dashboard/jobs" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Engineering','Design','Marketing','Product','Sales','Data','DevOps','Customer Success'].map((cat) => (
            <Link key={cat} href={`/dashboard/jobs?category=${encodeURIComponent(cat)}`}>
              <Badge variant="secondary" className="px-3 py-1 text-sm hover:bg-muted cursor-pointer">
                {cat}
              </Badge>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Jobs */
      }
      <section className="container mx-auto px-4 py-16 border-t border-border">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-2xl font-semibold text-foreground">Featured Jobs</h3>
          <Link href="/dashboard/jobs" className="text-sm text-primary hover:underline">Browse jobs</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border-dashed">
                <CardContent className="p-4 space-y-3">
                  <div className="h-5 w-40 bg-muted rounded" />
                  <div className="h-4 w-28 bg-muted rounded" />
                  <div className="h-4 w-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))
          ) : jobsError ? (
            <Card className="md:col-span-2 lg:col-span-3">
              <CardContent className="p-6 text-sm text-destructive text-center">{jobsError}</CardContent>
            </Card>
          ) : featuredJobs.length === 0 ? (
            <Card className="md:col-span-2 lg:col-span-3">
              <CardContent className="p-6 text-sm text-muted-foreground text-center">No featured jobs yet. Check back soon.</CardContent>
            </Card>
          ) : (
            featuredJobs.map((j) => (
              <Card key={String(j._id)} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground truncate pr-2">{j.title}</h4>
                    <Badge variant="outline">{j.type || 'Full-time'}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{j.companyName || j.company || 'Company'}</div>
                  <div className="text-xs text-muted-foreground">{j.location || 'Remote'}</div>
                  <div className="pt-2">
                    <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/jobs/${String(j._id)}`)}>View</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20 border-t border-border">
        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <Card>
            <CardContent className="py-6 text-center">
              <div className="text-3xl font-bold text-foreground"><CountUp end={10000} />+</div>
              <div className="text-xs text-muted-foreground">Active Jobs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6 text-center">
              <div className="text-3xl font-bold text-foreground"><CountUp end={5000} />+</div>
              <div className="text-xs text-muted-foreground">Companies</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6 text-center">
              <div className="text-3xl font-bold text-foreground"><CountUp end={120000} />+</div>
              <div className="text-xs text-muted-foreground">Candidates</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6 text-center">
              <div className="text-3xl font-bold text-foreground">98%</div>
              <div className="text-xs text-muted-foreground">Satisfaction</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Personalized Matches</CardTitle>
              <CardDescription>
                Recommendations tailored to your profile, experience, and interests so you can apply with purpose.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-2">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <CardTitle className="text-xl">Top Employers</CardTitle>
              <CardDescription>
                Connect with leading companies actively seeking talented professionals like you.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center mb-2">
                <TrendingUp className="h-6 w-6 text-secondary" />
              </div>
              <CardTitle className="text-xl">Career Growth</CardTitle>
              <CardDescription>
                Tools and insights to help you upskill, track progress, and reach your next milestone.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center rounded-2xl p-12 bg-gradient-to-tr from-primary to-accent text-primary-foreground shadow-md">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-balance tracking-tight">
            Ready to Transform Your Career?
          </h2>
          <p className="text-lg/7 opacity-90 mb-8 text-pretty">
            Join thousands of professionals who have found their dream jobs through our platform.
          </p>
          <Link href="/signup">
            <Button size="lg" variant="secondary" className="shadow-sm hover:shadow-md transition-shadow">
              Create Free Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" />
              <span className="font-semibold text-foreground">JobPortal</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2025 JobPortal. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
