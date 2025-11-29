import { Upload, FileText, Users } from 'lucide-react';
import { useState } from 'react';

interface ParsedEmployee {
  name: string;
  role: string;
  team: string;
  department: string;
}

interface DataUploadPanelProps {
  onDataParsed: (employees: ParsedEmployee[]) => void;
}

export default function DataUploadPanel({ onDataParsed }: DataUploadPanelProps) {
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedEmployee[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const parseEmployeeData = (text: string): ParsedEmployee[] => {
    const lines = text.split('\n').filter((line) => line.trim());
    const employees: ParsedEmployee[] = [];

    lines.forEach((line) => {
      if (line.includes(',')) {
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length >= 4) {
          employees.push({
            name: parts[0],
            role: parts[1],
            team: parts[2],
            department: parts[3],
          });
        }
      } else if (line.includes('|')) {
        const parts = line.split('|').map((p) => p.trim());
        if (parts.length >= 4) {
          employees.push({
            name: parts[0],
            role: parts[1],
            team: parts[2],
            department: parts[3],
          });
        }
      } else if (line.includes('\t')) {
        const parts = line.split('\t').map((p) => p.trim());
        if (parts.length >= 4) {
          employees.push({
            name: parts[0],
            role: parts[1],
            team: parts[2],
            department: parts[3],
          });
        }
      }
    });

    return employees;
  };

  const handleParse = () => {
    const parsed = parseEmployeeData(inputText);
    setParsedData(parsed);
    setShowPreview(true);
  };

  const handleConfirm = () => {
    onDataParsed(parsedData);
    setInputText('');
    setParsedData([]);
    setShowPreview(false);
  };

  const handleLoadSample = () => {
    const sampleData = `Sarah Johnson, Senior Software Engineer, Backend Team, Engineering
Michael Chen, Product Manager, Product Strategy, Product
Emily Rodriguez, Data Analyst, Analytics Team, Data & Insights
James Wilson, Frontend Developer, UI Team, Engineering
Lisa Anderson, Marketing Manager, Brand Team, Marketing
David Thompson, DevOps Engineer, Infrastructure, Engineering
Jessica Brown, UX Designer, Design Team, Product
Robert Martinez, Sales Director, Enterprise Sales, Sales
Amanda Lee, HR Manager, Talent Acquisition, Human Resources
Christopher Davis, Customer Success Manager, Support Team, Customer Success`;
    setInputText(sampleData);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-space-cadet to-yale-blue">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl text-white">DATA INPUT</h3>
                <p className="text-sm text-white/80">Import employee data from CSV or text</p>
              </div>
            </div>
            <button
              onClick={handleLoadSample}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 text-sm font-medium flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Load Sample
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Employee Data (Name, Role, Team, Department)
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste employee data here (CSV, tab-separated, or pipe-separated)&#10;&#10;Example:&#10;John Doe, Software Engineer, Platform Team, Engineering&#10;Jane Smith, Product Manager, Product Team, Product"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 resize-none text-sm font-mono"
              rows={12}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleParse}
              disabled={!inputText.trim()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-jungle-green to-light-sea-green hover:from-light-sea-green hover:to-jungle-green text-white rounded-lg transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Users className="w-5 h-5" />
              Parse Data
            </button>
          </div>

          <div className="bg-gradient-to-r from-light-sea-green/10 to-green-yellow/10 rounded-lg p-4 border border-light-sea-green/20">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Supported Formats</h4>
            <ul className="space-y-1 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-light-sea-green font-bold">•</span>
                <span>CSV: Name, Role, Team, Department</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-light-sea-green font-bold">•</span>
                <span>Tab-separated values</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-light-sea-green font-bold">•</span>
                <span>Pipe-separated: Name | Role | Team | Department</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {showPreview && parsedData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">AI Parsing Preview</h3>
                <p className="text-sm text-gray-600">{parsedData.length} employees detected</p>
              </div>
              <button
                onClick={handleConfirm}
                className="px-6 py-2 bg-gradient-to-r from-jungle-green to-light-sea-green hover:from-light-sea-green hover:to-jungle-green text-white rounded-lg transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
              >
                Confirm & Import
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Role</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Team</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Department</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((employee, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">{employee.name}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{employee.role}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{employee.team}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{employee.department}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
