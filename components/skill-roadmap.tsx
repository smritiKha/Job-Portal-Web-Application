'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, CheckCircle, Clock, Star } from "lucide-react"

interface SkillItem {
  skill: string
  currentLevel: number
  targetLevel: number
  importance: 'High' | 'Medium' | 'Low'
  demand: string
  avgSalaryIncrease?: string
}

interface SkillRoadmapProps {
  skills: SkillItem[]
  onSkillClick?: (skill: string) => void
}

export function SkillRoadmap({ skills, onSkillClick }: SkillRoadmapProps) {
  // Group skills by priority
  const highPriority = skills.filter(skill => skill.importance === 'High')
  const mediumPriority = skills.filter(skill => skill.importance === 'Medium')
  const lowPriority = skills.filter(skill => skill.importance === 'Low')

  const PrioritySection = ({ 
    title, 
    skills, 
    icon: Icon 
  }: { 
    title: string; 
    skills: SkillItem[]; 
    icon: React.ComponentType<{ className?: string }> 
  }) => (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5" />
        <h3 className="text-lg font-semibold">{title} Priority</h3>
        <Badge variant="outline" className="ml-2">{skills.length} skills</Badge>
      </div>
      
      <div className="space-y-4">
        {skills.map((skill) => (
          <div 
            key={skill.skill} 
            className="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => onSkillClick?.(skill.skill)}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="font-medium">{skill.skill}</div>
              <div className="flex items-center gap-2">
                {skill.demand === 'High' && (
                  <Badge variant="destructive" className="text-xs">High Demand</Badge>
                )}
                {skill.avgSalaryIncrease && (
                  <Badge variant="secondary" className="text-xs">
                    {skill.avgSalaryIncrease} salary boost
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
              <div className="flex items-center gap-1">
                <span>Current:</span>
                <span className="font-medium">{skill.currentLevel}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span>Target:</span>
                <span className="font-medium">{skill.targetLevel}%</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.min(skill.currentLevel, skill.targetLevel)}%</span>
              </div>
              <Progress 
                value={skill.currentLevel} 
                max={skill.targetLevel}
                className="h-2"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl">Your Learning Roadmap</CardTitle>
        <p className="text-sm text-muted-foreground">
          Skills organized by priority to help you focus on what matters most
        </p>
      </CardHeader>
      <CardContent className="space-y-8">
        {highPriority.length > 0 && (
          <PrioritySection 
            title="High" 
            skills={highPriority} 
            icon={AlertCircle} 
          />
        )}
        
        {mediumPriority.length > 0 && (
          <PrioritySection 
            title="Medium" 
            skills={mediumPriority} 
            icon={Clock} 
          />
        )}
        
        {lowPriority.length > 0 && (
          <PrioritySection 
            title="Low" 
            skills={lowPriority} 
            icon={Star} 
          />
        )}
        
        {skills.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="mx-auto h-12 w-12 mb-2 opacity-50" />
            <p>No skills to display. Complete your profile to see your personalized skill roadmap.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
