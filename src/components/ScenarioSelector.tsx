import { Workflow, ChevronDown } from 'lucide-react';

export interface Scenario {
  id: string;
  name: string;
  description: string;
  category: string;
  testCases: string[];
}

interface ScenarioSelectorProps {
  scenarios: Scenario[];
  selectedScenario: Scenario | null;
  onSelect: (scenario: Scenario) => void;
}

export default function ScenarioSelector({ scenarios, selectedScenario, onSelect }: ScenarioSelectorProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-space-cadet to-yale-blue rounded-lg flex items-center justify-center">
          <Workflow className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Workflow Simulation</h3>
          <p className="text-sm text-gray-600">Select a scenario to test</p>
        </div>
      </div>

      <div className="relative">
        <select
          value={selectedScenario?.id || ''}
          onChange={(e) => {
            const scenario = scenarios.find(s => s.id === e.target.value);
            if (scenario) onSelect(scenario);
          }}
          className="w-full px-4 py-3 pr-10 bg-gray-50 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 text-sm font-medium appearance-none cursor-pointer"
        >
          <option value="">Select a workflow scenario...</option>
          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.name} - {scenario.category}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
      </div>

      {selectedScenario && (
        <div className="mt-4 p-4 bg-light-sea-green/5 rounded-lg border border-light-sea-green/20">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">{selectedScenario.name}</h4>
          <p className="text-sm text-gray-700 mb-3">{selectedScenario.description}</p>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600 uppercase">Test Cases:</p>
            {selectedScenario.testCases.map((testCase, index) => (
              <div key={index} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-light-sea-green font-bold">{index + 1}.</span>
                <span>{testCase}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
