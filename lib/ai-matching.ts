// AI Job Matching Engine with Enhanced Skill Matching

export interface JobMatch {
  jobId: string
  matchScore: number
  reasons: string[]
  skillsMatch: number
  experienceMatch: number
  locationMatch: number
  salaryMatch: number
  matchedSkills: string[]
  missingSkills: string[]
  partialMatches: { skill: string; match: string; score: number }[]
}

export interface SkillGap {
  skill: string
  currentLevel: number
  targetLevel: number
  importance: "High" | "Medium" | "Low"
  demand: "Very High" | "High" | "Medium" | "Low"
  avgSalaryIncrease: string
}

export interface TrainingRecommendation {
  id: string
  title: string
  provider: string
  duration: string
  level: "Beginner" | "Intermediate" | "Advanced"
  rating: number
  relevance: number
  url?: string
  targetSkills: string[]
}

// -------------------------------
// Enhanced Skill Matching
// -------------------------------

// Extended skill aliases and normalization
const skillAliases: Record<string, string> = {
  // Programming languages
  'js': 'javascript', 'typescript': 'typescript', 'ts': 'typescript',
  'node': 'node.js', 'nodejs': 'node.js', 'node-js': 'node.js',
  'react': 'react', 'reactjs': 'react', 'react.js': 'react',
  'vue': 'vue.js', 'vuejs': 'vue.js', 'vue.js': 'vue.js',
  'angular': 'angular', 'angularjs': 'angular',
  'python': 'python', 'py': 'python',
  'java': 'java', 'java8': 'java', 'java11': 'java',
  'c#': 'csharp', 'csharp': 'csharp',
  'c++': 'cpp', 'cpp': 'cpp',
  'go': 'go', 'golang': 'go',
  'ruby': 'ruby', 'rb': 'ruby',
  'php': 'php',
  'swift': 'swift',
  'kotlin': 'kotlin', 'kt': 'kotlin',
  'scala': 'scala',
  'rust': 'rust',
  'dart': 'dart',
  
  // Frontend
  'html': 'html', 'html5': 'html',
  'css': 'css', 'css3': 'css',
  'sass': 'sass', 'scss': 'sass',
  'less': 'less',
  'tailwind': 'tailwind css', 'tailwindcss': 'tailwind css',
  'bootstrap': 'bootstrap', 'bootstrap4': 'bootstrap', 'bootstrap5': 'bootstrap',
  'material-ui': 'material ui', 'mui': 'material ui',
  'nextjs': 'next.js', 'next-js': 'next.js', 'next': 'next.js',
  'gatsby': 'gatsby', 'gatsbyjs': 'gatsby',
  'nuxt': 'nuxt.js', 'nuxtjs': 'nuxt.js', 'nuxt-js': 'nuxt.js',
  
  // Backend
  'express': 'express.js', 'expressjs': 'express.js', 'express-js': 'express.js',
  'nest': 'nestjs', 'nest-js': 'nestjs', 'nestjs': 'nestjs',
  'django': 'django', 'djangorest': 'django rest framework', 'drf': 'django rest framework',
  'flask': 'flask', 'flask-restful': 'flask',
  'spring': 'spring boot', 'springboot': 'spring boot', 'spring-boot': 'spring boot',
  'laravel': 'laravel', 'lumen': 'laravel',
  'rails': 'ruby on rails', 'rubyonrails': 'ruby on rails', 'ror': 'ruby on rails',
  'aspnet': 'asp.net', 'asp.net core': 'asp.net', 'aspnetcore': 'asp.net',
  'fastapi': 'fastapi', 'fast-api': 'fastapi',
  
  // Databases
  'mongodb': 'mongodb', 'mongo': 'mongodb', 'mongoose': 'mongodb',
  'postgresql': 'postgres', 'postgres': 'postgres', 'postgres-db': 'postgres',
  'mysql': 'mysql', 'mariadb': 'mysql',
  'sql': 'sql', 'sqlite': 'sqlite', 'sqlite3': 'sqlite',
  'redis': 'redis', 'rediscache': 'redis',
  'dynamodb': 'dynamodb', 'dynamo': 'dynamodb',
  'firestore': 'firestore', 'firebase firestore': 'firestore',
  'cosmosdb': 'cosmos db', 'cosmos-db': 'cosmos db', 'azure cosmos': 'cosmos db',
  
  // DevOps & Cloud
  'aws': 'amazon web services', 'amazon web services': 'amazon web services',
  'azure': 'microsoft azure', 'microsoft azure': 'microsoft azure',
  'gcp': 'google cloud', 'google cloud': 'google cloud', 'gcloud': 'google cloud',
  'docker': 'docker', 'docker-compose': 'docker', 'dockerfile': 'docker',
  'kubernetes': 'kubernetes', 'k8s': 'kubernetes', 'kube': 'kubernetes',
  'terraform': 'terraform', 'terrform': 'terraform', 'tform': 'terraform',
  'ansible': 'ansible', 'ansible-playbook': 'ansible',
  'jenkins': 'jenkins', 'jenkins ci/cd': 'jenkins',
  'github actions': 'github actions', 'gh actions': 'github actions', 'github-actions': 'github actions',
  'gitlab ci/cd': 'gitlab ci/cd', 'gitlab-ci': 'gitlab ci/cd',
  'ci/cd': 'ci/cd', 'ci': 'ci/cd', 'continuous integration': 'ci/cd', 'continuous deployment': 'ci/cd',
  
  // Testing
  'jest': 'jest', 'jestjs': 'jest',
  'mocha': 'mocha', 'mochajs': 'mocha',
  'jasmine': 'jasmine', 'jasminejs': 'jasmine',
  'cypress': 'cypress', 'cypress.io': 'cypress',
  'pytest': 'pytest', 'py-test': 'pytest',
  'junit': 'junit', 'j-unit': 'junit',
  'testing': 'testing', 'unit testing': 'unit testing', 'integration testing': 'integration testing',
  'tdd': 'test driven development', 'test driven development': 'test driven development',
  'bdd': 'behavior driven development', 'behavior driven development': 'behavior driven development',
  
  // Other common skills
  'rest': 'rest api', 'restful': 'rest api', 'rest api': 'rest api',
  'graphql': 'graphql', 'gql': 'graphql',
  'grpc': 'grpc', 'rpc': 'grpc', 'google rpc': 'grpc',
  'microservices': 'microservices', 'micro-service': 'microservices', 'micro service': 'microservices',
  'serverless': 'serverless', 'server less': 'serverless', 'server-less': 'serverless',
  'es6': 'es6+', 'es2015': 'es6+', 'es2016': 'es6+', 'es2017': 'es6+', 'es2018': 'es6+', 'es2019': 'es6+',
  'webpack': 'webpack', 'webpack5': 'webpack', 'webpack-5': 'webpack',
  'babel': 'babel', 'babeljs': 'babel',
  'npm': 'npm', 'yarn': 'yarn', 'pnpm': 'pnpm', 'package manager': 'package manager',
  'git': 'git', 'github': 'github', 'gitlab': 'gitlab', 'bitbucket': 'bitbucket',
  'agile': 'agile', 'scrum': 'scrum', 'kanban': 'kanban', 'sprint': 'sprint',
  'jira': 'jira', 'atlassian jira': 'jira',
  'confluence': 'confluence', 'atlassian confluence': 'confluence',
  'slack': 'slack', 'microsoft teams': 'microsoft teams', 'teams': 'microsoft teams',
  'zoom': 'zoom', 'video conferencing': 'video conferencing',
  'figma': 'figma', 'sketch': 'sketch', 'adobe xd': 'adobe xd', 'ui/ux': 'ui/ux', 'ui': 'ui/ux', 'ux': 'ui/ux',
  'responsive design': 'responsive design', 'mobile-first': 'mobile first', 'mobile first': 'mobile first'
}

