export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
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
