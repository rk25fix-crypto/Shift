import { ShiftTypeForm } from "@/components/shift-types/ShiftTypeForm";

export default function NewShiftTypePage() {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="px-4 pt-6 text-xl font-bold">シフト種別を追加</h1>
      <ShiftTypeForm />
    </div>
  );
}
