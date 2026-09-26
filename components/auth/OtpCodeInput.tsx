"use client";

import { useRef } from "react";

interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  /** All six boxes turn red together — a per-box "which digit was wrong" signal doesn't exist for an OTP. */
  hasError?: boolean;
  disabled?: boolean;
}

const LENGTH = 6;

/** 6-box, one-digit-per-cell OTP input; every box goes red together on error (design handoff 3a). */
export function OtpCodeInput({ value, onChange, hasError, disabled }: OtpCodeInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(index: number, digit: string) {
    const digits = value.padEnd(LENGTH, " ").split("");
    digits[index] = digit || " ";
    const next = digits.join("").replace(/ /g, "").slice(0, LENGTH);
    onChange(next);
    if (digit && index < LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    inputRefs.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="認証コード">
      {Array.from({ length: LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ""}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, "").slice(-1))}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          aria-label={`認証コード ${i + 1}桁目`}
          className="h-12 w-10 rounded-lg border-2 text-center text-xl font-bold text-ink"
          style={{ borderColor: hasError ? "var(--color-danger-ink-strong)" : "var(--color-border)" }}
        />
      ))}
    </div>
  );
}
