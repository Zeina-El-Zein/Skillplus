export type UserRole = "student" | "institution";

export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

export type AuthResponse = {
  message: string;
  user: User;
};

export type StudentProfile = {
  user_id: number;
  major: string;
  year_of_study: number;
  courses_taken: string[];
  current_skills: string[];
  interests: string[];
  career_goal: string;
  available_time_per_week: number;
  preferred_opportunity_type: string;
};

export type ProfileResponse = {
  message: string;
  student_id: number;
};

export type AnalysisResult = {
  level: string;
  strengths: string[];
  missing: string[];
  next_step: string;
};

export type OpportunityRecommendation = {
  id: number;
  title: string;
  category: string | null;
  suitable_major: string | null;
  suitable_year: number | null;
  difficulty: string | null;
  required_skills: string[] | null;
  skills_gained: string[] | null;
  deadline: string | null;
  estimated_time: string | null;
  cv_benefit: string | null;
  link: string | null;
  hours_per_week: number | null;
  match_score: number;
  reasons: string[];
};

export type RecommendationsResponse = {
  user_id: number;
  recommendations: OpportunityRecommendation[];
};

export type InstitutionProfile = {
  id?: number;
  user_id: number;
  institution_name: string;
  website: string | null;
  description: string | null;
};

export type OpportunityCategory =
  | "Internship"
  | "Project"
  | "Workshop"
  | "Bootcamp"
  | "Hackathon"
  | "Competition"
  | "Mentorship"
  | "Research";

export type OpportunityDifficulty = "Beginner" | "Intermediate" | "Advanced";

export type SuitableMajor =
  | "Computer and Communications Engineering"
  | "Computer Science"
  | "Electrical Engineering"
  | "Mechanical Engineering"
  | "Civil Engineering"
  | "Industrial Engineering"
  | "Chemical Engineering"
  | "Other"
  | "Any";

export type OpportunityDraft = {
  title: string;
  category: OpportunityCategory | null;
  difficulty: OpportunityDifficulty | null;
  suitable_major: SuitableMajor | null;
  suitable_year: number | null;
  required_skills: string[];
  skills_gained: string[];
  hours_per_week: number | null;
  estimated_time: string | null;
  cv_benefit: string | null;
  link: string | null;
  deadline: string | null;
};

export type OpportunityDraftState = {
  draft: OpportunityDraft;
  warning?: string;
};

export type OpportunitySubmission = Omit<
  OpportunityDraft,
  "category" | "difficulty" | "suitable_major"
> & {
  user_id: number;
  category: OpportunityCategory;
  difficulty: OpportunityDifficulty;
  suitable_major: SuitableMajor;
};

export type OpportunityProcessResponse = OpportunityDraftState;

export type OpportunitySubmissionResponse = {
  message: string;
  opportunity_id: number;
  institution_id: number;
  source: "institution";
};

export type RoadmapMilestone = {
  title: string;
  description: string;
  skills_to_learn: string[];
  suggested_timeframe: string;
};

export type RoadmapContent = {
  summary: string;
  milestones: RoadmapMilestone[];
  recommended_next_steps: string[];
};

export type RoadmapResponse = {
  user_id: number;
  source: "ai" | "fallback";
  generated_at?: string;
  roadmap: RoadmapContent;
};

export type StudentTaskStatus = "todo" | "in_progress" | "done";

export type StudentTaskPriority = "high" | "medium" | "low";

export type StudentTaskSource = "opportunity" | "roadmap";

export type StudentTask = {
  id: number;
  title: string;
  description: string | null;
  status: StudentTaskStatus;
  priority: StudentTaskPriority;
  opportunity_id: number | null;
  roadmap_step_id: number | null;
  source: StudentTaskSource;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type StudentTasksResponse = {
  tasks: StudentTask[];
};