// Skill categories for better matching
const skillCategories: Record<string, string[]> = {
  'frontend': ['html', 'css', 'javascript', 'typescript', 'react', 'vue', 'angular', 'sass', 'less', 'tailwind css', 'bootstrap', 'material ui', 'next.js', 'gatsby', 'nuxt.js', 'webpack', 'babel', 'jest', 'cypress'],
  'backend': ['node.js', 'express', 'nest.js', 'django', 'flask', 'fastapi', 'spring', 'laravel', 'ruby on rails', 'asp.net', 'graphql', 'rest', 'microservices', 'serverless', 'aws lambda', 'firebase', 'mongodb', 'postgresql', 'mysql', 'redis', 'docker', 'kubernetes'],
  'devops': ['docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'ansible', 'jenkins', 'github actions', 'gitlab ci', 'circleci', 'argo cd', 'helm', 'istio', 'prometheus', 'grafana', 'datadog', 'new relic', 'sre', 'site reliability'],
  'data': ['python', 'r', 'sql', 'pandas', 'numpy', 'pytorch', 'tensorflow', 'scikit-learn', 'apache spark', 'hadoop', 'kafka', 'airflow', 'tableau', 'power bi', 'looker', 'bigquery', 'redshift', 'snowflake', 'data engineering', 'data science', 'machine learning', 'ai'],
  'mobile': ['react native', 'flutter', 'swift', 'swiftui', 'kotlin', 'android', 'ios', 'xamarin', 'ionic', 'mobile development', 'mobile app'],
  'cloud': ['aws', 'azure', 'gcp', 'cloud computing', 'serverless', 'lambda', 'ec2', 's3', 'rds', 'dynamodb', 'cloudfront', 'cloudformation', 'cloud run', 'cloud functions', 'google cloud', 'amazon web services', 'microsoft azure'],
  'security': ['cybersecurity', 'owasp', 'penetration testing', 'ethical hacking', 'security engineering', 'devsecops', 'vulnerability assessment', 'security compliance', 'gdpr', 'hipaa', 'pci dss', 'security+', 'ceh', 'cissp'],
  'testing': ['jest', 'mocha', 'jasmine', 'cypress', 'selenium', 'playwright', 'puppeteer', 'testing library', 'unit testing', 'integration testing', 'e2e testing', 'test automation', 'tdd', 'bdd', 'ci/cd'],
  'soft skills': ['communication', 'teamwork', 'leadership', 'problem solving', 'critical thinking', 'time management', 'adaptability', 'conflict resolution', 'emotional intelligence', 'creativity', 'collaboration', 'presentation', 'public speaking', 'negotiation', 'mentoring'],
  'design': ['figma', 'sketch', 'adobe xd', 'ui/ux', 'user experience', 'user interface', 'design systems', 'interaction design', 'visual design', 'prototyping', 'wireframing', 'responsive design', 'mobile first', 'design thinking']
}

// Categorize a skill based on the skill categories
function categorizeSkill(skill: string): string[] {
  if (!skill || typeof skill !== 'string') return [];
  
  const normalizedSkill = skill.toLowerCase().trim();
  const categories: string[] = [];
  
  // Check each category for a match
  for (const [category, skills] of Object.entries(skillCategories)) {
    if (skills.some(s => normalizedSkill.includes(s.toLowerCase()))) {
      categories.push(category);
    }
  }
  
  // Default to 'other' if no categories matched
  return categories.length > 0 ? categories : ['other'];
}

// Canonicalize skill name to a standard form
export function canonicalizeSkill(skill: string): string {
  if (!skill) return ''
  
  // Convert to lowercase and trim
  let normalized = skill.toLowerCase().trim()
  
  // Remove version numbers and special characters
  normalized = normalized.replace(/[^a-z0-9\s\-\/]/g, ' ')
  
  // Replace common abbreviations and aliases
  if (skillAliases[normalized]) {
    return skillAliases[normalized]
  }
  
  // Check for partial matches in aliases
  for (const [key, value] of Object.entries(skillAliases)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value
    }
  }
  
  return normalized
}

