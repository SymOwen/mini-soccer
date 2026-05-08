"use client";

import { useEffect, useRef, useState } from "react";
import SoccerGame from "@/components/SoccerGame";

const PARAM = "p";

function parseNames(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function Home() {
  const [names, setNames] = useState<string[]>([]);
  const [editValue, setEditValue] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Read ?p= from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get(PARAM);
    if (p) {
      const parsed = parseNames(p);
      if (parsed.length >= 2) {
        setNames(parsed);
        setEditValue(parsed.join(", "));
        return;
      }
    }
    // No URL params — show editor immediately
    setShowEdit(true);
  }, []);

  // Focus input when editor opens
  useEffect(() => {
    if (showEdit) inputRef.current?.focus();
  }, [showEdit]);

  function applyNames(raw: string) {
    const parsed = parseNames(raw);
    if (parsed.length < 2) return;
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM, parsed.join(","));
    window.history.pushState({}, "", url.toString());
    setNames(parsed);
    setEditValue(parsed.join(", "));
    setShowEdit(false);
  }

  function copyUrl() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const parsed = parseNames(editValue);
  const valid = parsed.length >= 2;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10 gap-6">

      {/* Header */}
      <div className="text-center">
        <h1
          className="text-5xl font-black tracking-tight"
          style={{ textShadow: "0 0 40px rgba(74,222,128,0.4), 0 2px 0 #000", background: "linear-gradient(135deg,#ffffff 30%,#86efac)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
        >
          ⚽ Standup Picker
        </h1>
        <p className="text-slate-300 mt-2 text-sm font-medium">Who runs standup today? Let the beautiful game decide.</p>
      </div>

      {/* Team editor */}
      <div className="w-full max-w-7xl">
        {showEdit ? (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-600 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 text-sm font-medium">
                Player names <span className="text-slate-500">(comma-separated)</span>
              </label>
              {names.length > 0 && (
                <button onClick={() => setShowEdit(false)} className="text-slate-500 hover:text-slate-300 text-xs">
                  Cancel
                </button>
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyNames(editValue)}
              placeholder="Alice, Bob, Carol, Dave, Eve"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
            {/* Preview chips */}
            {parsed.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {parsed.map((n) => (
                  <span key={n} className="px-2 py-0.5 rounded-md bg-slate-700 text-slate-300 text-xs font-medium border border-slate-600">
                    {n}
                  </span>
                ))}
              </div>
            )}
            <p className="text-slate-500 text-xs">
              Bookmark the URL to save your team — no account needed.
            </p>
            <button
              onClick={() => applyNames(editValue)}
              disabled={!valid}
              className="self-start px-5 py-2 bg-green-500 hover:bg-green-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-all active:scale-95"
            >
              {names.length > 0 ? "Update Team" : "Set Up Team →"}
            </button>
          </div>
        ) : (
          /* Collapsed bar */
          <div className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-4 py-2.5 border border-slate-700">
            <span className="text-slate-400 text-sm flex-1 truncate">
              {names.map((n, i) => (
                <span key={n}>
                  {i > 0 && <span className="text-slate-600 mx-1">·</span>}
                  <span className="text-slate-300">{n}</span>
                </span>
              ))}
            </span>
            <button
              onClick={() => setShowEdit(true)}
              className="text-xs text-green-400 hover:text-green-300 font-medium shrink-0 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={copyUrl}
              className="text-xs text-slate-400 hover:text-slate-200 font-medium shrink-0 transition-colors"
            >
              {copied ? "Copied!" : "Copy URL"}
            </button>
          </div>
        )}
      </div>

      {/* Game */}
      {names.length >= 2 ? (
        <SoccerGame names={names} />
      ) : (
        <p className="text-slate-500 text-sm">Add at least 2 players above to start.</p>
      )}
    </main>
  );
}
