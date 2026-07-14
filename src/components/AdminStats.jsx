import { useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const BUCKET_DEFS = [
  { key: "allIncorrect",  label: "=0% (unanimously incorrect)",       color: "#7f1d1d" },
  { key: "highIncorrect", label: "(0,20%) (highly likely incorrect)", color: "#ef4444" },
  { key: "lowIncorrect",  label: "[20,50%) (likely incorrect)",       color: "#f97316" },
  { key: "indeterminate", label: "=50% (indeterminate)",              color: "#eab308" },
  { key: "lowCorrect",    label: "(50,80%] (likely correct)",         color: "#84cc16" },
  { key: "highCorrect",   label: "(80,100%) (highly likely correct)", color: "#22c55e" },
  { key: "allCorrect",    label: "=100% (unanimously correct)",       color: "#14532d" },
];

const MISSING_BUCKET_DEFS = [
  { key: "none", label: "=0% (no one reported)",   color: "#22c55e" },
  { key: "lt50", label: "(0,50%) reported",        color: "#84cc16" },
  { key: "eq50", label: "=50% reported",           color: "#eab308" },
  { key: "gt50", label: "(50,100%) reported",      color: "#f97316" },
  { key: "all",  label: "=100% (all reported)",    color: "#7f1d1d" },
];

// 12 categorical bins: =0, (0,10), [10,20), …, [80,90), [90,100), =100.
// Middle bins are half-open; the two endpoints are exact-value bars so
// "no clauses" / "all clauses" problems don't muddy the trend.
const PCT_BINS = [
  { key: "p0", label: "0", exact: 0 },
  ...Array.from({ length: 10 }, (_, i) => {
    const min = i * 10;
    const max = (i + 1) * 10;
    const leftBracket = i === 0 ? "(" : "[";
    return { key: `m${i}`, label: `${leftBracket}${min},${max})`, min, max };
  }),
  { key: "p100", label: "100", exact: 100 },
];

function bucketForFraction(correct, total) {
  if (total === 0) return null;
  const pct = (correct / total) * 100;
  if (pct === 0) return "allIncorrect";
  if (pct === 100) return "allCorrect";
  if (pct < 20) return "highIncorrect";
  if (pct < 50) return "lowIncorrect";
  if (pct === 50) return "indeterminate";
  if (pct <= 80) return "lowCorrect";
  return "highCorrect";
}

function missingBucketForFraction(numerator, denominator) {
  if (denominator === 0) return null;
  const pct = (numerator / denominator) * 100;
  if (pct === 0) return "none";
  if (pct === 100) return "all";
  if (pct < 50) return "lt50";
  if (pct === 50) return "eq50";
  return "gt50";
}

function binPercentage(pct) {
  if (pct === 0) return "0";
  if (pct === 100) return "100";
  for (const bin of PCT_BINS) {
    if (bin.exact != null) continue;
    // First middle bin is (0, 10) — exclude exact 0; last middle bin is
    // [90, 100) — exclude exact 100.
    const lowerOk = bin.min === 0 ? pct > 0 : pct >= bin.min;
    if (lowerOk && pct < bin.max) return bin.label;
  }
  return null;
}

function renderPieLabel({ cx, cy, midAngle, outerRadius, value, fill }) {
  if (!value) return null;
  const RAD = Math.PI / 180;
  const sin = Math.sin(-midAngle * RAD);
  const cos = Math.cos(-midAngle * RAD);
  const sx = cx + (outerRadius + 4) * cos;
  const sy = cy + (outerRadius + 4) * sin;
  const mx = cx + (outerRadius + 22) * cos;
  const my = cy + (outerRadius + 22) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 12;
  const ey = my;
  const anchor = cos >= 0 ? "start" : "end";
  return (
    <g>
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke={fill}
        fill="none"
      />
      <text
        x={ex + (cos >= 0 ? 3 : -3)}
        y={ey}
        textAnchor={anchor}
        dominantBaseline="central"
        fontSize={11}
        fill="#374151"
      >
        {value}
      </text>
    </g>
  );
}

export default function AdminStats({ stats, loading, onRefresh }) {
  const [clauseView, setClauseView] = useState("combined");
  const [responseAnalytics, setResponseAnalytics] = useState(null);
  const [responseLoading, setResponseLoading] = useState(false);
  const [responseError, setResponseError] = useState("");

  const clauseAnalytics = useMemo(
    () => buildClauseAnalytics(responseAnalytics, clauseView),
    [responseAnalytics, clauseView],
  );

  const loadResponseAnalytics = async () => {
    setResponseLoading(true);
    setResponseError("");
    try {
      const fn = httpsCallable(functions, "getResponseAnalytics");
      const result = await fn();
      setResponseAnalytics(result.data);
    } catch (err) {
      setResponseError(
        "Failed to load response analytics: " +
          (err.message || "Unknown error"),
      );
    } finally {
      setResponseLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-10 text-gray-500">
        No stats available.
      </div>
    );
  }

  const submissionHistogram = (() => {
    const counts = {};
    (stats.problemStats || []).forEach((p) => {
      const s = p.submissionCount;
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([subs, problems]) => ({
        submissions: Number(subs),
        problems,
      }))
      .sort((a, b) => a.submissions - b.submissions);
  })();

  const studentHistogram = stats.studentSubmissionHistogram || [];

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Students"
          value={stats.totalStudents || 0}
          color="blue"
        />
        <StatCard
          label="Total Submissions"
          value={stats.totalSubmissions || 0}
          color="green"
        />
        <StatCard
          label="Total Problems"
          value={stats.totalProblems || 0}
          color="purple"
        />
        <StatCard
          label="Active Assignments"
          value={stats.activeAssignments || 0}
          color="amber"
        />
      </div>

      {/* Submissions histogram */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">
          Problem Distribution by Submission Count
        </h3>
        {submissionHistogram.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={submissionHistogram}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="submissions"
                label={{ value: "# Submissions", position: "insideBottom", offset: -5 }}
                allowDecimals={false}
              />
              <YAxis
                label={{ value: "# Problems", angle: -90, position: "insideLeft" }}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value) => [value, "Problems"]}
                labelFormatter={(label) => `${label} submission${label === 1 ? "" : "s"}`}
              />
              <Bar dataKey="problems" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-10">No data yet</p>
        )}
      </div>

      {/* Student submission histogram */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">
          Student Distribution by Submission Count
        </h3>
        {studentHistogram.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={studentHistogram}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="submissions"
                label={{ value: "# Submissions", position: "insideBottom", offset: -5 }}
                allowDecimals={false}
              />
              <YAxis
                label={{ value: "# Students", angle: -90, position: "insideLeft" }}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value) => [value, "Students"]}
                labelFormatter={(label) => `${label} submission${label === 1 ? "" : "s"}`}
              />
              <Bar dataKey="students" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-10">No data yet</p>
        )}
      </div>

      {/* Response analytics (lazy-loaded; full submissions scan) */}
      <ResponseAnalyticsGate
        loaded={responseAnalytics !== null}
        loading={responseLoading}
        error={responseError}
        onLoad={loadResponseAnalytics}
      >
        <ClauseAnalyticsSection
          clauseView={clauseView}
          setClauseView={setClauseView}
          data={clauseAnalytics}
          onReload={loadResponseAnalytics}
          reloading={responseLoading}
        />
      </ResponseAnalyticsGate>

      <div className="flex justify-end">
        <button
          onClick={onRefresh}
          className="px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
        >
          Refresh Stats
        </button>
      </div>
    </div>
  );
}

