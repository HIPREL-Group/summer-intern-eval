import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function ClauseChecklist({
  title,
  clauses,
  responses,
  onToggle,
  onExplanationChange,
  missingText,
  onMissingChange,
  disabled,
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">
        {title === "Requires"
          ? "For each pre-condition below, check the box if it is correct. If it is incorrect, provide a justification in the text box. If any pre-conditions are missing, describe them at the end."
          : "For each post-condition below, check the box if it is correct. If it is incorrect, provide a justification in the text box. If any post-conditions are missing, describe them at the end."}
      </p>
      <p className="text-sm text-gray-400 italic mb-4 -mt-2">
        Note: Some conditions reference helper functions defined in the specification above — consider their definitions as part of evaluating each condition.
      </p>
      <div className="space-y-4">
        {clauses.map((clause, idx) => {
          const resp = responses[idx] || { correct: false, explanation: "" };
          const hasError = !resp.correct && !resp.explanation.trim();

          return (
            <div
              key={idx}
              className={`border rounded-lg p-4 transition-colors ${
                hasError && disabled === false
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={resp.correct}
                    onChange={() => onToggle(idx)}
                    disabled={disabled}
                    className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <SyntaxHighlighter
                    language="rust"
                    style={oneLight}
                    customStyle={{
                      borderRadius: "0.375rem",
                      fontSize: "0.8125rem",
                      margin: 0,
                      padding: "0.5rem 0.75rem",
                    }}
                    wrapLongLines
                  >
                    {clause}
                  </SyntaxHighlighter>
                  {!resp.correct && (
                    <div className="mt-2">
                      <textarea
                        value={resp.explanation}
                        onChange={(e) =>
                          onExplanationChange(idx, e.target.value)
                        }
                        disabled={disabled}
                        placeholder="Explain why this is incorrect (e.g., a counter-example)..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-y disabled:bg-gray-50"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Missing clauses text area */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Missing {title.toLowerCase()} (optional)
        </label>
        <textarea
          value={missingText}
          onChange={(e) => onMissingChange(e.target.value)}
          disabled={disabled}
          placeholder={`Describe any missing ${title.toLowerCase()} conditions (e.g., with counter-examples)...`}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-y disabled:bg-gray-50"
        />
      </div>
    </div>
  );
}
