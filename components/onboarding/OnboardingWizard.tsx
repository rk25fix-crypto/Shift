"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOtp, verifyOtp } from "@/lib/auth/actions";
import { completeOnboarding } from "@/lib/onboarding/actions";
import { INDUSTRY_OPTIONS, INDUSTRY_SHIFT_TYPE_PRESETS, type IndustryKey } from "@/lib/shift-types/presets";

type Step = "industry" | "email" | "code" | "shiftTypes" | "staff";

const PROGRESS_BY_STEP: Record<Step, number> = {
  industry: 8,
  email: 34,
  code: 34,
  shiftTypes: 62,
  staff: 88,
};

const STEP_LABEL: Record<Step, string> = {
  industry: "あと4ステップ",
  email: "あと3ステップ",
  code: "あと3ステップ",
  shiftTypes: "あと2ステップ",
  staff: "あと1ステップ",
};

/**
 * 3ステップ(業種→勤務確認→名前)+完了のオンボーディングウィザード
 * (design_handoff_shift_bright_flow/README.md「1a. はじめての3ステップ」)。
 *
 * メール+OTPは既存の認証アーキテクチャ上どうしても挟む必要があるため
 * (provisionOrganization系はBetter Authセッション必須で、匿名セッション化
 * はしない方針 — README本文が許容している代替案)、業種を選んだ直後に
 * 1画面1問のステップとして差し込んでいる。
 */
