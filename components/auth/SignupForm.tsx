"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOtp, verifyOtp, provisionOrganization } from "@/lib/auth/actions";

/**
 * Signup collects the business name up front so it can be handed to
 * provisionOrganization() right after the first OTP verification —
 * organizations/memberships/subscriptions are created together server-side
 * (see lib/auth/actions.ts), never left half-created on the client.
 */
export function SignupForm() {
  const [step, setStep] = useState<"details" | "code">("details");
  const [businessName, setBusinessName] = useState("");
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
      const { error: verifyError } = await verifyOtp(email, code);
      if (verifyError) {
        setError(verifyError);
        return;
      }
      const { error: provisionError } = await provisionOrganization(businessName);
      if (provisionError) {
        setError(provisionError);
        return;
      }
      router.push("/today");
    });
  }

  if (step === "details") {
    return (
      <form onSubmit={handleRequestCode} className="flex w-full max-w-xs flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          事業所名
          <input
            type="text"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-3 text-base"
            placeholder="〇〇保育園"
          />
        </label>
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
          {isPending ? "送信中..." : "無料で始める(14日間トライアル)"}
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
        {isPending ? "確認中..." : "始める"}
      </button>
    </form>
  );
}
