"use client";

import { useState } from "react";
import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";

/**
 * Shown instead of the signup form when the visitor already has a session
 * (e.g. an old /signup bookmark or a stray link). Requires an explicit tap
 * before the form appears, so a plain revisit can never silently create a
 * second, empty organization — while deliberately adding another business
 * (a real case: see the org switcher, components/settings/OrgSwitcher.tsx)
 * stays one tap away instead of being blocked outright.
 */
export function SignupGate() {
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) return <SignupForm />;

  return (
    <div className="flex w-full max-w-xs flex-col gap-4 text-center">
      <p className="text-sm text-gray-600">すでにログイン中です。</p>
      <Link
        href="/today"
        className="rounded-full bg-indigo-600 px-6 py-3 text-base font-medium text-white"
      >
        アプリに戻る
      </Link>
      <button
        type="button"
        onClick={() => setConfirmed(true)}
        className="text-sm text-gray-500 underline"
      >
        別の事業所を新しく追加する
      </button>
    </div>
  );
}
