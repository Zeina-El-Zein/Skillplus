import type {
  AnalysisResult,
  AuthResponse,
  InstitutionLogoUploadResponse,
  InstitutionProfile,
  OpportunityProcessResponse,
  OpportunitySubmission,
  OpportunitySubmissionResponse,
  ProfilePictureUploadResponse,
  ProfileResponse,
  RecommendationsResponse,
  RoadmapResponse,
  StudentProfile,
  StudentProfileResponse,
  UserRole,
  StudentTaskCreate,
  StudentTaskCreateResponse,
  StudentTasksResponse,
  TaskPriority,
  TaskStatus,
  ReanalyzeResponse,
  ReanalyzeTrigger,
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
  const headers = new Headers(options.headers);

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
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

export function getStudentProfile(userId: number) {
  return request<StudentProfileResponse>(`/student/profile/${userId}`);
}

export function uploadStudentProfilePicture(userId: number, file: File) {
  const body = new FormData();
  body.append("file", file);

  return request<ProfilePictureUploadResponse>(`/student/${userId}/profile-picture`, {
    method: "POST",
    body,
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
  profile: Omit<InstitutionProfile, "id" | "logo_url">,
) {
  return request<{ message: string; institution_id: number }>("/institution-profile", {
    method: "POST",
    body: JSON.stringify(profile),
  });
}

export function uploadInstitutionLogo(userId: number, file: File) {
  const body = new FormData();
  body.append("file", file);

  return request<InstitutionLogoUploadResponse>(`/institution/${userId}/logo`, {
    method: "POST",
    body,
  });
}

export function resolveApiAssetUrl(path: string | null | undefined) {
  if (!path) return null;

  try {
    const url = new URL(path, `${API_URL}/`);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
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

export function createStudentTask(
  userId: number,
  task: StudentTaskCreate,
) {
  return request<StudentTaskCreateResponse>(
    `/student/${userId}/tasks`,
    {
      method: "POST",
      body: JSON.stringify(task),
    },
  );
}

export function getStudentTasks(
  userId: number,
  taskStatus?: TaskStatus,
) {
  const query = taskStatus
    ? `?task_status=${taskStatus}`
    : "";

  return request<StudentTasksResponse>(
    `/student/${userId}/tasks${query}`,
  );
}

export function updateStudentTaskStatus(
  userId: number,
  taskId: number,
  status: TaskStatus,
) {
  return request<StudentTaskCreateResponse>(
    `/student/${userId}/tasks/${taskId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

export function updateStudentTaskPriority(
  userId: number,
  taskId: number,
  priority: TaskPriority,
) {
  return request<StudentTaskCreateResponse>(
    `/student/${userId}/tasks/${taskId}/priority`,
    {
      method: "PATCH",
      body: JSON.stringify({ priority }),
    },
  );
}

export function deleteStudentTask(
  userId: number,
  taskId: number,
) {
  return request<{ message: string }>(
    `/student/${userId}/tasks/${taskId}`,
    {
      method: "DELETE",
    },
  );
}

export function reanalyzeStudent(
  userId: number,
  trigger: ReanalyzeTrigger = "manual",
) {
  return request<ReanalyzeResponse>(
    `/student/${userId}/reanalyze`,
    {
      method: "POST",
      body: JSON.stringify({ trigger }),
    },
  );
}