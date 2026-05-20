import type { PropsWithChildren } from "react";
import { Input } from "antd";

type FormSectionProps = PropsWithChildren<{
  title: string;
  description?: string;
}>;

type FieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
};

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-stone-950">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-stone-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, value, placeholder, error, onChange }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-stone-700">{label}</span>
      <Input value={value} placeholder={placeholder} status={error ? "error" : undefined} onChange={(event) => onChange(event.target.value)} />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
