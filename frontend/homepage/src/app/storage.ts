import type { AnalysisResult, StudentProfile, User } from "./types";

const USER_KEY = "skillplus_user";
const PROFILE_KEY = "skillplus_profile";
const RESULT_KEY = "skillplus_analysis";

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

export function clearSession() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(RESULT_KEY);
}
