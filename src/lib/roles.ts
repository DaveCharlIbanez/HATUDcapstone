/**
 * Where each role belongs in the app.
 *
 * The mapping used to be copied into four files. They drifted apart, and a
 * signed-in user could end up on a page that only exists for another role.
 */

export type UserRole = "admin" | "commuter" | "operator";

export const ROLE_HOME: Record<UserRole, string> = {
  admin: "/dashboard",
  operator: "/dashboard",
  commuter: "/dashboard",
};

/** The dashboard a role lands on after signing in. */
export function homeForRole(role: string): string {
  return ROLE_HOME[role as UserRole] ?? ROLE_HOME.commuter;
}
