export type AuthenticationState = "authenticated" | "unauthenticated" | "unknown";

export type SessionIdentity = {
  userId: string;
  authenticatedAt: string;
};

export type BusinessMembership = {
  userId: string;
  businessId: string;
  role: "owner" | "admin" | "member" | "viewer";
};

export type AuthorizationRequest = {
  userId?: string;
  businessId?: string;
  requiredRoles?: BusinessMembership["role"][];
};

export type AuthorizationResult =
  | { state: "allowed"; reason: string }
  | { state: "blocked"; reason: string };

const roleRank: Record<BusinessMembership["role"], number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

export function requireAuthenticated(
  state: AuthenticationState,
  identity?: SessionIdentity,
): AuthorizationResult {
  if (state !== "authenticated" || !identity?.userId) {
    return { state: "blocked", reason: "Authentication has not been established." };
  }
  return { state: "allowed", reason: "Authenticated identity is established." };
}

export function authorizeBusinessMembership(
  request: AuthorizationRequest,
  memberships: BusinessMembership[],
): AuthorizationResult {
  if (!request.userId || !request.businessId) {
    return { state: "blocked", reason: "User and business scope are required." };
  }
  const membership = memberships.find(
    item => item.userId === request.userId && item.businessId === request.businessId,
  );
  if (!membership) {
    return { state: "blocked", reason: "User has no established membership in this business." };
  }
  if (request.requiredRoles?.length) {
    const allowed = request.requiredRoles.some(role => roleRank[membership.role] >= roleRank[role]);
    if (!allowed) {
      return { state: "blocked", reason: "Business membership role is insufficient for this operation." };
    }
  }
  return { state: "allowed", reason: "Business membership authorizes the requested scope." };
}
