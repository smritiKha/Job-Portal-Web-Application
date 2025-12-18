import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { ObjectId } from 'mongodb'
import { analyzeSkillGaps, getTrainingRecommendations } from '@/lib/ai-matching'

export const runtime = 'nodejs'

type Body = {
  dreamJob?: string
  userId?: string // admin override to analyze another user
  skillsOverride?: string[] // optional override of skills to analyze
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = (await req.json()) as Partial<Body>
    let dreamJob = (body?.dreamJob || '').trim()

    // Determine which user to analyze
    const targetUserId = body?.userId && auth.role === 'admin' ? body.userId : auth.id

    // Load user profile to extract current skills and context
    const users = await getCollection<any>('users')
    const user = await users.findOne({ _id: new ObjectId(targetUserId!) })
    if (!user) return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })

    // If dreamJob wasn't provided, infer from user profile
    if (!dreamJob) {
      const candidates = [user.dreamJob, user.desiredRole, user.targetRole, user.careerGoal].map((x: any) => (typeof x === 'string' ? x.trim() : ''))
      dreamJob = candidates.find((x) => !!x) || ''
      if (!dreamJob) return NextResponse.json({ ok: false, error: 'dreamJob is required (set it in your profile)' }, { status: 400 })
    }

    const userProfile = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      location: user.location || 'Remote',
      experience: Number(user.experience || 0),
      expectedSalary: Number(user.expectedSalary || 0),
      skills: Array.isArray(body?.skillsOverride) ? body!.skillsOverride! : (Array.isArray(user.skills) ? user.skills : []),
    }

    // Build a minimal target job descriptor (mock requirements for demo)
    const targetJob = {
      id: 'target-dream',
      title: dreamJob,
      requiredSkills: deriveRequiredSkillsFromDreamJob(dreamJob),
      requiredExperience: 2,
      location: 'Remote',
      salary: { min: 80000, max: 200000 },
    }

    // Analyze skill gaps and compute recommendations
    const skillGaps = analyzeSkillGaps(userProfile, [targetJob])
    const recommendations = getTrainingRecommendations(skillGaps)

    // Build a simple roadmap and readiness score
    const readiness = computeReadiness(skillGaps)
    const roadmap = buildRoadmap(skillGaps)

    return NextResponse.json({
      ok: true,
      dreamJob,
      user: { id: userProfile.id, name: userProfile.name, skills: userProfile.skills },
      readiness,
      skillGaps,
      recommendations,
      roadmap,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

// Optionally support GET for simple testing with query params
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    let dreamJob = (searchParams.get('dreamJob') || '').trim()

    const users = await getCollection<any>('users')
    const user = await users.findOne({ _id: new ObjectId(auth.id) })
    if (!user) return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })

    // If not provided via query, infer from user profile fields
    if (!dreamJob) {
      const candidates = [user.dreamJob, user.desiredRole, user.targetRole, user.careerGoal].map((x: any) => (typeof x === 'string' ? x.trim() : ''))
      dreamJob = candidates.find((x) => !!x) || ''
      if (!dreamJob) return NextResponse.json({ ok: false, error: 'dreamJob is required (set it in your profile)' }, { status: 400 })
    }

    const userProfile = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      location: user.location || 'Remote',
      experience: Number(user.experience || 0),
      expectedSalary: Number(user.expectedSalary || 0),
      skills: Array.isArray(user.skills) ? user.skills : [],
    }

    const targetJob = {
      id: 'target-dream',
      title: dreamJob,
      requiredSkills: deriveRequiredSkillsFromDreamJob(dreamJob),
      requiredExperience: 2,
      location: 'Remote',
      salary: { min: 80000, max: 200000 },
    }

    const skillGaps = analyzeSkillGaps(userProfile, [targetJob])
    const recommendations = getTrainingRecommendations(skillGaps)
    const readiness = computeReadiness(skillGaps)
    const roadmap = buildRoadmap(skillGaps)

    return NextResponse.json({ ok: true, dreamJob, user: { id: userProfile.id, name: userProfile.name, skills: userProfile.skills }, readiness, skillGaps, recommendations, roadmap })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

