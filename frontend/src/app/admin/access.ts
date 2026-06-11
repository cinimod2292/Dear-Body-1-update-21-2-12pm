export function canAccessAdminPath(role: string, pathname: string): boolean {
  if (role !== "PICKER_PACKER") return true;
  return pathname === "/admin/warehouse" || pathname.startsWith("/admin/warehouse/");
}