// Normalize and clean skill names
function normalizeSkill(skill: string): string {
  if (!skill) return ''
  
  // Convert to lowercase and trim
  let normalized = skill.trim().toLowerCase()
  
  // Remove version numbers (e.g., 'python 3.8' -> 'python')
  normalized = normalized.replace(/\s*[\d.]+\s*$/, '').trim()
  
  // Remove common prefixes/suffixes
  normalized = normalized
    .replace(/^skill\s*[\-:]\s*/i, '')
    .replace(/\s*\(.+\)$/, '')
    .replace(/\s*\[.+\]\s*$/, '')
    .replace(/\s*\{.+\}\s*$/, '')
    .trim()
  
  // Apply aliases
  normalized = skillAliases[normalized] || normalized
  
  return normalized
}

// Calculate similarity between two strings (0-1)
function stringSimilarity(s1: string, s2: string): number {
  const str1 = normalizeSkill(s1)
  const str2 = normalizeSkill(s2)
  
  if (str1 === str2) return 1.0
  if (str1.length < 2 || str2.length < 2) return 0.0
  
  // Check if one is a substring of another
  if (str1.includes(str2) || str2.includes(str1)) return 0.9
  
  // Check for common prefixes/suffixes
  const commonPrefix = (a: string, b: string) => {
    const maxLength = Math.min(a.length, b.length)
    let i = 0
    while (i < maxLength && a[i] === b[i]) i++
    return i
  }
  
  const prefixLength = commonPrefix(str1, str2)
  if (prefixLength >= Math.max(str1.length, str2.length) * 0.7) return 0.8
  
  // Check for common words
  const words1 = new Set(str1.split(/[\s\-\/]+/))
  const words2 = new Set(str2.split(/[\s\-\/]+/))
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])
  
  if (intersection.size > 0) {
    return intersection.size / union.size
  }
  
  return 0.0
}

// Find best match for a skill in a list of target skills
function findBestSkillMatch(skill: string, targetSkills: string[]): { match: string | null; score: number } {
  const normalizedSkill = normalizeSkill(skill)
  let bestMatch = { match: null as string | null, score: 0 }
  
  for (const target of targetSkills) {
    const normalizedTarget = normalizeSkill(target)
    
    // Exact match
    if (normalizedSkill === normalizedTarget) {
      return { match: target, score: 1.0 }
    }
    
    // Check if one is a substring of another
    if (normalizedSkill.includes(normalizedTarget) || normalizedTarget.includes(normalizedSkill)) {
      const score = Math.max(normalizedSkill.length, normalizedTarget.length) / 
                   (normalizedSkill.length + normalizedTarget.length) * 1.8
      if (score > bestMatch.score) {
        bestMatch = { match: target, score: Math.min(0.95, score) }
      }
      continue
    }
    
    // Check for similar strings
    const similarity = stringSimilarity(normalizedSkill, normalizedTarget)
    if (similarity > bestMatch.score) {
      bestMatch = { match: target, score: similarity }
    }
  }
  
  // Check if any word in the skill matches a word in any target skill
  const skillWords = normalizedSkill.split(/[\s\-\/]+/)
  for (const target of targetSkills) {
    const targetWords = normalizeSkill(target).split(/[\s\-\/]+/)
    const commonWords = skillWords.filter(word => 
      word.length > 2 && targetWords.some(tw => tw === word || tw.startsWith(word) || word.startsWith(tw))
    );

    if (commonWords.length > 0) {
      const score = commonWords.length / Math.max(skillWords.length, targetWords.length) * 0.8;
      if (score > bestMatch.score) {
        bestMatch = { match: target, score };
      }
    }
  }

  return bestMatch;
}

/**
 * Analyze skill gaps and provide recommendations
 */
