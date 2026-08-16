import type {
  AnalysisResult,
  AuthResponse,
  InstitutionProfile,
  OpportunityProcessResponse,
  OpportunitySubmission,
  OpportunitySubmissionResponse,
  ProfileResponse,
  RecommendationsResponse,
  RoadmapResponse,
  StudentProfile,
  UserRole,
} from "./types";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("Cannot reach the Skill+ backend. Make sure FastAPI is running.", 0);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = body?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(", ")
      : detail || body?.message || "Something went wrong.";
    throw new ApiError(message, response.status);
  }

  return body as T;
}

export function signup(name: string, email: string, password: string, role: UserRole) {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password, role }),
  });
}

export function login(email: string, password: string) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function requestPasswordReset(email: string) {
  return request<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, newPassword: string) {
  return request<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export function saveStudentProfile(profile: StudentProfile) {
  return request<ProfileResponse>("/student-profile", {
    method: "POST",
    body: JSON.stringify(profile),
  }).catch((error) => {
    if (error instanceof ApiError && [404, 405].includes(error.status)) {
      return request<ProfileResponse>("/student/profile", {
        method: "POST",
        body: JSON.stringify(profile),
      });
    }
    throw error;
  });
}

export async function analyzeStudentProfile(profile: StudentProfile) {
  const result = await request<AnalysisResult & { missing_skills?: string[] }>(
    `/student/analyze/${profile.user_id}`,
    {
      method: "POST",
    }
  );

  return {
    ...result,
    missing: result.missing || result.missing_skills || [],
  };
}

export function getStudentRecommendations(userId: number) {
  return request<RecommendationsResponse>(`/student/${userId}/recommendations`);
}

export function getInstitutionProfile(userId: number) {
  return request<InstitutionProfile>(`/institution/${userId}`);
}

export function saveInstitutionProfile(
  profile: Omit<InstitutionProfile, "id">,
) {
  return request<{ message: string; institution_id: number }>("/institution-profile", {
    method: "POST",
    body: JSON.stringify(profile),
  });
}

export function processOpportunityDescription(userId: number, description: string) {
  return request<OpportunityProcessResponse>("/institution/opportunities/process", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, description }),
  });
}

export function submitInstitutionOpportunity(opportunity: OpportunitySubmission) {
  return request<OpportunitySubmissionResponse>("/institution/opportunities", {
    method: "POST",
    body: JSON.stringify(opportunity),
  });
}

export function getStudentRoadmap(userId: number) {
  return request<RoadmapResponse>(`/student/${userId}/roadmap`);
}

export function generateStudentRoadmap(userId: number) {
  return request<RoadmapResponse>(`/student/${userId}/roadmap`, {
    method: "POST",
  });
}