function deriveRequiredSkillsFromDreamJob(dreamJob: string): string[] {
  const j = dreamJob.toLowerCase()
  if (j.includes('frontend') || j.includes('react')) return ['JavaScript', 'TypeScript', 'React', 'Testing', 'System Design']
  if (j.includes('backend') || j.includes('node')) return ['Node.js', 'TypeScript', 'Databases', 'API Design', 'Docker']
  if (j.includes('fullstack')) return ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Databases']
  if (j.includes('software engineer')) return ['JavaScript', 'Data Structures', 'Algorithms', 'System Design', 'Databases']
  if (j.includes('devops')) return ['Linux', 'CI/CD', 'Docker', 'Kubernetes', 'AWS']
  if (j.includes('data')) return ['Python', 'SQL', 'Statistics', 'ML Basics']
  if (j.includes('doctor') || j.includes('physician')) return ['Clinical Skills', 'Medical Ethics', 'Anatomy', 'Physiology', 'USMLE']
  if (j.includes('nurse')) return ['Clinical Skills', 'Patient Care', 'Pharmacology', 'Anatomy', 'Communication']
  if (j.includes('electrician')) return ['Electrical Safety', 'Wiring', 'Circuits', 'Codes & Standards', 'Troubleshooting']
  if (j.includes('spanish')) return ['Spanish Language']
  if (j.includes('english')) return ['English Language']
  if (j.includes('nepali') || j.includes('nepalese')) return ['Nepali Language']
  if (j.includes('digital marketing')) return ['SEO', 'SEM', 'Content Marketing', 'Social Media Marketing', 'Analytics']
  if (j.includes('data analyst')) return ['SQL', 'Excel', 'Statistics', 'Tableau', 'Python']
  if (j.includes('data scientist')) return ['Python', 'Statistics', 'ML Basics', 'Data Wrangling', 'Modeling']
  if (j.includes('cpa')) return ['Financial Accounting', 'Auditing', 'Taxation', 'GAAP/IFRS', 'Excel']
  if (j.includes('accountant')) return ['Financial Accounting', 'Bookkeeping', 'Excel', 'Taxation', 'QuickBooks']
  if (j.includes('tutor') || j.includes('teacher') || j.includes('instructor')) return ['Subject Matter Expertise', 'Lesson Planning', 'Instructional Design', 'Assessment', 'Communication']
  if (j.includes('project manager')) return ['Project Management', 'Agile', 'Scrum', 'Risk Management', 'Stakeholder Management']
  if (j.includes('qa') || j.includes('quality assurance')) return ['Test Automation', 'Selenium', 'CI/CD', 'Python', 'Java']
  if (j.includes('mechanical engineer')) return ['CAD', 'Thermodynamics', 'Materials', 'Mechanics', 'Manufacturing']
  if (j.includes('civil engineer')) return ['Structural Analysis', 'AutoCAD', 'Project Management', 'Materials', 'Surveying']
  if (j.includes('computer engineer')) return ['Computer Architecture', 'C/C++', 'Embedded Systems', 'Operating Systems', 'Networking']
  if (j.includes('business analyst')) return ['Requirements Gathering', 'SQL', 'Excel', 'Data Visualization', 'Stakeholder Management']
  if (j.includes('sales') || j.includes('business development')) return ['Communication', 'CRM', 'Negotiation', 'Lead Generation', 'Sales Analytics']
  return ['Problem Solving', 'Communication']
}

function computeReadiness(skillGaps: Array<{ currentLevel: number; targetLevel: number }>) {
  if (!skillGaps.length) return { score: 90, level: 'High', summary: 'You are close to your dream job.' }
  
  // Calculate the total possible points if all skills were at target level
  const totalPossible = skillGaps.reduce((sum, gap) => sum + gap.targetLevel, 0)
  
  // Calculate the actual points based on current level (capped at target level)
  const currentPoints = skillGaps.reduce((sum, gap) => sum + Math.min(gap.currentLevel, gap.targetLevel), 0)
  
  // Calculate the percentage of target achieved (avoid division by zero)
  const score = totalPossible > 0 ? Math.round((currentPoints / totalPossible) * 100) : 0
  
  // Determine readiness level
  let level, summary
  if (score >= 80) {
    level = 'High'
    summary = 'You are well-prepared for your dream job!'
  } else if (score >= 50) {
    level = 'Medium'
    summary = 'You have a good foundation. Focus on key areas to improve.'
  } else {
    level = 'Low'
    summary = 'Start with foundational modules to build momentum.'
  }
  
  return { 
    score, 
    level, 
    summary,
    details: {
      currentPoints,
      totalPossible,
      skillsAssessed: skillGaps.length
    }
  }
}

function buildRoadmap(skillGaps: Array<{ skill: string; currentLevel: number; targetLevel: number }>) {
  // Simple roadmap: sort by largest gap first and split into phases
  const ordered = [...skillGaps].sort((a, b) => (b.targetLevel - b.currentLevel) - (a.targetLevel - a.currentLevel))
  const phases = [
    { name: 'Phase 1: Foundations', items: ordered.slice(0, 2).map(g => `Strengthen ${g.skill}`) },
    { name: 'Phase 2: Intermediate', items: ordered.slice(2, 4).map(g => `Projects with ${g.skill}`) },
    { name: 'Phase 3: Advanced', items: ordered.slice(4).map(g => `Advanced patterns in ${g.skill}`) },
  ]
  return phases
}
