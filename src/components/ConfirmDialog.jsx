export default function ConfirmDialog({ open, onConfirm, onCancel, loading }) {
  if (!open) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Confirm Submission
        </h3>
        <p className="text-gray-600 mb-6">
          Are you sure you want to submit your responses? Once submitted, your
          answers <strong>cannot be modified</strong>.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Confirm & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
