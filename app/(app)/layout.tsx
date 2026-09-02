import { BottomNav } from "@/components/ui/BottomNav";
import { InstallPromptBanner } from "@/components/ui/InstallPromptBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex flex-1 flex-col overflow-y-auto pb-4">{children}</div>
      <InstallPromptBanner />
      <BottomNav />
    </div>
  );
}
