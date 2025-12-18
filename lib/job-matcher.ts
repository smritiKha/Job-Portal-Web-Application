import { DREAM_JOBS, type DreamJob, type SkillGap } from "./types";

interface UserProfile {
  skills?: string[];
  experience?: {
    years?: number;
    technologies?: string[];
    roles?: string[];
  };
  education?: {
    degree?: string;
    field?: string;
  };
}

export function suggestDreamJobs(userProfile: UserProfile): DreamJob[] {
  if (!userProfile.skills || userProfile.skills.length === 0) {
    // If no skills provided, return all jobs sorted by demand
    return [...DREAM_JOBS].sort((a, b) => 
      parseFloat(b.growthRate) - parseFloat(a.growthRate)
    );
  }

  // Score each job based on skill matches
  const scoredJobs = DREAM_JOBS.map(job => {
    const userSkills = userProfile.skills!.map(skill => skill.toLowerCase());
    const jobSkills = job.requiredSkills.map(skill => skill.toLowerCase());
    
    // Calculate skill match score
    const matchingSkills = jobSkills.filter(skill => 
      userSkills.some(userSkill => 
        userSkill.includes(skill) || skill.includes(userSkill)
      )
    );
    
    const matchPercentage = (matchingSkills.length / jobSkills.length) * 100;
    
    // Adjust score based on experience level if available
    let experienceBonus = 0;
    if (userProfile.experience?.years) {
      // More experience gives higher bonus, but with diminishing returns
      experienceBonus = Math.min(userProfile.experience.years * 5, 30);
    }
    
    // Adjust score based on education if relevant
    let educationBonus = 0;
    if (userProfile.education?.field) {
      const educationField = userProfile.education.field.toLowerCase();
      const relevantFields = ['computer science', 'engineering', 'technology', 'it'];
      if (relevantFields.some(field => educationField.includes(field))) {
        educationBonus = 10;
      }
    }
    
    const totalScore = matchPercentage + experienceBonus + educationBonus;
    
    return {
      ...job,
      matchScore: totalScore,
      matchedSkills: matchingSkills,
      missingSkills: job.requiredSkills.filter(skill => 
        !matchingSkills.includes(skill.toLowerCase())
      )
    };
  });

  // Sort by match score (highest first) and then by growth rate
  return scoredJobs
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      return parseFloat(b.growthRate) - parseFloat(a.growthRate);
    })
    .map(({ matchScore, matchedSkills, missingSkills, ...job }) => job);
}

export function analyzeSkillGaps(userProfile: UserProfile, targetJobId: string): SkillGap[] {
  const targetJob = DREAM_JOBS.find(job => job.id === targetJobId);
  if (!targetJob) return [];
  
  const userSkills = userProfile.skills?.map(s => s.toLowerCase()) || [];
  
  return targetJob.requiredSkills.map(skill => {
    const skillLower = skill.toLowerCase();
    const hasSkill = userSkills.some(s => 
      s.includes(skillLower) || skillLower.includes(s)
    );
    
    // Calculate current level based on skill match and experience
    let currentLevel = hasSkill ? 3 : 1; // Default to 3 if skill exists, 1 if not
    if (userProfile.experience?.years) {
      // Increase level based on years of experience
      currentLevel = Math.min(currentLevel + Math.floor(userProfile.experience.years / 2), 5);
    }
    
    return {
      skill,
      currentLevel,
      targetLevel: 4, // Target level is typically 4 (proficient) for required skills
      importance: 'High',
      demand: 'High',
      avgSalaryIncrease: '15%' // Default value, can be adjusted based on market data
    };
  });
}