export function OnboardingWizard() {
  const [step, setStep] = useState<Step>("industry");
  const [businessName, setBusinessName] = useState("");
  const [industryKey, setIndustryKey] = useState<IndustryKey | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [disabledCodes, setDisabledCodes] = useState<Set<string>>(new Set());
  const [staffNames, setStaffNames] = useState<string[]>([]);
  const [staffInput, setStaffInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSelectIndustry(key: IndustryKey) {
    setIndustryKey(key);
    setDisabledCodes(new Set());
    setStep("email");
  }

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
      else setStep("shiftTypes");
    });
  }

  function toggleShiftType(shiftCode: string) {
    setDisabledCodes((prev) => {
      const next = new Set(prev);
      if (next.has(shiftCode)) next.delete(shiftCode);
      else next.add(shiftCode);
      return next;
    });
  }

  function addStaffName() {
    const name = staffInput.trim();
    if (!name) return;
    setStaffNames((prev) => [...prev, name]);
    setStaffInput("");
  }

  function handleFinish() {
    if (!industryKey) return;
    setError(null);
    startTransition(async () => {
      const { error } = await completeOnboarding({
        businessName,
        industryKey,
        disabledShiftTypeCodes: Array.from(disabledCodes),
        staffNames,
      });
      if (error) {
        setError(error);
        return;
      }
      router.replace("/today");
    });
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <div>
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--color-border-subtle)" }}>
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${PROGRESS_BY_STEP[step]}%`, background: "var(--color-primary)" }}
          />
        </div>
        <p className="mt-1 text-[11px] font-bold text-ink-weakest">{STEP_LABEL[step]}</p>
      </div>

      {step === "industry" && (
        <div className="flex flex-col gap-3">
          <h2 className="text-center text-xl font-bold font-heading text-ink">業種をえらぶ</h2>
          <label className="flex flex-col gap-1 text-sm text-ink">
            事業所名
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="rounded-lg border border-border px-4 py-3 text-base"
              placeholder="〇〇保育園"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            {INDUSTRY_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                disabled={!businessName.trim()}
                onClick={() => handleSelectIndustry(option.key)}
                className="flex min-h-24 flex-col justify-center gap-1 rounded-[18px] border-2 border-border p-3 text-left disabled:opacity-40"
              >
                <span className="text-sm font-bold font-heading text-ink">{option.label}</span>
                <span className="text-[11px] text-ink-weakest">{option.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "email" && (
        <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
          <h2 className="text-center text-xl font-bold font-heading text-ink">メールアドレス</h2>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-border px-4 py-3 text-base"
            placeholder="you@example.com"
          />
          {error && <p className="text-sm" style={{ color: "var(--color-danger-ink)" }}>{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full px-6 py-3 text-base font-bold font-heading text-white disabled:opacity-50"
            style={{ background: "var(--color-primary)" }}
          >
            {isPending ? "送信中..." : "無料で始める(14日間トライアル)"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
          <h2 className="text-center text-xl font-bold font-heading text-ink">認証コード</h2>
          <p className="text-sm text-ink-weak">{email} に届いた6桁のコードを入力してください</p>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-lg border-2 px-4 py-3 text-center text-2xl tracking-widest"
            style={{ borderColor: error ? "var(--color-danger-ink-strong)" : "var(--color-border)" }}
            placeholder="000000"
          />
          {error && (
            <p className="text-sm" style={{ color: "var(--color-danger-ink)" }}>
              {error}(古いメールに届いたコードを見ている可能性があります)
            </p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full px-6 py-3 text-base font-bold font-heading text-white disabled:opacity-50"
            style={{ background: "var(--color-primary)" }}
          >
            {isPending ? "確認中..." : "次へ"}
          </button>
          {error && (
            <button
              type="button"
              disabled={isPending}
              onClick={requestCode}
              className="text-sm font-bold text-primary-ink"
            >
              新しいコードを送りなおす
            </button>
          )}
        </form>
      )}

      {step === "shiftTypes" && industryKey && (
        <div className="flex flex-col gap-3">
          <h2 className="text-center text-xl font-bold font-heading text-ink">勤務の確認</h2>
          <div className="flex flex-col gap-2">
            {INDUSTRY_SHIFT_TYPE_PRESETS[industryKey].map((p) => {
              const isOn = !disabledCodes.has(p.input.code);
              return (
                <button
                  key={p.input.code}
                  type="button"
                  onClick={() => toggleShiftType(p.input.code)}
                  className="flex items-center justify-between gap-3 rounded-[18px] border-2 px-3 py-2.5"
                  style={
                    isOn
                      ? { borderColor: "var(--color-primary)", background: "var(--color-surface)" }
                      : { borderColor: "var(--color-border)", background: "var(--color-off-bg)" }
                  }
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] text-sm font-bold font-heading"
                      style={{ background: "var(--color-primary-soft)", color: "var(--color-primary-ink)" }}
                    >
                      {p.input.code}
                    </span>
                    <span className="text-sm font-bold text-ink">
                      {p.input.name}({p.input.startTime}〜{p.input.endTime})
                    </span>
                  </span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: isOn ? "var(--color-primary-ink)" : "var(--color-ink-weakest)" }}
                  >
                    {isOn ? "使う" : "使わない"}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setStep("staff")}
            className="rounded-full px-6 py-3 text-base font-bold font-heading text-white"
            style={{ background: "var(--color-primary)" }}
          >
            次へ
          </button>
        </div>
      )}

      {step === "staff" && (
        <div className="flex flex-col gap-3">
          <h2 className="text-center text-xl font-bold font-heading text-ink">名前だけ入力</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={staffInput}
              onChange={(e) => setStaffInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addStaffName();
                }
              }}
              className="flex-1 rounded-lg border border-border px-4 py-3 text-base"
              placeholder="スタッフの名前"
            />
            <button
              type="button"
              onClick={addStaffName}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white"
              style={{ background: "var(--color-lock-bg)" }}
              aria-label="追加"
            >
              ＋
            </button>
          </div>
          {staffNames.length > 0 && (
            <ul className="flex flex-col gap-2">
              {staffNames.map((name, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-[14px] border border-border px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-xs font-bold font-heading"
                      style={{ background: "var(--color-primary-soft)", color: "var(--color-primary-ink)" }}
                    >
                      {name.slice(0, 1)}
                    </span>
                    <span className="text-sm font-medium text-ink">{name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setStaffNames((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-ink-weakest"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-sm" style={{ color: "var(--color-danger-ink)" }}>{error}</p>}
          <button
            type="button"
            disabled={isPending}
            onClick={handleFinish}
            className="rounded-full px-6 py-3 text-base font-bold font-heading text-white disabled:opacity-50"
            style={{ background: "var(--color-primary)" }}
          >
            {isPending ? "組み立てています…" : `${staffNames.length || 0}人でシフトを作る`}
          </button>
        </div>
      )}
    </div>
  );
}
