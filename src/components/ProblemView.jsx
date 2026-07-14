import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function ProblemView({
  problem,
  submissionCount,
  submissionLimit,
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Problem #{problem.id}</span>
        {typeof submissionCount === "number" &&
          typeof submissionLimit === "number" && (
            <span className="text-sm text-gray-500">
              ·{" "}
              <span className="font-semibold text-gray-700">
                {submissionCount}
              </span>{" "}
              / {submissionLimit} problems
            </span>
          )}
      </div>

      {/* Description */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Description</h3>
        <div className="markdown-content prose max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
            {problem.description}
          </ReactMarkdown>
        </div>
      </div>

      {/* Spec */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Specification
        </h3>
        <SyntaxHighlighter
          language="rust"
          style={oneLight}
          customStyle={{
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
          }}
          showLineNumbers
        >
          {problem.spec}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
