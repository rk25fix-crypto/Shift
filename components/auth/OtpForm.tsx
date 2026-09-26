"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOtp, verifyOtp } from "@/lib/auth/actions";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";

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

  function requestCode() {
    setError(null);
    startTransition(async () => {
      const { error } = await requestOtp(email);
      if (error) setError(error);
      else setStep("code");
    });
  }

  function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    requestCode();
  }

  function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const { error } = await verifyOtp(email, code);
      if (error) setError(error);
      // replace, not push: /login must not stay in history so Back can't
      // restore the cached pre-login "email" step (see OnboardingWizard's
      // equivalent for /signup's fuller rationale).
      else router.replace(redirectTo);
    });
  }

  if (step === "email") {
    return (
      <form onSubmit={handleRequestCode} className="flex w-full max-w-xs flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-ink">
          メールアドレス
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-border px-4 py-3 text-base"
            placeholder="you@example.com"
          />
        </label>
        {error && (
          <p className="text-sm" style={{ color: "var(--color-danger-ink)" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full px-6 py-3 text-base font-bold font-heading text-white disabled:opacity-50"
          style={{ background: "var(--color-primary)" }}
        >
          {isPending ? "送信中..." : "コードを送る"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode} className="flex w-full max-w-xs flex-col gap-4">
      <p className="text-sm text-ink-weak">{email} に届いた6桁のコードを入力してください</p>
      <OtpCodeInput value={code} onChange={setCode} hasError={!!error} disabled={isPending} />
      {error && (
        <p className="text-sm" style={{ color: "var(--color-danger-ink)" }}>
          {error}(古いメールに届いたコードを見ている可能性があります)
        </p>
      )}
      {error ? (
        <button
          type="button"
          disabled={isPending}
          onClick={requestCode}
          className="rounded-full px-6 py-3 text-base font-bold font-heading text-white disabled:opacity-50"
          style={{ background: "var(--color-primary)" }}
        >
          {isPending ? "送信中..." : "新しいコードを送りなおす"}
        </button>
      ) : (
        <button
          type="submit"
          disabled={isPending || code.length < 6}
          className="rounded-full px-6 py-3 text-base font-bold font-heading text-white disabled:opacity-50"
          style={{ background: "var(--color-primary)" }}
        >
          {isPending ? "確認中..." : submitLabel}
        </button>
      )}
    </form>
  );
}
