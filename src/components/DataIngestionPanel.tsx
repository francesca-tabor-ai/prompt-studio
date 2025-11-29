import { useState } from 'react';
import { Upload, FileText, Link as LinkIcon, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { dataIngestionService, ParsedData, EmployeeRecord } from '../services/dataIngestionService';
import { useAuth } from '../contexts/AuthContext';
import DataPreviewPanel from './DataPreviewPanel';

type IngestionMode = 'csv' | 'text' | 'linkedin';

export default function DataIngestionPanel() {
  const { user } = useAuth();
  const [mode, setMode] = useState<IngestionMode>('csv');
  const [textInput, setTextInput] = useState('');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');

    if (file.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit');
      return;
    }

    try {
      const text = await file.text();
      const parsed = dataIngestionService.parseCSV(text);
      setParsedData(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  };

  const handleTextParse = () => {
    if (!textInput.trim()) {
      setError('Please enter some data to parse');
      return;
    }

    setError('');

    try {
      const parsed =
        mode === 'text'
          ? dataIngestionService.parseTextData(textInput)
          : dataIngestionService.parseLinkedInData(textInput);
      setParsedData(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse data');
    }
  };

  const handleAcceptData = async () => {
    if (!parsedData || !user) return;

    setIsProcessing(true);
    setError('');

    try {
      const jobId = await dataIngestionService.createIngestionJob(user.id, mode, parsedData);

      await dataIngestionService.processIngestion(jobId, parsedData.records);

      setSuccessMessage(
        `Successfully imported ${parsedData.validRecords} employee record${parsedData.validRecords !== 1 ? 's' : ''}`
      );
      setShowSuccess(true);

      setTimeout(() => {
        setShowSuccess(false);
        setParsedData(null);
        setTextInput('');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process data');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setParsedData(null);
    setTextInput('');
    setError('');
  };

  const handleExportJSON = () => {
    if (!parsedData) return;
    const json = dataIngestionService.exportToJSON(parsedData.records);
    dataIngestionService.downloadFile(json, 'employee-data.json', 'application/json');
  };

  const handleExportErrors = () => {
    if (!parsedData || parsedData.errors.length === 0) return;
    const csv = dataIngestionService.exportErrorReport(parsedData.errors);
    dataIngestionService.downloadFile(csv, 'ingestion-errors.csv', 'text/csv');
  };

  if (parsedData) {
    return (
      <div className="space-y-4">
        {parsedData.errors.length > 0 && (
          <button
            onClick={handleExportErrors}
            className="px-4 py-2 bg-white border-2 border-red-300 hover:border-red-400 text-red-700 rounded-lg font-medium flex items-center gap-2 transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            Download Error Report
          </button>
        )}

        <DataPreviewPanel
          parsedData={parsedData}
          onAccept={handleAcceptData}
          onCancel={handleCancel}
          isProcessing={isProcessing}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Data Ingestion</h3>

        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setMode('csv')}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              mode === 'csv'
                ? 'bg-gradient-to-r from-light-sea-green to-jungle-green text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Upload className="w-5 h-5" />
            CSV Upload
          </button>
          <button
            onClick={() => setMode('text')}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              mode === 'text'
                ? 'bg-gradient-to-r from-light-sea-green to-jungle-green text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-5 h-5" />
            Text Data
          </button>
          <button
            onClick={() => setMode('linkedin')}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              mode === 'linkedin'
                ? 'bg-gradient-to-r from-light-sea-green to-jungle-green text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <LinkIcon className="w-5 h-5" />
            LinkedIn Format
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-800 mb-1">Error</h4>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {showSuccess && (
          <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-green-800 mb-1">Success</h4>
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        {mode === 'csv' && (
          <div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-light-sea-green transition-all duration-200">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Upload CSV File</h4>
              <p className="text-sm text-gray-600 mb-4">
                Supports automatic format detection. Max file size: 50MB
              </p>
              <label className="inline-block">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <span className="px-6 py-3 bg-gradient-to-r from-jungle-green to-light-sea-green text-white rounded-lg font-semibold cursor-pointer hover:shadow-lg transition-all duration-200 inline-flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Choose File
                </span>
              </label>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="text-sm font-semibold text-blue-900 mb-2">CSV Format Example:</h5>
              <code className="text-xs text-blue-800 block bg-white p-3 rounded border border-blue-200">
                Full Name,Job Title,Team,Department,Email
                <br />
                John Doe,Software Engineer,Engineering,Technology,john@company.com
                <br />
                Jane Smith,Product Manager,Product,Operations,jane@company.com
              </code>
            </div>
          </div>
        )}

        {(mode === 'text' || mode === 'linkedin') && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {mode === 'text' ? 'Paste Text Data' : 'Paste LinkedIn Profile Data'}
            </label>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                mode === 'text'
                  ? 'John Doe, Software Engineer, Engineering, Technology, john@company.com\nJane Smith, Product Manager, Product, Operations, jane@company.com'
                  : 'John Doe\nSoftware Engineer\njohn@company.com\nTeam: Engineering\nDepartment: Technology\n\nJane Smith\nProduct Manager\njane@company.com\nTeam: Product\nDepartment: Operations'
              }
              rows={12}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 font-mono text-sm"
            />

            <button
              onClick={handleTextParse}
              className="mt-4 px-6 py-3 bg-gradient-to-r from-jungle-green to-light-sea-green text-white rounded-lg font-semibold hover:shadow-lg transition-all duration-200 w-full"
            >
              Parse Data
            </button>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="text-sm font-semibold text-blue-900 mb-2">
                {mode === 'text' ? 'Text Format' : 'LinkedIn Format'} Example:
              </h5>
              <code className="text-xs text-blue-800 block bg-white p-3 rounded border border-blue-200 whitespace-pre-wrap">
                {mode === 'text'
                  ? 'John Doe, Software Engineer, Engineering, Technology, john@company.com\nJane Smith, Product Manager, Product, Operations, jane@company.com\n\nSupports comma, pipe (|), or tab-separated values'
                  : 'John Doe\nSoftware Engineer\njohn@company.com\nTeam: Engineering\nDepartment: Technology\n\nJane Smith\nProduct Manager\njane@company.com\nTeam: Product\nDepartment: Operations\n\n(Separate records with blank lines)'}
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
