export interface SkillGap {
  skill: string;
  currentLevel: number;
  targetLevel: number;
  importance: 'Low' | 'Medium' | 'High' | 'Critical';
  demand: 'Low' | 'Medium' | 'High' | 'Very High';
  avgSalaryIncrease?: string;
}

export interface TrainingRecommendation {
  id: string;
  title: string;
  provider: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  rating: number;
  url: string;
  targetSkills?: string[];
  relevance?: 'Low' | 'Medium' | 'High';
  cost?: string;
}

export interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  duration: string;
  status: 'completed' | 'in-progress' | 'pending';
  order: number;
  resources?: Array<{
    id: string;
    title: string;
    type: 'course' | 'article' | 'video' | 'project' | 'certification';
    url: string;
    duration?: string;
  }>;
}

export interface DreamJob {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  averageSalary: string;
  growthRate: string;
}

export interface TrainingData {
  skillGaps: SkillGap[];
  recommendations: TrainingRecommendation[];
  roadmap: RoadmapStep[];
  dreamJob?: DreamJob;
}

export interface Video {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

// Available dream jobs
export const DREAM_JOBS: DreamJob[] = [
  {
    id: 'frontend-dev',
    title: 'Senior Frontend Developer',
    description: 'Build modern, responsive web applications using React, TypeScript, and modern CSS',
    requiredSkills: ['React', 'TypeScript', 'JavaScript', 'CSS', 'HTML', 'Redux', 'Next.js'],
    averageSalary: '$120,000',
    growthRate: '15% (Much faster than average)'
  },
  {
    id: 'backend-dev',
    title: 'Backend Developer',
    description: 'Develop scalable server-side applications and APIs',
    requiredSkills: ['Node.js', 'Python', 'Java', 'SQL', 'REST APIs', 'Docker', 'AWS'],
    averageSalary: '$125,000',
    growthRate: '13% (Much faster than average)'
  },
  {
    id: 'fullstack-dev',
    title: 'Full Stack Developer',
    description: 'Work on both frontend and backend development',
    requiredSkills: ['React', 'Node.js', 'Express', 'MongoDB', 'REST APIs', 'Docker'],
    averageSalary: '$130,000',
    growthRate: '17% (Much faster than average)'
  },
  {
    id: 'devops-engineer',
    title: 'DevOps Engineer',
    description: 'Implement CI/CD pipelines and cloud infrastructure',
    requiredSkills: ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Terraform', 'Linux'],
    averageSalary: '$140,000',
    growthRate: '20% (Much faster than average)'
  },
  {
    id: 'python-dev',
    title: 'Python Developer',
    description: 'Develop applications and scripts using Python',
    requiredSkills: ['Python', 'Django', 'Flask', 'REST APIs', 'SQL', 'Git'],
    averageSalary: '$115,000',
    growthRate: '22% (Much faster than average)'
  },
  {
    id: 'fullstack-dev-js',
    title: 'Full Stack JavaScript Developer',
    description: 'Build end-to-end web applications with JavaScript technologies',
    requiredSkills: ['JavaScript', 'React', 'Node.js', 'Express', 'MongoDB', 'REST APIs'],
    averageSalary: '$125,000',
    growthRate: '18% (Much faster than average)'
  },
  {
    id: 'data-analyst',
    title: 'Data Analyst',
    description: 'Analyze and interpret complex data to help companies make better decisions',
    requiredSkills: ['SQL', 'Python', 'Excel', 'Tableau', 'Statistics', 'Data Visualization'],
    averageSalary: '$85,000',
    growthRate: '25% (Much faster than average)'
  },
  {
    id: 'data-scientist',
    title: 'Data Scientist',
    description: 'Use statistical methods and machine learning to extract insights from data',
    requiredSkills: ['Python', 'R', 'Machine Learning', 'Statistics', 'Data Analysis', 'SQL'],
    averageSalary: '$130,000',
    growthRate: '31% (Much faster than average)'
  },
  {
    id: 'qa-engineer',
    title: 'QA Engineer',
    description: 'Ensure software quality through testing and automation',
    requiredSkills: ['Testing', 'Selenium', 'Jest', 'Cypress', 'Test Automation', 'Agile'],
    averageSalary: '$95,000',
    growthRate: '12% (Faster than average)'
  },
  {
    id: 'ui-ux-designer',
    title: 'UI/UX Designer',
    description: 'Design intuitive and engaging user experiences',
    requiredSkills: ['Figma', 'Sketch', 'User Research', 'Wireframing', 'Prototyping', 'UI Design'],
    averageSalary: '$110,000',
    growthRate: '16% (Much faster than average)'
  },
  {
    id: 'graphic-designer',
    title: 'Graphic Designer',
    description: 'Create visual concepts to communicate ideas',
    requiredSkills: ['Adobe Creative Suite', 'Typography', 'Branding', 'Layout', 'Print Design', 'Digital Illustration'],
    averageSalary: '$75,000',
    growthRate: '8% (As fast as average)'
  }
];
