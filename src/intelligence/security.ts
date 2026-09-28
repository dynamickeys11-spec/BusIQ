export type SecuritySubject = {
  userId?: string;
  businessId?: string;
};

export type AccessMode = "read" | "write";
export type DataSensitivity = "public" | "internal" | "confidential" | "sensitive";

export type SecurityResource = {
  id: string;
  businessId?: string;
  sensitivity: DataSensitivity;
};

export type SecurityDecision =
  | { state: "allowed"; reason: string }
  | { state: "blocked"; reason: string };

export type ToolPermission = {
  toolId: string;
  modes: AccessMode[];
  allowedBusinessIds: string[];
  sensitiveDataAllowed: boolean;
};

export type SecurityPolicy = {
  subject: SecuritySubject;
  permissions: ToolPermission[];
  allowLocalData: boolean;
};

export function checkBusinessIsolation(
  subject: SecuritySubject,
  resource: SecurityResource,
): SecurityDecision {
  if (!resource.businessId) return { state: "allowed", reason: "Resource has no business scope." };
  if (!subject.businessId) return { state: "blocked", reason: "Business scope is required before accessing business data." };
  if (subject.businessId !== resource.businessId) {
    return { state: "blocked", reason: "Business scope does not match the requested resource." };
  }
  return { state: "allowed", reason: "Business scope matches." };
}

export function checkResourceSensitivity(
  permission: ToolPermission,
  resource: SecurityResource,
  mode: AccessMode,
): SecurityDecision {
  if (!permission.modes.includes(mode)) {
    return { state: "blocked", reason: `Tool permission does not allow ${mode} access.` };
  }
  if (resource.sensitivity === "sensitive" && !permission.sensitiveDataAllowed) {
    return { state: "blocked", reason: "Sensitive data access is not authorized." };
  }
  if (resource.businessId && !permission.allowedBusinessIds.includes(resource.businessId)) {
    return { state: "blocked", reason: "Tool permission does not include this business." };
  }
  return { state: "allowed", reason: "Resource access is permitted by the supplied policy." };
}

export function authorizeResource(
  policy: SecurityPolicy,
  resource: SecurityResource,
  mode: AccessMode,
  permission?: ToolPermission,
): SecurityDecision {
  const isolation = checkBusinessIsolation(policy.subject, resource);
  if (isolation.state === "blocked") return isolation;
  if (!policy.allowLocalData && !resource.businessId) {
    return { state: "blocked", reason: "Local data access is disabled by policy." };
  }
  if (!permission) {
    return { state: "blocked", reason: "No tool permission was supplied for this resource." };
  }
  return checkResourceSensitivity(permission, resource, mode);
}

export type TruthfulnessClaim =
  | { kind: "access"; resource: string; hasAccess: boolean }
  | { kind: "action"; actionId: string; executed: boolean }
  | { kind: "evidence"; evidenceId: string; verified: boolean };

export function validateTruthfulnessClaim(claim: TruthfulnessClaim): SecurityDecision {
  if (!claim.hasAccess && claim.kind === "access") {
    return { state: "blocked", reason: `BUSIQ cannot claim access to ${claim.resource} because access was not established.` };
  }
  if (claim.kind === "action" && !claim.executed) {
    return { state: "blocked", reason: `BUSIQ cannot claim action ${claim.actionId} was executed.` };
  }
  if (claim.kind === "evidence" && !claim.verified) {
    return { state: "blocked", reason: `BUSIQ cannot present evidence ${claim.evidenceId} as verified.` };
  }
  return { state: "allowed", reason: "Claim is supported by the supplied execution state." };
}

export function createLocalSecurityPolicy(subject: SecuritySubject): SecurityPolicy {
  return {
    subject,
    permissions: [],
    allowLocalData: true,
  };
}
