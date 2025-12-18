"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Home,
  Search,
  Briefcase,
  FileText,
  Bookmark,
  Sparkles,
  TrendingUp,
  Target,
  BookOpen,
  Award,
  ArrowRight,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home, current: false },
  { name: "Find Jobs", href: "/dashboard/jobs", icon: Search, current: false },
  { name: "Applications", href: "/dashboard/applications", icon: Briefcase, current: false },
  { name: "Training", href: "/dashboard/training", icon: BookOpen, current: false },
  { name: "Profile", href: "/dashboard/profile", icon: FileText, current: false },
  { name: "Saved Jobs", href: "/dashboard/saved", icon: Bookmark, current: false },
]

const skillGaps = [
  {
    skill: "TypeScript",
    currentLevel: 60,
    targetLevel: 90,
    importance: "High",
    demand: "Very High",
    avgSalaryIncrease: "+15%",
  },
  {
    skill: "System Design",
    currentLevel: 40,
    targetLevel: 80,
    importance: "High",
    demand: "High",
    avgSalaryIncrease: "+20%",
  },
  {
    skill: "GraphQL",
    currentLevel: 30,
    targetLevel: 70,
    importance: "Medium",
    demand: "High",
    avgSalaryIncrease: "+12%",
  },
  {
    skill: "AWS",
    currentLevel: 50,
    targetLevel: 85,
    importance: "High",
    demand: "Very High",
    avgSalaryIncrease: "+18%",
  },
]

const trainingRecommendations = [
  {
    id: 1,
    title: "Advanced TypeScript Patterns",
    provider: "Frontend Masters",
    duration: "6 hours",
    level: "Advanced",
    rating: 4.8,
    relevance: 95,
  },
  {
    id: 2,
    title: "System Design Interview Prep",
    provider: "Educative",
    duration: "12 hours",
    level: "Intermediate",
    rating: 4.9,
    relevance: 92,
  },
  {
    id: 3,
    title: "GraphQL Complete Guide",
    provider: "Udemy",
    duration: "8 hours",
    level: "Beginner",
    rating: 4.7,
    relevance: 88,
  },
  {
    id: 4,
    title: "AWS Certified Solutions Architect",
    provider: "A Cloud Guru",
    duration: "20 hours",
    level: "Intermediate",
    rating: 4.9,
    relevance: 90,
  },
]

const careerInsights = [
  {
    title: "Market Demand",
    value: "Very High",
    description: "React developers are in high demand with 2,500+ open positions",
    trend: "up",
  },
  {
    title: "Salary Potential",
    value: "$145k",
    description: "Average salary for your skill level in your target locations",
    trend: "up",
  },
  {
    title: "Competition Level",
    value: "Medium",
    description: "Moderate competition for senior positions in your field",
    trend: "neutral",
  },
  {
    title: "Career Growth",
    value: "Excellent",
    description: "Strong growth opportunities in your target companies",
    trend: "up",
  },
]

export default function AIInsightsPage() {
  const pathname = usePathname()
  const router = useRouter()

  // This page has been removed. Redirect job seekers back to dashboard.
  useEffect(() => {
    router.replace('/dashboard')
  }, [router])

  return null

  const updatedNav = navigation.map((item) => ({
    ...item,
    current: item.href === pathname,
  }))

  return (
    <ProtectedRoute allowedRoles={["job_seeker"]}>
      <DashboardLayout navigation={updatedNav}>
        <div className="space-y-8">
          {/* Page Header */}
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">AI Career Insights</h1>
              <p className="text-muted-foreground mt-1">
                Personalized recommendations to accelerate your career growth
              </p>
            </div>
          </div>

          {/* Career Insights Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {careerInsights.map((insight) => (
              <Card key={insight.title}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{insight.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground mb-2">{insight.value}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Skill Gap Analysis */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle>Skill Gap Analysis</CardTitle>
              </div>
              <CardDescription>AI-identified skills to focus on for your target roles and salary goals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {skillGaps.map((gap) => (
                  <div key={gap.skill} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-foreground">{gap.skill}</h3>
                        <Badge
                          variant={gap.importance === "High" ? "default" : "secondary"}
                          className={
                            gap.importance === "High"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : ""
                          }
                        >
                          {gap.importance} Priority
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-foreground">
                          {gap.currentLevel}% → {gap.targetLevel}%
                        </div>
                        <div className="text-xs text-muted-foreground">{gap.avgSalaryIncrease} salary impact</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Current Level</span>
                        <span>Target Level</span>
                      </div>
                      <Progress value={gap.currentLevel} className="h-2" />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Market Demand: {gap.demand}</span>
                      <Link href="#training">
                        <Button size="sm" variant="outline">
                          View Courses
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Training Recommendations */}
          <Card id="training">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <CardTitle>Recommended Training</CardTitle>
              </div>
              <CardDescription>Curated courses to close your skill gaps and boost your career</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {trainingRecommendations.map((course) => (
                  <div key={course.id} className="p-4 rounded-lg border border-border">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1">{course.title}</h3>
                        <p className="text-sm text-muted-foreground">{course.provider}</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      >
                        {course.relevance}% Match
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span>{course.duration}</span>
                      <span>•</span>
                      <span>{course.level}</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Award className="h-4 w-4" />
                        <span>{course.rating}</span>
                      </div>
                    </div>

                    <Button size="sm" className="w-full">
                      View Course
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Career Path Suggestions */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle>Career Path Suggestions</CardTitle>
              </div>
              <CardDescription>AI-recommended career trajectories based on your profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-border bg-primary/5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Senior Frontend Architect</h3>
                      <p className="text-sm text-muted-foreground">Natural progression from your current role</p>
                    </div>
                    <Badge variant="default">Recommended</Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-muted-foreground">Timeline: 1-2 years</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-muted-foreground">Salary Range: $160k - $200k</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-muted-foreground">Key Skills: System Design, Leadership, Architecture</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="mt-4 bg-transparent">
                    Explore Path
                  </Button>
                </div>

                <div className="p-4 rounded-lg border border-border">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Engineering Manager</h3>
                      <p className="text-sm text-muted-foreground">Transition to leadership and team management</p>
                    </div>
                    <Badge variant="outline">Alternative</Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                      <span className="text-muted-foreground">Timeline: 2-3 years</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                      <span className="text-muted-foreground">Salary Range: $170k - $220k</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                      <span className="text-muted-foreground">Key Skills: Leadership, Communication, Strategy</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="mt-4 bg-transparent">
                    Explore Path
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
