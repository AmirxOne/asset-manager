"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Search, LogOut, Menu, X, Plus, ChevronDown, UserCircle, Layers,
} from "@/components/ui/icon";
import { cn } from "@/lib";
import { groupedVisibleNav, isNavActive } from "@/lib/nav";
import { useAuth } from "@/lib/auth-store";
import { UserAvatar } from "@/components/ui/user-avatar";

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-xl bg-ink text-white"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Layers className="h-5 w-5" />
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loaded, refresh, logout, can } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => {
    if (!loaded) refresh();
  }, [loaded, refresh]);

  useEffect(() => {
    if (loaded && !me) router.replace("/login");
  }, [loaded, me, router]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (!loaded || !me) {
    return (
      <div className="flex min-h-screen flex-col bg-white lg:pr-60">
        <aside className="fixed top-0 right-0 hidden h-screen w-60 flex-col border-l border-line bg-paper-soft lg:flex">
          <div className="flex h-16 items-center gap-2.5 border-b border-line px-4">
            <div className="skeleton h-9 w-9 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="skeleton h-3.5 w-24" />
              <div className="skeleton h-2.5 w-32" />
            </div>
          </div>
          <div className="space-y-4 p-3">
            {[4, 4, 2].map((count, g) => (
              <div key={g} className="space-y-1">
                <div className="skeleton mx-2 h-2 w-8" />
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} className="skeleton h-9 w-full rounded-lg" />
                ))}
              </div>
            ))}
          </div>
        </aside>
        <div className="flex flex-1 flex-col">
          <header className="flex h-16 items-center gap-3 border-b border-line px-4 lg:px-6">
            <div className="skeleton h-10 w-full max-w-xl rounded-md" />
            <div className="skeleton mr-auto h-8 w-8 rounded-full" />
          </header>
          <main className="flex flex-1 items-center justify-center p-6">
            <div className="flex flex-col items-center gap-3">
              <div className="skeleton h-12 w-12 rounded-xl" />
              <div className="skeleton h-3 w-28" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  const navGroups = groupedVisibleNav((perm) => (perm === null ? true : can(perm)));
  const siblingHrefs = navGroups.flatMap((g) => g.items.map((item) => item.href));

  const sidebar = (
    <>
      <Link
        href="/dashboard"
        className="flex h-16 items-center gap-2.5 border-b border-line px-4 transition-colors hover:bg-white/50"
      >
        <BrandMark />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold leading-4">مدیریت دارایی</p>
          <p className="truncate text-[10px] text-ink-faint">سامانه اموال سازمانی</p>
        </div>
      </Link>
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {navGroups.map((group) => (
          <div key={group.id} className="mb-4 last:mb-0">
            <p className="mb-1 px-2 text-[10px] font-medium text-ink-faint">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isNavActive(pathname, item.href, siblingHrefs)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-2.5">
        <Link
          href="/assets/new"
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-ink text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a2a2e] active:bg-black"
        >
          <Plus className="h-4 w-4" />
          ثبت دارایی جدید
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-white lg:pr-60">
      {/* Desktop sidebar */}
      <aside className="fixed top-0 right-0 z-50 hidden h-screen w-60 flex-col border-l border-line bg-paper-soft lg:flex">
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:px-6 [transform:translateZ(0)]">
          <button
            className="rounded-md p-2 hover:bg-paper-soft lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="منو"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative w-full max-w-xl">
            <div className="flex h-10 items-center gap-2 rounded-md bg-paper-soft px-3">
              <Search className="h-4 w-4 text-ink-faint" />
              <input
                placeholder="جستجوی دارایی، کارمند…"
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const q = (e.target as HTMLInputElement).value.trim();
                    if (q) router.push(`/assets?q=${encodeURIComponent(q)}`);
                  }
                }}
              />
            </div>
          </div>

          <div className="mr-auto flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setUserMenu((v) => !v)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-paper-soft"
              >
                <UserAvatar name={me.fullName} src={me.avatarUrl} size="sm" variant="ink" />
                <div className="hidden text-right sm:block">
                  <p className="text-[13px] font-medium leading-4">{me.fullName}</p>
                  <p className="text-[10px] text-ink-faint">{me.roles[0]?.name ?? ""}</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 self-center text-ink-faint" />
              </button>
              {userMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} />
                  <div dir="rtl" className="absolute left-0 z-20 mt-2 w-52 rounded-md border border-line bg-white p-1.5 shadow-lg">
                    <div className="border-b border-line px-3 py-2">
                      <p className="text-[12px] font-medium">{me.fullName}</p>
                      <p className="text-[11px] text-ink-faint" dir="ltr">{me.email}</p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setUserMenu(false)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-ink hover:bg-paper-soft"
                    >
                      <UserCircle className="h-4 w-4" />
                      پروفایل من
                    </Link>
                    <button
                      onClick={logout}
                      className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      خروج از حساب
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 pb-20 lg:pb-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-72 flex-col bg-paper-soft shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <BrandMark size={32} />
                <p className="truncate text-[14px] font-bold">مدیریت دارایی</p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="بستن"
                className="rounded-md p-1.5 text-ink-soft hover:bg-white hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarNavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-white text-ink shadow-[0_1px_2px_rgba(13,13,13,0.06)]"
          : "text-ink-soft hover:bg-white/70 hover:text-ink",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
          active ? "bg-ink text-white" : "text-ink-faint group-hover:text-ink-soft",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}