function buildClauseAnalytics(stats, view) {
  if (!stats || !stats.clauseVotes || !stats.missingReports) {
    return {
      bucketPie: [],
      histCorrect: [],
      histIncorrect: [],
      histIndeterminate: [],
      missingPie: [],
    };
  }

  const sides =
    view === "requires"
      ? ["requires"]
      : view === "ensures"
        ? ["ensures"]
        : ["requires", "ensures"];

  // 1) Clause bucket pie — flatten all clauses across selected sides, bucket.
  const bucketCounts = {
    allIncorrect: 0,
    highIncorrect: 0,
    lowIncorrect: 0,
    indeterminate: 0,
    lowCorrect: 0,
    highCorrect: 0,
    allCorrect: 0,
  };
  for (const problemId of Object.keys(stats.clauseVotes)) {
    for (const side of sides) {
      for (const entry of stats.clauseVotes[problemId][side]) {
        const bucket = bucketForFraction(entry.correctVotes, entry.totalVotes);
        if (bucket) bucketCounts[bucket]++;
      }
    }
  }
  const totalBucketed = Object.values(bucketCounts).reduce((a, b) => a + b, 0);
  const bucketPie =
    totalBucketed === 0
      ? []
      : BUCKET_DEFS.map((b) => ({
          name: b.label,
          value: bucketCounts[b.key],
          color: b.color,
        })).filter((d) => d.value > 0);

  // 2) Per-problem histograms — for each problem, compute its % of clauses
  //    likely correct / incorrect / indeterminate, then bin those percentages.
  const correctPcts = [];
  const incorrectPcts = [];
  const indeterminatePcts = [];
  for (const problemId of Object.keys(stats.clauseVotes)) {
    let total = 0;
    let cCorrect = 0;
    let cIncorrect = 0;
    let cInd = 0;
    for (const side of sides) {
      for (const entry of stats.clauseVotes[problemId][side]) {
        if (entry.totalVotes === 0) continue;
        total++;
        const pct = (entry.correctVotes / entry.totalVotes) * 100;
        if (pct > 50) cCorrect++;
        else if (pct < 50) cIncorrect++;
        else cInd++;
      }
    }
    if (total === 0) continue;
    correctPcts.push((cCorrect / total) * 100);
    incorrectPcts.push((cIncorrect / total) * 100);
    indeterminatePcts.push((cInd / total) * 100);
  }

  const histFromPcts = (pcts) => {
    const counts = Object.fromEntries(PCT_BINS.map((b) => [b.label, 0]));
    for (const p of pcts) {
      const label = binPercentage(p);
      if (label != null) counts[label]++;
    }
    return PCT_BINS.map((b) => ({ bin: b.label, problems: counts[b.label] }));
  };

  const anyHistData = correctPcts.length > 0;

  // 3) Missing-report pie — per-problem fraction of submissions with a
  //    non-empty missing note, bucketed with =0% and =100% split out.
  const missingCounts = { none: 0, lt50: 0, eq50: 0, gt50: 0, all: 0 };
  for (const problemId of Object.keys(stats.missingReports)) {
    const mr = stats.missingReports[problemId];
    if (mr.totalSubmissions === 0) continue;
    let numerator;
    if (view === "requires") numerator = mr.missingReqCount;
    else if (view === "ensures") numerator = mr.missingEnsCount;
    else numerator = mr.missingEitherCount;
    const bucket = missingBucketForFraction(numerator, mr.totalSubmissions);
    if (bucket) missingCounts[bucket]++;
  }
  const totalMissing = Object.values(missingCounts).reduce((a, b) => a + b, 0);
  const missingPie =
    totalMissing === 0
      ? []
      : MISSING_BUCKET_DEFS.map((b) => ({
          name: b.label,
          value: missingCounts[b.key],
          color: b.color,
        })).filter((d) => d.value > 0);

  return {
    bucketPie,
    histCorrect: anyHistData ? histFromPcts(correctPcts) : [],
    histIncorrect: anyHistData ? histFromPcts(incorrectPcts) : [],
    histIndeterminate: anyHistData ? histFromPcts(indeterminatePcts) : [],
    missingPie,
  };
}