export function analyzeSkillGaps(userProfile: any, targetJobs: any[]): SkillGap[] {
  // Merge required skills across all target jobs (preserving first-seen order)
  const mergedRequired: string[] = []
  const seen = new Set<string>()
  for (const job of Array.isArray(targetJobs) ? targetJobs : []) {
    const req = Array.isArray(job?.requiredSkills) ? job.requiredSkills : []
    for (const r of req) {
      const c = canonicalizeSkill(String(r))
      if (!seen.has(c)) {
        seen.add(c)
        mergedRequired.push(c)
      }
    }
  }
  const requiredSkills: string[] = mergedRequired

  // Build user skill level map. Accepts formats:
  // - ["React", "TypeScript"]
  // - [{ name: "React", level: 4 }] where level can be 1-5 (proficiency) or 0-100
  const userSkillsRaw = Array.isArray(userProfile?.skills) ? userProfile.skills : []
  const userLevelMap = new Map<string, number>() // canonical name -> 0-100 level
  for (const s of userSkillsRaw) {
    if (typeof s === 'string') {
      userLevelMap.set(canonicalizeSkill(s), Math.max(0, Math.min(100, 65)))
    } else if (s && typeof s === 'object') {
      const name = canonicalizeSkill((s.name || s.skill || s.title || '').toString())
      let lvl = 65
      if (typeof s.level === 'number') {
        // Interpret level: if <=5, map 1..5 -> 20,40,60,75,90; if >5 assume 0..100
        if (s.level <= 5) {
          const fivePoint = Math.max(1, Math.min(5, Math.round(s.level)))
          lvl = [0, 20, 40, 60, 75, 90][fivePoint]
        } else {
          lvl = Math.max(0, Math.min(100, Math.round(s.level)))
        }
      }
      if (name) userLevelMap.set(name, lvl)
    }
  }

  // Market demand approximations (could be replaced with real data)
  const demandMap: Record<string, SkillGap['demand']> = {
    'react': 'Very High',
    'typescript': 'Very High',
    'javascript': 'Very High',
    'node.js': 'High',
    'node': 'High',
    'databases': 'High',
    'sql': 'High',
    'aws': 'Very High',
    'docker': 'High',
    'kubernetes': 'High',
    'system design': 'High',
    'testing': 'Medium',
    'api design': 'High',
    'python': 'Very High',
    'java': 'High',
    'go': 'Medium',
    'linux': 'High',
    'ci cd': 'High',
    'clinical skills': 'High',
    'medical ethics': 'Medium',
    'anatomy': 'High',
    'physiology': 'High',
    'usmle': 'Very High',
    // Electrician
    'electrical safety': 'High',
    'wiring': 'High',
    'circuits': 'High',
    'codes & standards': 'Medium',
    'troubleshooting': 'High',
    // Languages
    'spanish language': 'High',
    'english language': 'Very High',
    'nepali language': 'Medium',
    // Marketing
    'seo': 'Very High',
    'sem': 'High',
    'content marketing': 'High',
    'social media marketing': 'Very High',
    'analytics': 'Very High',
    // Data & CS
    'data structures': 'High',
    'algorithms': 'High',
    'statistics': 'Very High',
    'ml basics': 'Very High',
    'excel': 'Very High',
    'tableau': 'High',
    'data wrangling': 'High',
    'modeling': 'High',
    // Business / PM / QA / Eng
    'project management': 'High',
    'agile': 'High',
    'scrum': 'High',
    'risk management': 'Medium',
    'stakeholder management': 'High',
    'selenium': 'High',
    'test automation': 'High',
    'cad': 'High',
    'thermodynamics': 'Medium',
    'materials': 'Medium',
    'mechanics': 'Medium',
    'manufacturing': 'Medium',
    'structural analysis': 'Medium',
    'autocad': 'High',
    'surveying': 'Medium',
    'computer architecture': 'High',
    'c/c++': 'High',
    'embedded systems': 'High',
    'operating systems': 'High',
    'networking': 'High',
    'requirements gathering': 'High',
    'crm': 'High',
    'negotiation': 'High',
    'lead generation': 'High',
    'sales analytics': 'High',
    'financial accounting': 'High',
    'auditing': 'High',
    'taxation': 'High',
    'gaap/ifrs': 'High',
    'quickbooks': 'High',
    'subject matter expertise': 'High',
    'lesson planning': 'High',
    'instructional design': 'High',
    'assessment': 'High',
    'communication': 'Very High',
  }

  const salaryBoostMap: Record<string, string> = {
    'react': '+12%',
    'typescript': '+10%',
    'javascript': '+8%',
    'node.js': '+9%',
    'node': '+9%',
    'databases': '+7%',
    'sql': '+6%',
    'aws': '+15%',
    'docker': '+6%',
    'kubernetes': '+12%',
    'system design': '+20%',
    'testing': '+5%',
    'api design': '+8%',
    'python': '+10%',
    'java': '+8%',
    'go': '+7%',
    'linux': '+7%',
    'ci cd': '+8%',
    'clinical skills': '+6%',
    'medical ethics': '+4%',
    'anatomy': '+5%',
    'physiology': '+5%',
    'usmle': '+15%',
    // Electrician
    'electrical safety': '+6%',
    'wiring': '+6%',
    'circuits': '+6%',
    'codes & standards': '+5%',
    'troubleshooting': '+7%',
    // Languages
    'spanish language': '+5%',
    'english language': '+6%',
    'nepali language': '+3%',
    // Marketing
    'seo': '+10%',
    'sem': '+9%',
    'content marketing': '+7%',
    'social media marketing': '+7%',
    'analytics': '+8%',
    // Data & CS
    'data structures': '+10%',
    'algorithms': '+10%',
    'statistics': '+9%',
    'ml basics': '+12%',
    'excel': '+6%',
    'tableau': '+7%',
    'data wrangling': '+8%',
    'modeling': '+10%',
    // Business / PM / QA / Eng
    'project management': '+9%',
    'agile': '+7%',
    'scrum': '+7%',
    'risk management': '+6%',
    'stakeholder management': '+8%',
    'selenium': '+6%',
    'test automation': '+7%',
    'cad': '+6%',
    'thermodynamics': '+5%',
    'materials': '+5%',
    'mechanics': '+5%',
    'manufacturing': '+5%',
    'structural analysis': '+5%',
    'autocad': '+6%',
    'surveying': '+5%',
    'computer architecture': '+8%',
    'c/c++': '+8%',
    'embedded systems': '+8%',
    'operating systems': '+8%',
    'networking': '+7%',
    'requirements gathering': '+7%',
    'crm': '+6%',
    'negotiation': '+6%',
    'lead generation': '+6%',
    'sales analytics': '+7%',
    'financial accounting': '+9%',
    'auditing': '+8%',
    'taxation': '+8%',
    'gaap/ifrs': '+9%',
    'quickbooks': '+6%',
    'subject matter expertise': '+6%',
    'lesson planning': '+6%',
    'instructional design': '+7%',
    'assessment': '+6%',
    'communication': '+9%',
  }

  const base: SkillGap[] = requiredSkills.map((skillRaw, idx) => {
    const skillCanonical = canonicalizeSkill(String(skillRaw))
    const hasLevel = userLevelMap.has(skillCanonical)
    const currentLevel = hasLevel ? userLevelMap.get(skillCanonical)! : 30
    const targetLevel = hasLevel ? 85 : 90
    const importance: SkillGap['importance'] = idx < 3 ? 'High' : idx < 6 ? 'Medium' : 'Low'
    const demand = demandMap[skillCanonical] || 'Medium'
    const avgSalaryIncrease = salaryBoostMap[skillCanonical] || '+5%'
    return { skill: skillCanonical, currentLevel, targetLevel, importance, demand, avgSalaryIncrease }
  })

  // Sort by largest deficit first
  return base.sort((a, b) => (b.targetLevel - b.currentLevel) - (a.targetLevel - a.currentLevel))
}

