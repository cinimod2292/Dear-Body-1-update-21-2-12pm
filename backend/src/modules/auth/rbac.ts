import { StaffRole } from "@prisma/client";

export const rolePermissions: Record<StaffRole, string[]> = {
  SUPER_ADMIN: ["*"],
  STORE_MANAGER: [
    "dashboard:read",
    "settings:read",
    "settings:write",
    "media:read",
    "media:write",
    "catalog:read",
    "catalog:write",
    "inventory:read",
    "inventory:write",
    "crm:read",
    "crm:write",
    "audit:read",
  ],
  CONTENT_EDITOR: ["dashboard:read", "media:read", "media:write", "settings:read", "catalog:read"],
  SUPPORT_AGENT: ["dashboard:read", "audit:read", "settings:read", "inventory:read", "crm:read", "crm:write"],
  ANALYST: ["dashboard:read", "audit:read", "crm:read"],
};

export function getPermissionsForRole(role: StaffRole): string[] {
  return rolePermissions[role] ?? [];
}

export function hasPermission(role: StaffRole, permission: string): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes("*") || permissions.includes(permission);
}