function ResponseAnalyticsGate({ loaded, loading, error, onLoad, children }) {
  if (loaded) return children;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        Response Analytics
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Per-clause vote distributions and missing-clause reports across all
        submissions. Runs a full scan; loaded on demand.
      </p>
      {error && (
        <div className="mb-3 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}
      <button
        onClick={onLoad}
        disabled={loading}
        className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Loading…" : "Load Response Analytics"}
      </button>
    </div>
  );
}

function ClauseAnalyticsSection({
  clauseView,
  setClauseView,
  data,
  onReload,
  reloading,
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Response Analytics
          </h2>
          <button
            onClick={onReload}
            disabled={reloading}
            className="px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50 rounded-md hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {reloading ? "Reloading…" : "Reload"}
          </button>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {[
            { id: "requires", label: "Requires" },
            { id: "ensures", label: "Ensures" },
            { id: "combined", label: "Combined" },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setClauseView(opt.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                clauseView === opt.id
                  ? "bg-primary-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clause-bucket pie (full width) */}
      <ChartCard title="Clauses by vote distribution">
        {data.bucketPie.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data.bucketPie}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                dataKey="value"
                label={renderPieLabel}
                labelLine={false}
              >
                {data.bucketPie.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Legend />
              <Tooltip formatter={(v) => [v, "Clauses"]} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-10">No data yet</p>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PercentHistogram
          title="Problems by % of clauses likely correct (>50%)"
          data={data.histCorrect}
          fill="#22c55e"
        />
        <PercentHistogram
          title="Problems by % of clauses likely incorrect (<50%)"
          data={data.histIncorrect}
          fill="#ef4444"
        />
        <PercentHistogram
          title="Problems by % of clauses indeterminate (=50%)"
          data={data.histIndeterminate}
          fill="#eab308"
        />

        {/* Missing-report pie */}
        <ChartCard title="Problems by % of submissions reporting missing clauses">
          {data.missingPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.missingPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  label={renderPieLabel}
                  labelLine={false}
                >
                  {data.missingPie.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip formatter={(v) => [v, "Problems"]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-10">No data yet</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function PercentHistogram({ title, data, fill }) {
  const hasData = data.some((d) => d.problems > 0);
  return (
    <ChartCard title={title}>
      {hasData ? (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="bin"
              label={{ value: "% of clauses", position: "insideBottom", offset: -20 }}
              interval={0}
              tick={{ fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              height={50}
            />
            <YAxis
              label={{ value: "# Problems", angle: -90, position: "insideLeft" }}
              allowDecimals={false}
            />
            <Tooltip formatter={(v) => [v, "Problems"]} />
            <Bar dataKey="problems" fill={fill} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-gray-400 text-center py-10">No data yet</p>
      )}
    </ChartCard>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
