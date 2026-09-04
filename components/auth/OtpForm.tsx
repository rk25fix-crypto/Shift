"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOtp, verifyOtp } from "@/lib/auth/actions";

interface OtpFormProps {
  /** Where to send the user after a successful login. */
  redirectTo: string;
  submitLabel: string;
}

/**
 * Two-step "email → 6-digit code" login, entered without ever leaving the
 * installed PWA (see docs/plan.md "認証方式" for why a magic-link email
 * would instead open Safari and leave the PWA logged out).
 */
export function OtpForm({ redirectTo, submitLabel }: OtpFormProps) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const { error } = await requestOtp(email);
      if (error) setError(error);
      else setStep("code");
    });
  }

  function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const { error } = await verifyOtp(email, code);
      if (error) setError(error);
      else router.push(redirectTo);
    });
  }

  if (step === "email") {
    return (
      <form onSubmit={handleRequestCode} className="flex w-full max-w-xs flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          メールアドレス
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-3 text-base"
            placeholder="you@example.com"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-indigo-600 px-6 py-3 text-base font-medium text-white disabled:opacity-50"
        >
          {isPending ? "送信中..." : "コードを送る"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode} className="flex w-full max-w-xs flex-col gap-4">
      <p className="text-sm text-gray-600">{email} に届いた6桁のコードを入力してください</p>
      <label className="flex flex-col gap-1 text-sm">
        認証コード
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl tracking-widest"
          placeholder="000000"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-indigo-600 px-6 py-3 text-base font-medium text-white disabled:opacity-50"
      >
        {isPending ? "確認中..." : submitLabel}
      </button>
    </form>
  );
}
