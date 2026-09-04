import { OtpForm } from "@/components/auth/OtpForm";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <h1 className="text-2xl font-bold">ログイン</h1>
      <OtpForm redirectTo="/today" submitLabel="ログイン" />
    </main>
  );
}
