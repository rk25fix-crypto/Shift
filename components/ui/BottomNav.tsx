"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const TABS = [
  { href: "/today", label: "今日" },
  { href: "/staff", label: "スタッフ" },
  { href: "/week", label: "週表示" },
  { href: "/swaps", label: "交代" },
  { href: "/settings/organization", label: "設定" },
] as const;

/**
 * Bottom tab bar, not a top nav — iOS thumb-reachability convention, and
 * the primary navigation for a manager operating one-handed on a phone.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-10 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]"
      aria-label="メインナビゲーション"
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium",
              isActive ? "text-indigo-600" : "text-gray-500",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
