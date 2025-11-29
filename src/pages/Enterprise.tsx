import { useState, useEffect } from 'react';
import { CheckCircle, Loader } from 'lucide-react';
import DataUploadPanel from '../components/DataUploadPanel';
import OrganizationalTable from '../components/OrganizationalTable';
import TaskManager from '../components/TaskManager';
import PromptPreviewPanel from '../components/PromptPreviewPanel';
import OrgChart from '../components/OrgChart';
import { enterpriseService, Task } from '../services/enterpriseService';

interface GeneratedPrompt {
  taskId: string;
  department: string;
  team: string;
  role: string;
  taskName: string;
  prompt: string;
}

export default function Enterprise() {
  const [orgSummary, setOrgSummary] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [generatedPrompts, setGeneratedPrompts] = useState<GeneratedPrompt[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const summary = await enterpriseService.getOrganizationalSummary();
    const taskData = await enterpriseService.getTasks();
    setOrgSummary(summary);
    setTasks(taskData);
    setIsLoading(false);
  };

  const handleDataParsed = async (employees: any[]) => {
    await enterpriseService.deleteAllEmployees();
    await enterpriseService.addEmployees(employees);
    await loadData();
    setSuccessMessage(`Successfully imported ${employees.length} employees`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleGenerateTasks = async (department: string, team: string, role: string) => {
    const suggestedTasks = generateTaskSuggestions(role);
    const newTasks = suggestedTasks.map((task) => ({
      department,
      team,
      role,
      task_name: task.name,
      priority: task.priority as 'high' | 'medium' | 'low',
    }));

    await enterpriseService.addTasks(newTasks);
    await loadData();
    setSuccessMessage(`Generated ${suggestedTasks.length} tasks for ${role}`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const generateTaskSuggestions = (role: string) => {
    const roleLower = role.toLowerCase();

    if (roleLower.includes('engineer') || roleLower.includes('developer')) {
      return [
        { name: 'Write and review code for new features', priority: 'high' },
        { name: 'Debug and fix production issues', priority: 'high' },
        { name: 'Participate in code reviews', priority: 'medium' },
        { name: 'Write technical documentation', priority: 'medium' },
        { name: 'Mentor junior team members', priority: 'low' },
      ];
    } else if (roleLower.includes('manager')) {
      return [
        { name: 'Conduct team meetings and standups', priority: 'high' },
        { name: 'Review team performance and provide feedback', priority: 'high' },
        { name: 'Coordinate with other departments', priority: 'medium' },
        { name: 'Plan sprint goals and deliverables', priority: 'medium' },
        { name: 'Handle budget and resource allocation', priority: 'low' },
      ];
    } else if (roleLower.includes('designer')) {
      return [
        { name: 'Create mockups and prototypes', priority: 'high' },
        { name: 'Conduct user research and testing', priority: 'high' },
        { name: 'Collaborate with developers on implementation', priority: 'medium' },
        { name: 'Maintain design system and guidelines', priority: 'medium' },
        { name: 'Present designs to stakeholders', priority: 'low' },
      ];
    } else if (roleLower.includes('analyst')) {
      return [
        { name: 'Analyze data and generate insights', priority: 'high' },
        { name: 'Create reports and dashboards', priority: 'high' },
        { name: 'Identify trends and patterns', priority: 'medium' },
        { name: 'Collaborate with teams on data requirements', priority: 'medium' },
        { name: 'Maintain data quality and accuracy', priority: 'low' },
      ];
    } else if (roleLower.includes('sales')) {
      return [
        { name: 'Reach out to potential clients', priority: 'high' },
        { name: 'Conduct product demos and presentations', priority: 'high' },
        { name: 'Negotiate contracts and close deals', priority: 'medium' },
        { name: 'Maintain client relationships', priority: 'medium' },
        { name: 'Update CRM and track pipeline', priority: 'low' },
      ];
    } else {
      return [
        { name: 'Complete daily operational tasks', priority: 'high' },
        { name: 'Collaborate with team members', priority: 'medium' },
        { name: 'Attend meetings and provide updates', priority: 'medium' },
        { name: 'Document processes and workflows', priority: 'low' },
        { name: 'Contribute to team improvement initiatives', priority: 'low' },
      ];
    }
  };

  const handleAddTask = async (task: Omit<Task, 'id' | 'created_at'>) => {
    await enterpriseService.addTasks([task]);
    await loadData();
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    await enterpriseService.updateTask(id, updates);
    await loadData();
  };

  const handleDeleteTask = async (id: string) => {
    await enterpriseService.deleteTask(id);
    await loadData();
  };

  const handleGeneratePrompts = () => {
    const prompts: GeneratedPrompt[] = tasks.map((task) => ({
      taskId: task.id,
      department: task.department,
      team: task.team,
      role: task.role,
      taskName: task.task_name,
      prompt: generatePromptForTask(task),
    }));

    setGeneratedPrompts(prompts);
    setSuccessMessage(`Generated ${prompts.length} prompts`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const generatePromptForTask = (task: Task): string => {
    return `You are an AI assistant helping a ${task.role} in the ${task.team} team of the ${task.department} department.

Task: ${task.task_name}
Priority: ${task.priority.toUpperCase()}

Your role is to:
1. Provide expert guidance and best practices for completing this task
2. Offer step-by-step instructions when appropriate
3. Suggest tools, frameworks, or methodologies that would be helpful
4. Anticipate common challenges and provide solutions
5. Ensure the output aligns with ${task.department} department standards

Guidelines:
- Maintain a professional and supportive tone
- Provide actionable advice that can be implemented immediately
- Consider the context of the ${task.team} team's objectives
- Prioritize efficiency and quality in your recommendations
- Be specific and avoid generic advice

When responding to queries about this task, focus on practical solutions that help the ${task.role} achieve their goals effectively.`;
  };

  const handleSaveToLibrary = async () => {
    const promptsToSave = generatedPrompts.map((p) => ({
      department: p.department,
      team: p.team,
      role: p.role,
      task_id: p.taskId,
      prompt_text: p.prompt,
      is_active: true,
    }));

    await enterpriseService.addRolePrompts(promptsToSave);
    setSuccessMessage(`Saved ${promptsToSave.length} prompts to library`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-8 py-4">
          <div>
            <h1 className="text-2xl text-space-cadet font-bebas tracking-wide">ENTERPRISE PROMPT MAPPING</h1>
            <p className="text-sm text-gray-600">
              Import employees, define organizational structure, and generate role-based prompts
            </p>
          </div>
        </div>
      </header>

      {showSuccess && (
        <div className="fixed top-20 right-8 z-50 animate-in slide-in-from-top">
          <div className="bg-green-50 border-2 border-green-200 rounded-xl px-6 py-4 shadow-xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-green-800">{successMessage}</span>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 shadow-2xl flex items-center gap-4">
            <Loader className="w-8 h-8 text-light-sea-green animate-spin" />
            <span className="text-lg font-semibold text-gray-900">Loading data...</span>
          </div>
        </div>
      )}

      <main className="p-8">
        <div className="space-y-8">
          <DataUploadPanel onDataParsed={handleDataParsed} />

          <OrganizationalTable data={orgSummary} onGenerateTasks={handleGenerateTasks} />

          <div className="grid grid-cols-2 gap-8">
            <TaskManager
              tasks={tasks}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
            />

            <PromptPreviewPanel
              tasks={tasks}
              generatedPrompts={generatedPrompts}
              onGeneratePrompts={handleGeneratePrompts}
              onSaveToLibrary={handleSaveToLibrary}
            />
          </div>

          <OrgChart data={orgSummary} />
        </div>
      </main>
    </div>
  );
}