/**
 * Get personalized training recommendations
 */
export function getTrainingRecommendations(skillGaps: SkillGap[]): TrainingRecommendation[] {
  // Curated catalog of courses by skill
  const catalog: Record<string, Omit<TrainingRecommendation, 'id' | 'relevance'>[]> = {
    'typescript': [
      { title: 'Advanced TypeScript Patterns', provider: 'Frontend Masters', duration: '6 hours', level: 'Advanced', rating: 4.8, url: 'https://frontendmasters.com/courses/typescript-v4/', targetSkills: ['typescript', 'advanced patterns'] },
      { title: 'TypeScript for Professionals', provider: 'Udemy', duration: '8 hours', level: 'Intermediate', rating: 4.6, url: 'https://www.udemy.com/topic/typescript/', targetSkills: ['typescript', 'intermediate concepts'] },
    ],
    'system design': [
      { title: 'Grokking Modern System Design Interview', provider: 'Educative', duration: '12 hours', level: 'Intermediate', rating: 4.9, url: 'https://www.educative.io/courses/grokking-modern-system-design-interview-for-engineers-managers', targetSkills: ['system design', 'scalability', 'distributed systems'] },
      { title: 'System Design Primer (free)', provider: 'GitHub', duration: 'Self-paced', level: 'Intermediate', rating: 4.7, url: 'https://github.com/donnemartin/system-design-primer', targetSkills: ['system design', 'architecture'] },
    ],
    'react': [
      { title: 'Complete Intro to React', provider: 'Frontend Masters', duration: '10 hours', level: 'Intermediate', rating: 4.8, url: 'https://frontendmasters.com/courses/complete-react-v8/', targetSkills: ['react', 'hooks', 'context api'] },
      { title: 'React - The Complete Guide', provider: 'Udemy', duration: '40 hours', level: 'Beginner', rating: 4.7, url: 'https://www.udemy.com/course/react-the-complete-guide-incl-redux/', targetSkills: ['react', 'beginner', 'fundamentals'] },
    ],
    'node.js': [
      { title: 'Node.js Fundamentals', provider: 'Frontend Masters', duration: '8 hours', level: 'Beginner', rating: 4.7, url: 'https://frontendmasters.com/courses/node-js-v3/', targetSkills: ['node.js', 'javascript', 'backend'] },
      { title: 'Node.js, Express & MongoDB', provider: 'Udemy', duration: '20 hours', level: 'Intermediate', rating: 4.6, url: 'https://www.udemy.com/topic/nodejs/', targetSkills: ['node.js', 'express', 'mongodb', 'backend'] },
    ],
    'docker': [
      { title: 'Docker for Developers', provider: 'Frontend Masters', duration: '4 hours', level: 'Beginner', rating: 4.6, url: 'https://frontendmasters.com/courses/docker/', targetSkills: ['docker', 'containers', 'devops'] },
      { title: 'Docker Mastery', provider: 'Udemy', duration: '19 hours', level: 'Intermediate', rating: 4.7, url: 'https://www.udemy.com/course/docker-mastery/', targetSkills: ['docker', 'containers', 'orchestration', 'devops'] },
    ],
    'kubernetes': [
      { title: 'Kubernetes Fundamentals', provider: 'Linux Foundation', duration: 'Self-paced', level: 'Intermediate', rating: 4.7, url: 'https://training.linuxfoundation.org/training/kubernetes-fundamentals/', targetSkills: ['kubernetes', 'containers', 'orchestration'] },
    ],
    'aws': [
      { title: 'AWS Certified Solutions Architect - Associate', provider: 'A Cloud Guru', duration: '20 hours', level: 'Intermediate', rating: 4.7, url: 'https://acloudguru.com/learning-paths/aws-solutions-architect-associate', targetSkills: ['aws', 'cloud architecture', 'solutions architect'] },
      { title: 'AWS Cloud Practitioner Essentials (free)', provider: 'AWS', duration: '6 hours', level: 'Beginner', rating: 4.6, url: 'https://www.aws.training/Details/eLearning?id=60697', targetSkills: ['aws', 'cloud basics', 'cloud concepts'] },
    ],
    'databases': [
      { title: 'SQL (freeCodeCamp)', provider: 'freeCodeCamp', duration: 'Self-paced', level: 'Beginner', rating: 4.7, url: 'https://www.freecodecamp.org/news/learn-sql-free-full-course/', targetSkills: ['sql', 'databases', 'queries'] },
      { title: 'Designing Data-Intensive Applications (book)', provider: 'O’Reilly', duration: 'Book', level: 'Advanced', rating: 4.8, url: 'https://dataintensive.net/', targetSkills: ['database design', 'distributed systems', 'data modeling'] },
    ],
    'testing': [
      { title: 'Testing JavaScript Apps', provider: 'Kent C. Dodds', duration: '10 hours', level: 'Intermediate', rating: 4.8, url: 'https://testingjavascript.com/', targetSkills: ['javascript', 'testing', 'unit testing', 'integration testing'] },
    ],
    'api design': [
      { title: 'API Design in Node.js', provider: 'Frontend Masters', duration: '6 hours', level: 'Intermediate', rating: 4.7, url: 'https://frontendmasters.com/courses/api-design-nodejs-v4/', targetSkills: ['api design', 'node.js', 'rest', 'graphql'] },
    ],
    'python': [
      { title: 'Python for Everybody (free)', provider: 'Coursera', duration: 'Self-paced', level: 'Beginner', rating: 4.8, url: 'https://www.coursera.org/specializations/python', targetSkills: ['python', 'programming basics', 'beginner'] },
    ],
    // CS Fundamentals
    'data structures': [
      { title: 'Data Structures & Algorithms', provider: 'Coursera (UCSD)', duration: '60 hours', level: 'Intermediate', rating: 4.8, url: 'https://www.coursera.org/specializations/data-structures-algorithms', targetSkills: ['data structures', 'algorithms', 'problem solving'] },
    ],
    'algorithms': [
      { title: 'Algorithms (Princeton)', provider: 'Coursera', duration: '54 hours', level: 'Intermediate', rating: 4.8, url: 'https://www.coursera.org/specializations/algorithms', targetSkills: ['algorithms', 'problem solving', 'computer science'] },
    ],
    // Marketing
    'seo': [
      { title: 'SEO Fundamentals', provider: 'Semrush Academy (free)', duration: 'Self-paced', level: 'Beginner', rating: 4.7, url: 'https://www.semrush.com/academy/', targetSkills: ['seo', 'search engine optimization', 'digital marketing'] },
    ],
    'sem': [
      { title: 'Google Ads Certification', provider: 'Google Skillshop (free)', duration: 'Self-paced', level: 'Beginner', rating: 4.7, url: 'https://skillshop.exceedlms.com/student/path/18172-google-ads-search-certification', targetSkills: ['sem', 'google ads', 'paid advertising'] },
    ],
    'content marketing': [
      { title: 'Content Marketing Certified', provider: 'HubSpot Academy (free)', duration: 'Self-paced', level: 'Beginner', rating: 4.7, url: 'https://academy.hubspot.com/courses/content-marketing', targetSkills: ['content marketing', 'content strategy', 'digital marketing'] },
    ],
    'social media marketing': [
      { title: 'Meta Social Media Marketing', provider: 'Coursera', duration: '70 hours', level: 'Beginner', rating: 4.7, url: 'https://www.coursera.org/professional-certificates/meta-social-media-marketing', targetSkills: ['social media', 'digital marketing', 'meta platforms'] },
    ],
    'analytics': [
      { title: 'Google Analytics Certification', provider: 'Google Skillshop (free)', duration: 'Self-paced', level: 'Beginner', rating: 4.7, url: 'https://skillshop.exceedlms.com/student/path/29343-google-analytics-certification', targetSkills: ['google analytics', 'web analytics', 'data analysis'] },
    ],
    // Data
    'statistics': [
      { title: 'Statistics with Python', provider: 'Coursera (UMich)', duration: '50 hours', level: 'Intermediate', rating: 4.7, url: 'https://www.coursera.org/specializations/statistics-with-python', targetSkills: ['statistics', 'data analysis', 'python'] },
    ],
    'excel': [
      { title: 'Excel Skills for Business', provider: 'Coursera (Macquarie)', duration: '25 hours', level: 'Beginner', rating: 4.8, url: 'https://www.coursera.org/specializations/excel', targetSkills: ['excel', 'spreadsheets', 'data analysis'] },
    ],
    'tableau': [
      { title: 'Data Visualization with Tableau', provider: 'Coursera (UC Davis)', duration: '20 hours', level: 'Beginner', rating: 4.7, url: 'https://www.coursera.org/specializations/data-visualization', targetSkills: ['tableau', 'data visualization', 'dashboards'] },
    ],
    'data wrangling': [
      { title: 'Data Wrangling, Analysis and AB Testing', provider: 'Udacity (free)', duration: 'Self-paced', level: 'Intermediate', rating: 4.6, url: 'https://www.udacity.com/course/data-wrangling--ud170', targetSkills: ['data wrangling', 'data cleaning', 'data analysis'] },
    ],
    'modeling': [
      { title: 'Machine Learning', provider: 'Coursera (Andrew Ng)', duration: '60 hours', level: 'Intermediate', rating: 4.9, url: 'https://www.coursera.org/learn/machine-learning', targetSkills: ['machine learning', 'ai', 'predictive modeling'] },
    ],
    // Electrician
    'electrical safety': [
      { title: 'Electrical Safety (OSHA)', provider: 'OSHA Education Center', duration: 'Self-paced', level: 'Beginner', rating: 4.6, url: 'https://www.oshaeducationcenter.com/', targetSkills: ['electrical safety', 'osha', 'workplace safety'] },
    ],
    'wiring': [
      { title: 'Residential Wiring Fundamentals', provider: 'Alison (free)', duration: '3 hours', level: 'Beginner', rating: 4.6, url: 'https://alison.com/course/electrical-drawing-and-wiring-techniques', targetSkills: ['electrical wiring', 'residential wiring', 'electrical installation'] },
    ],
    'circuits': [
      { title: 'Circuit Design', provider: 'Coursera', duration: '20 hours', level: 'Beginner', rating: 4.6, url: 'https://www.coursera.org/learn/circuits', targetSkills: ['circuit design', 'electrical circuits', 'electronics'] },
    ],
    'codes & standards': [
      { title: 'NEC Code Updates', provider: 'NFPA', duration: 'Self-paced', level: 'Intermediate', rating: 4.6, url: 'https://www.nfpa.org/training', targetSkills: ['electrical codes', 'safety standards', 'NEC'] },
    ],
    'troubleshooting': [
      { title: 'Electrical Troubleshooting', provider: 'LinkedIn Learning', duration: '2 hours', level: 'Beginner', rating: 4.6, url: 'https://www.linkedin.com/learning/', targetSkills: ['troubleshooting', 'electrical systems', 'problem solving'] },
    ],
    // Languages
    'spanish language': [
      { title: 'Spanish (A1-B1)', provider: 'Duolingo', duration: 'Self-paced', level: 'Beginner', rating: 4.6, url: 'https://www.duolingo.com/', targetSkills: ['spanish', 'language learning', 'communication'] },
      { title: 'Spanish for Beginners', provider: 'Coursera', duration: '40 hours', level: 'Beginner', rating: 4.7, url: 'https://www.coursera.org/specializations/spanish', targetSkills: ['spanish', 'beginner language', 'conversational skills'] },
    ],
    'english language': [
      { title: 'English for Career Development', provider: 'Coursera', duration: '40 hours', level: 'Beginner', rating: 4.8, url: 'https://www.coursera.org/learn/career-success', targetSkills: ['english', 'professional communication', 'career development'] },
      { title: 'IELTS Academic Test Prep', provider: 'edX', duration: '8 weeks', level: 'Intermediate', rating: 4.6, url: 'https://www.edx.org/course/ielts-academic-test-preparation', targetSkills: ['ielts', 'english proficiency', 'test preparation'] },
    ],
    'nepali language': [
      { title: 'Learn Nepali Basics', provider: 'YouTube (free)', duration: 'Self-paced', level: 'Beginner', rating: 4.5, url: 'https://www.youtube.com/results?search_query=learn+nepali+for+beginners', targetSkills: ['nepali', 'language basics', 'conversational nepali'] },
    ],
    // Digital Marketing
    'digital marketing': [
      { title: 'Digital Marketing Specialization', provider: 'Coursera (University of Illinois)', duration: '120 hours', level: 'Intermediate', rating: 4.7, url: 'https://www.coursera.org/specializations/digital-marketing', targetSkills: ['digital marketing', 'online advertising', 'social media marketing'] },
    ],
    // Data Analysis
    'data analysis': [
      { title: 'Data Analysis with Python', provider: 'Coursera (UMich)', duration: '50 hours', level: 'Intermediate', rating: 4.7, url: 'https://www.coursera.org/specializations/data-analysis-with-python', targetSkills: ['data analysis', 'python', 'pandas', 'numpy'] },
    ],
    // Data Science
    'data science': [
      { title: 'Data Science Specialization', provider: 'Coursera (Johns Hopkins)', duration: '120 hours', level: 'Intermediate', rating: 4.8, url: 'https://www.coursera.org/specializations/data-science', targetSkills: ['data science', 'machine learning', 'statistics', 'R programming'] },
    ],
    // Machine Learning
    'machine learning': [
      { title: 'Machine Learning with Python', provider: 'Coursera (UMich)', duration: '50 hours', level: 'Intermediate', rating: 4.8, url: 'https://www.coursera.org/specializations/machine-learning-with-python', targetSkills: ['machine learning', 'python', 'scikit-learn', 'modeling'] },
    ],
    // Deep Learning
    'deep learning': [
      { title: 'Deep Learning Specialization', provider: 'Coursera (Stanford)', duration: '120 hours', level: 'Advanced', rating: 4.9, url: 'https://www.coursera.org/specializations/deep-learning', targetSkills: ['deep learning', 'neural networks', 'tensorflow', 'pytorch'] },
    ],
    // Natural Language Processing
    'natural language processing': [
      { title: 'Natural Language Processing with Python', provider: 'Coursera (UMich)', duration: '50 hours', level: 'Intermediate', rating: 4.8, url: 'https://www.coursera.org/specializations/natural-language-processing-with-python', targetSkills: ['nlp', 'natural language processing', 'text mining', 'machine learning'] },
    ],
    // Computer Vision
    'computer vision': [
      { title: 'Computer Vision with Python', provider: 'Coursera (UMich)', duration: '50 hours', level: 'Intermediate', rating: 4.8, url: 'https://www.coursera.org/specializations/computer-vision-with-python', targetSkills: ['computer vision', 'image processing', 'opencv', 'deep learning'] },
    ],
  }

  // Rank by deficit and map to 1-2 courses per top gaps
  const ordered = [...skillGaps].sort((a, b) => (b.targetLevel - b.currentLevel) - (a.targetLevel - a.currentLevel))
  const out: TrainingRecommendation[] = []
  let idCounter = 1
  for (const gap of ordered.slice(0, 6)) {
    const key = gap.skill.trim().toLowerCase()
    const courses = catalog[key] || []
    // Relevance based on gap size and importance
    const deficit = gap.targetLevel - gap.currentLevel
    const impBoost = gap.importance === 'High' ? 10 : gap.importance === 'Medium' ? 5 : 0
    courses.slice(0, 2).forEach((c, idx) => {
      const relevance = Math.min(99, Math.round(deficit + impBoost - idx * 5))
      out.push({ id: String(idCounter++), relevance, ...c })
    })
  }

  // Fallback if nothing matched catalog
  if (out.length === 0) {
    out.push({ 
      id: '1', 
      title: 'Problem Solving & Communication', 
      provider: 'General', 
      duration: 'Self-paced', 
      level: 'Beginner', 
      rating: 4.6, 
      relevance: 80,
      targetSkills: ['problem solving', 'communication', 'soft skills']
    })
  }
  // Sort by relevance desc
  return out.sort((a, b) => b.relevance - a.relevance)
}

