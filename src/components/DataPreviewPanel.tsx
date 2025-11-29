import { Check, X, AlertTriangle, Download } from 'lucide-react';
import { EmployeeRecord, ParsedData } from '../services/dataIngestionService';

interface DataPreviewPanelProps {
  parsedData: ParsedData;
  onAccept: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export default function DataPreviewPanel({
  parsedData,
  onAccept,
  onCancel,
  isProcessing = false,
}: DataPreviewPanelProps) {
  const hasErrors = parsedData.errors.length > 0;
  const hasDuplicates = parsedData.duplicates.length > 0;

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-light-sea-green to-jungle-green">
        <h3 className="text-xl font-bold text-white mb-2">Data Preview & Validation</h3>
        <p className="text-sm text-white/90">Review the parsed data before importing</p>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
            <div className="text-sm text-blue-600 mb-1">Total Records</div>
            <div className="text-2xl font-bold text-blue-900">{parsedData.totalRecords}</div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
            <div className="text-sm text-green-600 mb-1">Valid Records</div>
            <div className="text-2xl font-bold text-green-900">{parsedData.validRecords}</div>
          </div>

          {hasErrors && (
            <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
              <div className="text-sm text-red-600 mb-1">Errors</div>
              <div className="text-2xl font-bold text-red-900">{parsedData.errors.length}</div>
            </div>
          )}

          {hasDuplicates && (
            <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-200">
              <div className="text-sm text-yellow-600 mb-1">Duplicates</div>
              <div className="text-2xl font-bold text-yellow-900">{parsedData.duplicates.length}</div>
            </div>
          )}
        </div>

        {parsedData.preview.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">
              Preview (First 10 Records)
            </h4>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                      Full Name
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                      Job Title
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                      Team
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                      Department
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                      Email
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.preview.map((record, idx) => (
                    <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900 font-medium">
                        {record.full_name}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">{record.job_title || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{record.team || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{record.department || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{record.email || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {hasErrors && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-900 mb-1">
                  {parsedData.errors.length} Error{parsedData.errors.length !== 1 ? 's' : ''} Detected
                </h4>
                <p className="text-sm text-red-700 mb-3">
                  The following issues were found during parsing. These records will be skipped.
                </p>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2">
              {parsedData.errors.slice(0, 5).map((error, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-red-200">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs font-semibold text-red-800">Row {error.row_number}</span>
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                      {error.error_type}
                    </span>
                  </div>
                  <p className="text-xs text-red-700">{error.error_message}</p>
                </div>
              ))}
              {parsedData.errors.length > 5 && (
                <p className="text-xs text-red-600 text-center py-2">
                  ... and {parsedData.errors.length - 5} more errors
                </p>
              )}
            </div>
          </div>
        )}

        {hasDuplicates && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-900 mb-1">
                  {parsedData.duplicates.length} Duplicate{parsedData.duplicates.length !== 1 ? 's' : ''} Found
                </h4>
                <p className="text-sm text-yellow-700">
                  Duplicate records were detected based on name and email matching. These will be excluded from import.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {parsedData.validRecords > 0 ? (
              <span className="text-green-600 font-semibold">
                {parsedData.validRecords} record{parsedData.validRecords !== 1 ? 's' : ''} ready to import
              </span>
            ) : (
              <span className="text-red-600 font-semibold">No valid records to import</span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="px-6 py-2.5 border-2 border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onAccept}
              disabled={isProcessing || parsedData.validRecords === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-jungle-green to-light-sea-green hover:from-light-sea-green hover:to-jungle-green text-white rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Import {parsedData.validRecords} Record{parsedData.validRecords !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
