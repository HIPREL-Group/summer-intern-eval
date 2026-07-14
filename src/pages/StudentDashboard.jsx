import { useState, useEffect, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import ProblemView from "../components/ProblemView";
import ClauseChecklist from "../components/ClauseChecklist";
import ConfirmDialog from "../components/ConfirmDialog";

const ADMIN_EMAIL = "wenxiw@virginia.edu";

export default function StudentDashboard() {
  const { user, isAdmin, bootstrapAdmin } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [bootstrapping, setBootstrapping] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [submissionLimit, setSubmissionLimit] = useState(100);

  // Response state
  const [requiresResponses, setRequiresResponses] = useState([]);
  const [ensuresResponses, setEnsuresResponses] = useState([]);
  const [missingRequires, setMissingRequires] = useState("");
  const [missingEnsures, setMissingEnsures] = useState("");

  const fetchAssignment = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const getMyAssignment = httpsCallable(functions, "getMyAssignment");
      const result = await getMyAssignment();
      const data = result.data;
      setSubmissionCount(data?.submissionCount ?? 0);
      setSubmissionLimit(data?.submissionLimit ?? 100);
      if (data?.assignment) {
        setAssignment(data.assignment);
        setProblem(data.problem);
        // Initialize response arrays
        setRequiresResponses(
          (data.problem.requires || []).map(() => ({
            correct: false,
            explanation: "",
          }))
        );
        setEnsuresResponses(
          (data.problem.ensures || []).map(() => ({
            correct: false,
            explanation: "",
          }))
        );
        setMissingRequires("");
        setMissingEnsures("");
      } else {
        setAssignment(null);
        setProblem(null);
      }
    } catch (err) {
      setError("Failed to load your assignment. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  const handleRequestProblem = async () => {
    setRequesting(true);
    setError("");
    setSuccess("");
    try {
      const allocateProblem = httpsCallable(functions, "allocateProblem");
      await allocateProblem();
      await fetchAssignment();
      setSuccess("A new problem has been assigned to you!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      const msg =
        err.details?.message || err.message || "Failed to request a problem.";
      setError(msg);
    } finally {
      setRequesting(false);
    }
  };

  const toggleRequires = (idx) => {
    setRequiresResponses((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, correct: !r.correct, explanation: r.correct ? r.explanation : "" } : r
      )
    );
  };

  const toggleEnsures = (idx) => {
    setEnsuresResponses((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, correct: !r.correct, explanation: r.correct ? r.explanation : "" } : r
      )
    );
  };

  const updateRequiresExplanation = (idx, text) => {
    setRequiresResponses((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, explanation: text } : r))
    );
  };

  const updateEnsuresExplanation = (idx, text) => {
    setEnsuresResponses((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, explanation: text } : r))
    );
  };

  const validateResponses = () => {
    for (let i = 0; i < requiresResponses.length; i++) {
      const r = requiresResponses[i];
      if (!r.correct && !r.explanation.trim()) {
        return `Please check or explain Requires clause #${i + 1}.`;
      }
    }
    for (let i = 0; i < ensuresResponses.length; i++) {
      const r = ensuresResponses[i];
      if (!r.correct && !r.explanation.trim()) {
        return `Please check or explain Ensures clause #${i + 1}.`;
      }
    }
    return null;
  };

  const handleSubmitClick = () => {
    const validationError = validateResponses();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setShowConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const submitResponse = httpsCallable(functions, "submitResponse");
      await submitResponse({
        requires: requiresResponses.map((r, i) => ({
          index: i,
          correct: r.correct,
          explanation: r.correct ? null : r.explanation.trim(),
        })),
        ensures: ensuresResponses.map((r, i) => ({
          index: i,
          correct: r.correct,
          explanation: r.correct ? null : r.explanation.trim(),
        })),
        missingRequires: missingRequires.trim() || null,
        missingEnsures: missingEnsures.trim() || null,
      });
      setShowConfirm(false);
      setAssignment(null);
      setProblem(null);
      setSuccess("Your response has been submitted successfully!");
    } catch (err) {
      setError(err.message || "Failed to submit. Please try again.");
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {error && !problem && (
        <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm border border-green-200">
          {success}
        </div>
      )}

      {/* Admin bootstrap banner */}
      {user?.email === ADMIN_EMAIL && !isAdmin && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-amber-800">Admin Setup</p>
            <p className="text-sm text-amber-700">
              Activate your admin privileges to access the admin dashboard.
            </p>
          </div>
          <button
            onClick={async () => {
              setBootstrapping(true);
              try {
                await bootstrapAdmin();
                setSuccess("Admin privileges activated! The Admin tab is now available.");
              } catch (err) {
                setError(err.message || "Failed to activate admin.");
              } finally {
                setBootstrapping(false);
              }
            }}
            disabled={bootstrapping}
            className="px-5 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {bootstrapping ? "Activating..." : "Activate Admin"}
          </button>
        </div>
      )}

      {!problem ? (
        /* No active assignment — show request button */
        <div className="text-center pt-8 pb-20">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-50 mb-6">
            <svg
              className="w-10 h-10 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Ready for a new problem?
          </h2>
          <div className="text-gray-500 mb-8 max-w-2xl mx-auto text-left space-y-3 text-sm leading-relaxed">
            <p>
              Click the button below to receive a <strong className="text-gray-700">VerusBench</strong> problem. Each problem consists of:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                A <strong className="text-gray-700">description</strong> of a competitive programming problem (from LeetCode, Codeforces, etc.).
              </li>
              <li>
                A <strong className="text-gray-700">Verus specification</strong> for the problem, which includes{" "}
                <strong className="text-gray-700">pre-conditions</strong> (in the <code className="bg-gray-100 px-1 rounded text-xs">requires</code> clause) and{" "}
                <strong className="text-gray-700">post-conditions</strong> (in the <code className="bg-gray-100 px-1 rounded text-xs">ensures</code> clause).
              </li>
            </ul>
            <p>
              Pre-conditions describe what the function <em>assumes</em> about its inputs, and post-conditions describe what the function <em>guarantees</em> about its output. Together, they form a formal contract that should accept all and only the correct implementations of the function (the implementations themselves are omitted).
            </p>
            <p>
              Your task is to evaluate whether each condition is correct, and whether the conditions together are sufficient.
            </p>
            <div className="border-l-4 border-amber-500 bg-amber-50 text-amber-900 px-4 py-3 rounded-r-md">
              Your work will be evaluated on three criteria, in order of priority: (1) the quality of your submissions, (2) the number of problems you solve, and (3) the time taken to solve them. Quality comes first — submitting more solutions with errors is less valuable than submitting fewer but correct ones.
            </div>
            <p className="font-semibold text-gray-800">
              The deadline for this task is Sunday, May 17, 2026 at 23:59:59 AoE.
            </p>
            <p className="text-xs text-gray-400">
              New to Verus? Check out the{" "}
              <a
                href="https://verus-lang.github.io/verus/guide/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700"
              >
                Verus Guide
              </a>.
            </p>
          </div>
          <button
            onClick={handleRequestProblem}
            disabled={requesting || submissionCount >= submissionLimit}
            className="px-8 py-3 bg-primary-600 text-white rounded-xl font-medium text-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-primary-200"
          >
            {submissionCount >= submissionLimit ? (
              "Submission limit reached"
            ) : requesting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                Allocating...
              </span>
            ) : (
              "Request Problem"
            )}
          </button>
          <p className="text-sm text-gray-500 mt-6">
            You have completed{" "}
            <span className="font-semibold text-gray-700">
              {submissionCount}
            </span>{" "}
            / {submissionLimit} problems.
          </p>
        </div>
      ) : (
        /* Active problem */
        <div className="space-y-6">
          <details className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800 select-none">
              Instructions
            </summary>
            <div className="mt-3 text-gray-500 text-sm leading-relaxed space-y-3 pb-1">
              <p>
                Each <strong className="text-gray-700">VerusBench</strong> problem consists of:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  A <strong className="text-gray-700">description</strong> of a competitive programming problem (from LeetCode, Codeforces, etc.).
                </li>
                <li>
                  A <strong className="text-gray-700">Verus specification</strong> for the problem, which includes{" "}
                  <strong className="text-gray-700">pre-conditions</strong> (in the <code className="bg-gray-100 px-1 rounded text-xs">requires</code> clause) and{" "}
                  <strong className="text-gray-700">post-conditions</strong> (in the <code className="bg-gray-100 px-1 rounded text-xs">ensures</code> clause).
                </li>
              </ul>
              <p>
                Pre-conditions describe what the function <em>assumes</em> about its inputs, and post-conditions describe what the function <em>guarantees</em> about its output. Together, they form a formal contract that should accept all and only the correct implementations of the function (the implementations themselves are omitted).
              </p>
              <p>
                Your task is to evaluate whether each condition is correct, and whether the conditions together are sufficient.
              </p>
              <div className="border-l-4 border-amber-500 bg-amber-50 text-amber-900 px-4 py-3 rounded-r-md">
                Your work will be evaluated on three criteria, in order of priority: (1) the quality of your submissions, (2) the number of problems you solve, and (3) the time taken to solve them. Quality comes first — submitting more solutions with errors is less valuable than submitting fewer but correct ones.
              </div>
              <p className="font-semibold text-gray-800">
                The deadline for this task is Sunday, May 17, 2026 at 23:59:59 AoE.
              </p>
              <p className="text-xs text-gray-400">
                New to Verus? Check out the{" "}
                <a
                  href="https://verus-lang.github.io/verus/guide/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700"
                >
                  Verus Guide
                </a>.
              </p>
            </div>
          </details>

          <ProblemView
            problem={problem}
            submissionCount={submissionCount}
            submissionLimit={submissionLimit}
          />

          <ClauseChecklist
            title="Requires"
            clauses={problem.requires || []}
            responses={requiresResponses}
            onToggle={toggleRequires}
            onExplanationChange={updateRequiresExplanation}
            missingText={missingRequires}
            onMissingChange={setMissingRequires}
            disabled={false}
          />

          <ClauseChecklist
            title="Ensures"
            clauses={problem.ensures || []}
            responses={ensuresResponses}
            onToggle={toggleEnsures}
            onExplanationChange={updateEnsuresExplanation}
            missingText={missingEnsures}
            onMissingChange={setMissingEnsures}
            disabled={false}
          />

          <div className="pt-4 pb-8 space-y-3">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={handleSubmitClick}
                className="px-8 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200"
              >
                Submit Response
              </button>
            </div>
          </div>

          <ConfirmDialog
            open={showConfirm}
            onConfirm={handleConfirmSubmit}
            onCancel={() => setShowConfirm(false)}
            loading={submitting}
          />
        </div>
      )}
    </div>
  );
}
