import type { User } from "./types";

export function authenticatedHome(user: User) {
  if (user.role === "institution") return "/institution/dashboard";
  return user.has_profile ? "/recommendations" : "/profile";
}
