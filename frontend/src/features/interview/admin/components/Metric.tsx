import type { ReactNode } from "react";
import { Progress } from "antd";

export function Metric({ label, value, icon, danger }: { label: string; value: number; icon: ReactNode; danger?: boolean }) {
  return (
    <div className={`rounded-lg p-5 ${danger ? "bg-rose-950 text-white" : "bg-stone-950 text-white"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xl">{icon}</span>
        <span className="text-xs uppercase tracking-[0.2em] opacity-70">{label}</span>
      </div>
      <div className="mt-5 text-3xl font-semibold">{value}</div>
    </div>
  );
}

export function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-stone-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-stone-600">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <Progress percent={value} showInfo={false} strokeColor="#14532d" />
    </div>
  );
}
