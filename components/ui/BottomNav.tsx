"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Users, Settings } from "lucide-react";

const TABS = [
  { href: "/today", label: "ホーム", icon: House },
  { href: "/staff", label: "スタッフ", icon: Users },
  { href: "/settings/organization", label: "設定", icon: Settings },
] as const;

/**
 * Bottom tab bar, not a top nav — iOS thumb-reachability convention, and
 * the primary navigation for a manager operating one-handed on a phone.
 * 3 tabs only (design handoff 1b) — 週表示/交代 are reached from ホーム/設定
 * instead of getting their own tab.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label="メインナビゲーション"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-bold"
            style={{ color: isActive ? "var(--color-primary-ink)" : "var(--color-ink-weakest)" }}
          >
            <Icon size={22} color={isActive ? "var(--color-primary)" : "var(--color-ink-weakest)"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
