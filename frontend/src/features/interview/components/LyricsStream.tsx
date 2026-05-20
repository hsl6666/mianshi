import { motion, AnimatePresence } from "framer-motion";
import type { OralMessage } from "../types";

type LyricsStreamProps = {
  title: string;
  speaker: "user" | "assistant";
  messages: OralMessage[];
};

export function LyricsStream({ title, speaker, messages }: LyricsStreamProps) {
  const stream = messages.filter((item) => item.speaker === speaker).slice(-6);

  return (
    <section className="flex min-h-[360px] flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between border-b border-stone-100 pb-3">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        <span className="text-xs text-stone-400">{stream.length} 条</span>
      </div>
      <div className="relative flex flex-1 flex-col justify-end overflow-hidden">
        <AnimatePresence initial={false}>
          {stream.map((item, index) => {
            const opacity = 0.35 + ((index + 1) / Math.max(stream.length, 1)) * 0.65;
            return (
              <motion.p
                key={item.id}
                layout
                initial={{ y: 26, opacity: 0 }}
                animate={{ y: 0, opacity }}
                exit={{ y: -28, opacity: 0 }}
                transition={{ duration: 0.36, ease: "easeOut" }}
                className={[
                  "mb-3 rounded-lg px-4 py-3 text-sm leading-6 shadow-sm",
                  speaker === "assistant" ? "bg-emerald-950 text-emerald-50" : "bg-stone-100 text-stone-800",
                ].join(" ")}
              >
                {item.text}
              </motion.p>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
