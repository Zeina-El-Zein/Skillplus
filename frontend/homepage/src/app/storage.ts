import type {
  AnalysisResult,
  OpportunityDraftState,
  StudentProfile,
  User,
} from "./types";

const USER_KEY = "skillplus_user";
const PROFILE_KEY = "skillplus_profile";
const RESULT_KEY = "skillplus_analysis";
const OPPORTUNITY_DRAFT_KEY = "skillplus_opportunity_draft";

function readValue<T>(key: string): T | null {
  const value = localStorage.getItem(key);
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function saveUser(user: User) {
  const previousUser = readValue<User>(USER_KEY);
  if (previousUser && previousUser.id !== user.id) {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(RESULT_KEY);
    localStorage.removeItem(OPPORTUNITY_DRAFT_KEY);
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser() {
  return readValue<User>(USER_KEY);
}

export function saveProfile(profile: StudentProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getProfile() {
  return readValue<StudentProfile>(PROFILE_KEY);
}

export function saveAnalysis(result: AnalysisResult) {
  localStorage.setItem(RESULT_KEY, JSON.stringify(result));
}

export function getAnalysis() {
  return readValue<AnalysisResult>(RESULT_KEY);
}

export function saveOpportunityDraft(draft: OpportunityDraftState) {
  localStorage.setItem(OPPORTUNITY_DRAFT_KEY, JSON.stringify(draft));
}

export function getOpportunityDraft() {
  return readValue<OpportunityDraftState>(OPPORTUNITY_DRAFT_KEY);
}

export function clearOpportunityDraft() {
  localStorage.removeItem(OPPORTUNITY_DRAFT_KEY);
}

export function clearSession() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(RESULT_KEY);
  localStorage.removeItem(OPPORTUNITY_DRAFT_KEY);
}
