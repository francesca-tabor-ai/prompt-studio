import { Plus, Edit2, Trash2, AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { useState } from 'react';
import { Task } from '../services/enterpriseService';

interface TaskManagerProps {
  tasks: Task[];
  onAddTask: (task: Omit<Task, 'id' | 'created_at'>) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
}

export default function TaskManager({ tasks, onAddTask, onUpdateTask, onDeleteTask }: TaskManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    department: '',
    team: '',
    role: '',
    task_name: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
  });
  const [editTask, setEditTask] = useState<Task | null>(null);

  const handleAddTask = () => {
    if (newTask.task_name.trim()) {
      onAddTask(newTask);
      setNewTask({
        department: '',
        team: '',
        role: '',
        task_name: '',
        priority: 'medium',
      });
      setIsAdding(false);
    }
  };

  const handleEditTask = () => {
    if (editTask && editingId) {
      onUpdateTask(editingId, {
        task_name: editTask.task_name,
        priority: editTask.priority,
      });
      setEditingId(null);
      setEditTask(null);
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'medium':
        return <Circle className="w-4 h-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const groupedTasks = tasks.reduce((acc, task) => {
    const key = `${task.department}|${task.team}|${task.role}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-yellow to-jungle-green">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl text-white">TASK MANAGEMENT</h3>
            <p className="text-sm text-white/80">{tasks.length} tasks across all roles</p>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {isAdding && (
          <div className="bg-gradient-to-r from-light-sea-green/10 to-green-yellow/10 rounded-lg p-4 border-2 border-light-sea-green/30">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Add New Task</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                type="text"
                placeholder="Department"
                value={newTask.department}
                onChange={(e) => setNewTask({ ...newTask, department: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green text-sm"
              />
              <input
                type="text"
                placeholder="Team"
                value={newTask.team}
                onChange={(e) => setNewTask({ ...newTask, team: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green text-sm"
              />
              <input
                type="text"
                placeholder="Role"
                value={newTask.role}
                onChange={(e) => setNewTask({ ...newTask, role: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green text-sm"
              />
              <select
                value={newTask.priority}
                onChange={(e) =>
                  setNewTask({ ...newTask, priority: e.target.value as 'high' | 'medium' | 'low' })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green text-sm"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="Task name"
              value={newTask.task_name}
              onChange={(e) => setNewTask({ ...newTask, task_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-light-sea-green text-sm mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddTask}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-jungle-green to-light-sea-green text-white rounded-lg font-medium text-sm"
              >
                Add Task
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {Object.keys(groupedTasks).length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">No Tasks Yet</h4>
            <p className="text-sm text-gray-600">Add tasks manually or generate them from roles</p>
          </div>
        ) : (
          Object.entries(groupedTasks).map(([key, roleTasks]) => {
            const [department, team, role] = key.split('|');
            return (
              <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-space-cadet/5 p-3 border-b border-gray-200">
                  <div className="text-sm font-semibold text-gray-900">
                    {department} → {team} → {role}
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {roleTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-200"
                    >
                      {editingId === task.id ? (
                        <div className="flex-1 flex items-center gap-3">
                          <input
                            type="text"
                            value={editTask?.task_name || ''}
                            onChange={(e) =>
                              setEditTask(editTask ? { ...editTask, task_name: e.target.value } : null)
                            }
                            className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                          />
                          <select
                            value={editTask?.priority || 'medium'}
                            onChange={(e) =>
                              setEditTask(
                                editTask
                                  ? { ...editTask, priority: e.target.value as 'high' | 'medium' | 'low' }
                                  : null
                              )
                            }
                            className="px-3 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                          <button
                            onClick={handleEditTask}
                            className="px-3 py-1 bg-jungle-green text-white rounded text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditTask(null);
                            }}
                            className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 flex-1">
                            {getPriorityIcon(task.priority)}
                            <span className="text-sm text-gray-900">{task.task_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(
                                task.priority
                              )}`}
                            >
                              {task.priority}
                            </span>
                            <button
                              onClick={() => {
                                setEditingId(task.id);
                                setEditTask(task);
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <Edit2 className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => onDeleteTask(task.id)}
                              className="p-1 hover:bg-red-100 rounded"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
