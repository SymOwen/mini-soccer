"use client";

import { useState, type FormEvent } from "react";

interface Props {
  onStart: (names: string[]) => void;
}

export default function NameInput({ onStart }: Props) {
  const [raw, setRaw] = useState("");

  function parse(text: string): string[] {
    return text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const names = parse(raw);
    if (names.length < 2) return;
    onStart(names);
  }

  const names = parse(raw);
  const valid = names.length >= 2;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-md">
      <label className="text-slate-300 text-sm font-medium">
        Team members{" "}
        <span className="text-slate-500">(comma or line separated, min 2)</span>
      </label>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={"Alice\nBob\nCarol\nDave"}
        rows={5}
        className="w-full rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 px-4 py-3 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 resize-none"
      />
      {names.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {names.map((n) => (
            <span
              key={n}
              className="px-2 py-1 rounded-md bg-slate-700 text-slate-300 text-xs font-medium"
            >
              {n}
            </span>
          ))}
        </div>
      )}
      <button
        type="submit"
        disabled={!valid}
        className="px-6 py-3 bg-green-500 hover:bg-green-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed active:scale-95 text-white font-bold rounded-xl shadow-lg transition-all"
      >
        Set Up Team →
      </button>
    </form>
  );
}
