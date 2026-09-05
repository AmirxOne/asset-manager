import type { AppIcon } from "@/components/ui/icon";
import {
  LayoutDashboard,
  Layers,
  Users,
  Building2,
  MapPin,
  Wrench,
  ScrollText,
  BarChart3,
  Settings,
  ShieldCheck,
  DoorOpen,
  UserRound,
  UsersRound,
  Briefcase,
} from "@/components/ui/icon";

export type NavGroupId = "main" | "org" | "system";

export type NavItemDef = {
  href: string;
  label: string;
  icon: AppIcon;
  perm: string | null;
  group: NavGroupId;
};

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: "main", label: "اصلی" },
  { id: "org", label: "سازمان" },
  { id: "system", label: "سامانه" },
];

export const NAV: NavItemDef[] = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard, perm: null, group: "main" },
  { href: "/assets", label: "دارایی‌ها", icon: Layers, perm: "asset:view", group: "main" },
  { href: "/warehouse", label: "انبار", icon: DoorOpen, perm: "asset:view", group: "main" },
  { href: "/audits", label: "ممیزی", icon: ShieldCheck, perm: "audit:view", group: "main" },
  { href: "/my-assets", label: "دارایی‌های من", icon: UserRound, perm: null, group: "main" },
  { href: "/employees", label: "کارمندان", icon: Users, perm: "employee:manage", group: "org" },
  { href: "/departments", label: "بخش‌ها", icon: Building2, perm: "department:manage", group: "org" },
  { href: "/locations", label: "محل‌ها", icon: MapPin, perm: "location:manage", group: "org" },
  { href: "/suppliers", label: "تأمین‌کنندگان", icon: Briefcase, perm: "supplier:manage", group: "org" },
  { href: "/requests", label: "درخواست‌ها", icon: ScrollText, perm: null, group: "org" },
  { href: "/maintenance", label: "تعمیرات", icon: Wrench, perm: "maintenance:view", group: "system" },
  { href: "/reports", label: "گزارش‌ها", icon: BarChart3, perm: "report:view", group: "system" },
  { href: "/admin/users", label: "کاربران", icon: UsersRound, perm: "user:manage", group: "system" },
  { href: "/admin/roles", label: "نقش‌ها", icon: UsersRound, perm: "role:manage", group: "system" },
  { href: "/admin/audit-logs", label: "لاگ ممیزی", icon: ScrollText, perm: "audit-log:view", group: "system" },
  { href: "/admin/settings", label: "تنظیمات", icon: Settings, perm: "settings:manage", group: "system" },
];

export function groupedVisibleNav(
  can: (perm: string | null) => boolean,
): { id: NavGroupId; label: string; items: NavItemDef[] }[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: NAV.filter((n) => n.group === g.id && can(n.perm)),
  })).filter((g) => g.items.length > 0);
}

export function isNavActive(pathname: string, href: string, siblingHrefs: string[]): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  const conflicts = siblingHrefs.filter(
    (h) => h !== href && (pathname.startsWith(h + "/") || pathname === h),
  );
  if (conflicts.length > 0) return false;
  return pathname === href || pathname.startsWith(href + "/");
}
