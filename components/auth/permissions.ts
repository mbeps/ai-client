import { createAccessControl } from "better-auth/plugins/access"
import {
  defaultStatements,
  userAc,
  adminAc,
} from "better-auth/plugins/admin/access"

/**
 * Access control instance shared across admin-aware plugins.
 */
export const ac = createAccessControl(defaultStatements)

/**
 * Default user role extended with the ability to list users.
 */
export const user = ac.newRole({
  ...userAc.statements,
  user: [...userAc.statements.user, "list"],
})

/**
 * Admin role with full CRUD permissions inherited from Better Auth.
 */
export const admin = ac.newRole(adminAc.statements)
