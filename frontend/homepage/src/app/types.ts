export type UserRole = "student" | "institution";

export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  has_profile?: boolean | null;
};

export type AuthResponse = {
  message: string;
  user: User;
  has_profile: boolean | null;
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
  profile_picture_url?: string | null;
};

export type StudentProfileResponse = StudentProfile & {
  student_id: number;
  level: string | null;
  profile_picture_url: string | null;
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
  logo_url?: string | null;
};

export type ProfilePictureUploadResponse = {
  message: string;
  profile_picture_url: string;
};

export type InstitutionLogoUploadResponse = {
  message: string;
  logo_url: string;
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

export type OpportunityDifficulty =
  | "Beginner"
  | "Intermediate"
  | "Advanced";

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

export type OpportunityProcessResponse =
  OpportunityDraftState;

export type OpportunitySubmissionResponse = {
  message: string;
  opportunity_id: number;
  institution_id: number;
  source: "institution";
};

export type InstitutionOpportunity = {
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
  institution_id: number | null;
  source?: "seed" | "institution";
  created_at?: string | null;
  views?: number;
  added_to_todo?: number;
};

/* ============================================================
   ROADMAP
   ============================================================ */

export type RoadmapOpportunity = {
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
};

export type RoadmapOpportunityMatch = {
  opportunity: RoadmapOpportunity;
  score: number;
  reasons: string[];
  match_level: number;
};

export type RoadmapStep = {
  order: number;
  title: string;
  description: string;
  relevant_skill: string;
  opportunity_category: string;
  priority: "high" | "medium" | "low";
  task_id: number | null;
  opportunities: RoadmapOpportunityMatch[];
};

export type RoadmapContent = {
  summary: string;
  steps: RoadmapStep[];
};

export type RoadmapResponse = {
  user_id: number;
  source: "ai" | "fallback";
  generated_at?: string;
  roadmap: RoadmapContent;
};

export type RoadmapTaskCreateResponse = {
  message: string;
  task: StudentTask;
  step: RoadmapStep;
};

/* ============================================================
   STUDENT TASKS
   ============================================================ */

export type TaskStatus = "todo" | "in_progress" | "done";

export type TaskPriority = "high" | "medium" | "low";

export type TaskSource = "opportunity" | "roadmap";

/*
  Aliases used by Sara's dashboard/shared API code.
  They represent the same values as the To-Do system.
*/
export type StudentTaskStatus = TaskStatus;
export type StudentTaskPriority = TaskPriority;
export type StudentTaskSource = TaskSource;

export type StudentTask = {
  id: number;
  student_id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  opportunity_id: number | null;
  source: TaskSource;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type StudentTaskCreate = {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  opportunity_id?: number | null;
  source: TaskSource;
};

export type StudentTaskCreateResponse = {
  message: string;
  task: StudentTask;
};

export type StudentTasksResponse = {
  user_id: number;
  tasks: StudentTask[];
};

/* ============================================================
   REANALYSIS
   ============================================================ */

export type ReanalyzeTrigger =
  | "profile_edit"
  | "manual";

export type ReanalyzeResponse = {
  user_id: number;
  level: string;
  source: "ai" | "fallback";
  roadmap: RoadmapContent;
  trigger: ReanalyzeTrigger;
  updated_at: string;
};
