import type { OpportunityCategory, OpportunityDifficulty, SuitableMajor } from "./types";

export const OPPORTUNITY_CATEGORIES: OpportunityCategory[] = [
  "Internship",
  "Project",
  "Workshop",
  "Bootcamp",
  "Hackathon",
  "Competition",
  "Mentorship",
  "Research",
];

export const OPPORTUNITY_DIFFICULTIES: OpportunityDifficulty[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
];

export const PROFILE_MAJORS = [
  "Computer and Communications Engineering",
  "Computer Science",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Industrial Engineering",
  "Chemical Engineering",
  "Other",
] as const;

export const SUITABLE_MAJORS: SuitableMajor[] = [...PROFILE_MAJORS, "Any"];

export function textToList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function listToText(values: string[] | null | undefined) {
  return (values || []).join(", ");
}
