import { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { functions } from "../firebase";

const DEFAULT_PARAMS = {
  minWords: 3,
  maxWords: 15,
  minTimeSec: 180,
  tooShortPenalty: 0.1,
};

const DEFAULT_WEIGHTS = {
  correctness: 1 / 3,
  length: 1 / 3,
  missing: 1 / 3,
};

const COLUMNS = [
  { key: "rank", label: "#", numeric: true },
  { key: "email", label: "Email", numeric: false },
  { key: "submissionCount", label: "# Subs", numeric: true },
  { key: "correctnessTotal", label: "Correctness", numeric: true },
  { key: "lengthTotal", label: "Length", numeric: true },
  { key: "missingTotal", label: "Missing", numeric: true },
  { key: "avgTimeMultiplier", label: "Avg Time Mult", numeric: true },
  { key: "composite", label: "Composite", numeric: true, emphasis: true },
];

export default function LeaderboardManager() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [rows, setRows] = useState(null);
  const [computedAtMs, setComputedAtMs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState("composite");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    let cancelled = false;
    const loadLatest = async () => {
      try {
        const fn = httpsCallable(functions, "getLatestLeaderboard");
        const result = await fn();
        if (cancelled) return;
        if (result.data && Array.isArray(result.data.rows)) {
          setRows(result.data.rows);
          setComputedAtMs(result.data.computedAtMs || null);
          if (result.data.params) {
            setParams({ ...DEFAULT_PARAMS, ...result.data.params });
          }
        }
      } catch {
        // No cached leaderboard yet (or permission denied) — silent.
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };
    loadLatest();
    return () => {
      cancelled = true;
    };
  }, []);

  const compositeRows = useMemo(() => {
    if (!rows) return null;
    const enriched = rows.map((r) => ({
      ...r,
      composite:
        weights.correctness * r.correctnessTotal +
        weights.length * r.lengthTotal +
        weights.missing * r.missingTotal,
    }));
    const dir = sortDir === "asc" ? 1 : -1;
    enriched.sort((a, b) => {
      if (sortKey === "rank") return 0;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return dir * av.localeCompare(bv);
      }
      return dir * ((av ?? 0) - (bv ?? 0));
    });
    return enriched.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows, weights, sortKey, sortDir]);

  const histogram = useMemo(() => {
    if (!compositeRows || compositeRows.length === 0) return null;
    const scores = compositeRows.map((r) => r.composite);
    const max = Math.max(...scores);
    if (max <= 0) {
      return [{ bin: "0", students: scores.length, lo: 0, hi: 0 }];
    }
    const binCount = 10;
    const binSize = max / binCount;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      bin: `${formatBinEdge(i * binSize)}–${formatBinEdge((i + 1) * binSize)}`,
      lo: i * binSize,
      hi: (i + 1) * binSize,
      students: 0,
    }));
    for (const s of scores) {
      let idx = Math.floor(s / binSize);
      if (idx >= binCount) idx = binCount - 1;
      if (idx < 0) idx = 0;
      bins[idx].students += 1;
    }
    return bins;
  }, [compositeRows]);

  const handleCompute = async () => {
    setLoading(true);
    setError("");
    try {
      const fn = httpsCallable(functions, "computeLeaderboard");
      const result = await fn(params);
      setRows(result.data.rows || []);
      setComputedAtMs(result.data.computedAtMs || Date.now());
    } catch (err) {
      setError("Failed to compute leaderboard: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    if (key === "rank") return;
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "email" ? "asc" : "desc");
    }
  };

  const handleExportCsv = () => {
    if (!compositeRows) return;
    const header = COLUMNS.map((c) => c.label).join(",");
    const body = compositeRows
        .map((r) =>
          COLUMNS.map((c) => {
            const v = r[c.key];
            if (v == null) return "";
            if (typeof v === "number") {
              return c.key === "composite" || c.key.endsWith("Total") ||
                c.key === "avgTimeMultiplier" ?
                v.toFixed(4) :
                String(v);
            }
            const s = String(v);
            if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
              return "\"" + s.replace(/"/g, "\"\"") + "\"";
            }
            return s;
          }).join(","),
        )
        .join("\n");
    const csv = header + "\n" + body + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date(computedAtMs || Date.now())
        .toISOString()
        .replace(/[:.]/g, "-");
    a.download = `leaderboard-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <p className="font-semibold mb-1">How the leaderboard works</p>
        <p>
          For each student submission we compute three quality signals
          (correctness, length, missing-clause consensus), each in [0, 1].
          A time-penalty multiplier degrades the contribution of submissions
          that landed suspiciously fast. Per student, we sum
          <code className="bg-white px-1 mx-1 rounded">score × multiplier</code>
          across all their submissions to get the three per-criterion totals.
          You weight those three totals with the sliders below to produce the
          composite ranking. Sliders adjust the table instantly; re-compute
          is only needed when threshold knobs change.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CriterionCard
          title="1. Correctness — peer-agreement on clauses"
          fixed
        >
          <p>
            For every clause the student rated, we compare their
            correct/incorrect vote against every <em>other</em> submission on
            the same problem (leave-one-out). Per-clause score is the
            fraction of others who agree; the submission's correctness is
            the mean across its clauses.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            First submitter on a problem (no peers to compare against) is
            credited with 1.0 — treated as the "seed of consensus" since
            penalizing first-movers would discourage the work we want.
          </p>
        </CriterionCard>

        <CriterionCard title="2. Length — explanation effort">
          <p>
            We score every non-null text field on the submission
            (<em>explanation</em> on wrong-marked clauses, plus
            <em> missingRequires</em> / <em>missingEnsures</em> notes) by
            word count. Below <strong>minWords</strong> → 0; from minWords up
            to <strong>maxWords</strong> the score ramps linearly to 1.
            Submissions with no text fields (all clauses marked correct, no
            missing notes) score 1 — they have nothing to penalize.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <KnobInput
              label="minWords (≥ here = floor)"
              value={params.minWords}
              onChange={(v) =>
                setParams((p) => ({ ...p, minWords: Math.max(0, Math.floor(v)) }))
              }
              min={0}
              step={1}
            />
            <KnobInput
              label="maxWords (≥ here = full credit)"
              value={params.maxWords}
              onChange={(v) =>
                setParams((p) => ({ ...p, maxWords: Math.max(1, Math.floor(v)) }))
              }
              min={1}
              step={1}
            />
          </div>
        </CriterionCard>

        <CriterionCard
          title="3. Missing-clause consensus"
          fixed
        >
          <p>
            Treats each side (requires / ensures) as a binary: did this
            student flag a missing clause? Per side we score against peers
            on the same problem:
          </p>
          <ul className="mt-2 list-disc list-inside space-y-0.5 text-xs">
            <li>Student flagged, 2+ others flagged → 1.0</li>
            <li>Student flagged, exactly 1 other flagged → 0.75</li>
            <li>Student flagged, no others flagged → 0</li>
            <li>Student did not flag, no others flagged → 1.0</li>
            <li>Student did not flag, majority of others flagged → 0</li>
            <li>Student did not flag, minority of others flagged → 0.5</li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            First submitter on a problem: 1.0 per side.
          </p>
        </CriterionCard>

        <CriterionCard title="4. Time penalty (asymmetric)">
          <p>
            Per student we sort submissions by <em>submittedAt</em> and use
            the gap between consecutive submissions as a proxy for time
            spent. If the gap is below <strong>minTimeSec</strong>, that
            submission's multiplier drops to <strong>tooShortPenalty</strong>;
            otherwise the multiplier is 1.0. We don't reward long gaps —
            wall-clock idle time isn't engagement. The student's very first
            submission (no predecessor) is not penalizable, so it gets 1.0.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <KnobInput
              label="minTimeSec (gap floor)"
              value={params.minTimeSec}
              onChange={(v) =>
                setParams((p) => ({ ...p, minTimeSec: Math.max(0, v) }))
              }
              min={0}
              step={30}
            />
            <KnobInput
              label="tooShortPenalty"
              value={params.tooShortPenalty}
              onChange={(v) =>
                setParams((p) => ({
                  ...p,
                  tooShortPenalty: Math.min(1, Math.max(0, v)),
                }))
              }
              min={0}
              max={1}
              step={0.05}
            />
          </div>
        </CriterionCard>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-gray-600">
          {computedAtMs ? (
            <>
              Last computed:{" "}
              <span className="font-mono">
                {new Date(computedAtMs).toLocaleString()}
              </span>
            </>
          ) : (
            <>Press <strong>Compute</strong> to score all submissions.</>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCompute}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Computing…" : computedAtMs ? "Recompute" : "Compute"}
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!compositeRows || compositeRows.length === 0}
            className="px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      {compositeRows && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Composite weights (sum = 1.00)
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Drag a slider — the other two scale proportionally so the sum
              stays 1. The composite column re-sorts immediately.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <WeightSlider
                label="Correctness"
                value={weights.correctness}
                onChange={(v) => setWeights(rescaleWeights(weights, "correctness", v))}
              />
              <WeightSlider
                label="Length"
                value={weights.length}
                onChange={(v) => setWeights(rescaleWeights(weights, "length", v))}
              />
              <WeightSlider
                label="Missing"
                value={weights.missing}
                onChange={(v) => setWeights(rescaleWeights(weights, "missing", v))}
              />
            </div>
          </div>

          {histogram && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">
                Composite-score distribution
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Students binned by current composite score. Reacts to the
                weight sliders above.
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={histogram}
                  margin={{ top: 5, right: 10, left: 0, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="bin"
                    label={{
                      value: "Composite score",
                      position: "insideBottom",
                      offset: -20,
                    }}
                    tick={{ fontSize: 10 }}
                    angle={-35}
                    textAnchor="end"
                    height={50}
                    interval={0}
                  />
                  <YAxis
                    label={{
                      value: "# Students",
                      angle: -90,
                      position: "insideLeft",
                    }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(v) => [v, "Students"]}
                    labelFormatter={(label) => `Score ${label}`}
                  />
                  <Bar dataKey="students" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    {COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        onClick={() => handleSort(c.key)}
                        className={`px-3 py-2 text-left font-semibold cursor-pointer hover:bg-gray-100 select-none ${
                          c.numeric ? "text-right" : ""
                        } ${c.emphasis ? "text-primary-700" : ""}`}
                      >
                        {c.label}
                        {sortKey === c.key && (
                          <span className="ml-1">
                            {sortDir === "desc" ? "↓" : "↑"}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {compositeRows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="text-center py-8 text-gray-400">
                        No submissions yet.
                      </td>
                    </tr>
                  ) : (
                    compositeRows.map((r) => (
                      <tr key={r.uid} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                          {r.rank}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-800">
                          {r.email || r.uid.slice(0, 8)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.submissionCount}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.correctnessTotal.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.lengthTotal.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.missingTotal.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.avgTimeMultiplier.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary-700">
                          {r.composite.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CriterionCard({ title, fixed, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        {fixed && (
          <span className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">
            no knobs
          </span>
        )}
      </div>
      <div className="text-sm text-gray-700 space-y-1 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function KnobInput({ label, value, onChange, min, max, step }) {
  return (
    <label className="text-xs text-gray-600 block">
      <span className="block mb-1">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
      />
    </label>
  );
}

function WeightSlider({ label, value, onChange }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-xs font-mono text-gray-500">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary-600"
      />
    </div>
  );
}

function formatBinEdge(x) {
  if (x === 0) return "0";
  if (x >= 100) return x.toFixed(0);
  if (x >= 10) return x.toFixed(1);
  return x.toFixed(2);
}

function rescaleWeights(weights, changedKey, newValue) {
  const clamped = Math.min(1, Math.max(0, newValue));
  const otherKeys = Object.keys(weights).filter((k) => k !== changedKey);
  const otherSum = otherKeys.reduce((s, k) => s + weights[k], 0);
  const remaining = 1 - clamped;
  const next = { [changedKey]: clamped };
  if (otherSum === 0) {
    // Distribute remaining equally if the others have collapsed to 0.
    const share = remaining / otherKeys.length;
    for (const k of otherKeys) next[k] = share;
  } else {
    for (const k of otherKeys) next[k] = (weights[k] / otherSum) * remaining;
  }
  return next;
}
