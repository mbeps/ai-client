/**
 * Global system roles for the Better Auth admin plugin.
 */
export const GLOBAL_ROLES = {
  ADMIN: "admin",
  USER: "user",
} as const;

/**
 * Organization-specific roles for the Better Auth organization plugin.
 */
export const ORG_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
} as const;

/**
 * Valid statuses for organization invitations.
 */
export const INVITATION_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  CANCELED: "canceled",
} as const;