// Enhanced skill matching with fuzzy matching and categories
export function calculateSkillsMatch(userSkills: unknown[], requiredSkills: unknown[]): number {
  if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) return 100
  if (!Array.isArray(userSkills) || userSkills.length === 0) return 0
  
  // Ensure all skills are strings and filter out any invalid values
  const normalizedUserSkills = [...new Set(
    userSkills
      .filter((s): s is string => typeof s === 'string')
      .map(s => normalizeSkill(s))
      .filter(Boolean)
  )]
  
  const normalizedRequiredSkills = [...new Set(
    requiredSkills
      .filter((s): s is string => typeof s === 'string')
      .map(s => normalizeSkill(s))
      .filter(Boolean)
  )]
  
  if (normalizedRequiredSkills.length === 0) return 100
  
  // Calculate base score based on exact matches
  const exactMatches = normalizedRequiredSkills.filter(rs => 
    normalizedUserSkills.some(us => us === rs)
  )
  
  // Calculate partial matches for remaining skills
  const remainingSkills = normalizedRequiredSkills.filter(rs => !exactMatches.includes(rs))
  const partialMatches = remainingSkills
    .map(rs => {
      const match = findBestSkillMatch(rs, normalizedUserSkills)
      return {
        skill: rs,
        match: match.match || '',
        score: match.score
      }
    })
    .filter(m => m.score > 0.5) // Only consider good matches
  
  // Calculate category coverage
  const requiredCategories = new Set(
    normalizedRequiredSkills.flatMap(rs => categorizeSkill(rs))
  )
  
  const userCategories = new Set(
    [...normalizedUserSkills, ...partialMatches.map(pm => pm.match)]
      .filter((s): s is string => typeof s === 'string')
      .flatMap(us => categorizeSkill(us))
  )
  
  const categoryCoverage = requiredCategories.size > 0 
    ? [...requiredCategories].filter(cat => userCategories.has(cat)).length / requiredCategories.size 
    : 0
  
  // Weighted score calculation
  const exactMatchWeight = 0.6
  const partialMatchWeight = 0.3
  const categoryWeight = 0.1
  
  const exactMatchScore = exactMatches.length / normalizedRequiredSkills.length
  const partialMatchScore = partialMatches.reduce((sum, m) => sum + m.score, 0) / normalizedRequiredSkills.length
  
  const totalScore = (
    exactMatchScore * exactMatchWeight +
    partialMatchScore * partialMatchWeight +
    categoryCoverage * categoryWeight
  ) * 100
  
  return Math.min(100, Math.round(totalScore))
}

function calculateExperienceMatch(userExp: number, requiredExp: number): number {
  if (userExp >= requiredExp) return 100
  return Math.round((userExp / requiredExp) * 100)
}

function calculateLocationMatch(userLocation: string | null | undefined, jobLocation: string): number {
  if (!jobLocation) return 50
  if (typeof jobLocation !== 'string') return 50
  if (jobLocation.toLowerCase().includes("remote")) return 100
  if (!userLocation || typeof userLocation !== 'string') return 50
  if (userLocation.toLowerCase() === jobLocation.toLowerCase()) return 100
  return 50
}

function calculateSalaryMatch(expectedSalary: number, jobSalary: { min: number; max: number }): number {
  if (expectedSalary >= jobSalary.min && expectedSalary <= jobSalary.max) return 100
  if (expectedSalary < jobSalary.min) return 100
  return Math.max(0, 100 - ((expectedSalary - jobSalary.max) / expectedSalary) * 100)
}
