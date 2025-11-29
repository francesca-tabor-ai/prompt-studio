import { supabase } from '../lib/supabase';

export interface Employee {
  id: string;
  name: string;
  role: string;
  team: string;
  department: string;
  created_at: string;
}

export interface Task {
  id: string;
  department: string;
  team: string;
  role: string;
  task_name: string;
  priority: 'high' | 'medium' | 'low';
  created_at: string;
}

export interface RolePrompt {
  id: string;
  department: string;
  team: string;
  role: string;
  task_id: string | null;
  prompt_text: string;
  is_active: boolean;
  created_at: string;
}

export const enterpriseService = {
  async addEmployees(employees: Omit<Employee, 'id' | 'created_at'>[]): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .insert(employees)
      .select();

    if (error) {
      console.error('Error adding employees:', error);
      return [];
    }

    return data || [];
  },

  async getEmployees(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('department', { ascending: true });

    if (error) {
      console.error('Error fetching employees:', error);
      return [];
    }

    return data || [];
  },

  async deleteAllEmployees(): Promise<boolean> {
    const { error } = await supabase
      .from('employees')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('Error deleting employees:', error);
      return false;
    }

    return true;
  },

  async addTasks(tasks: Omit<Task, 'id' | 'created_at'>[]): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .insert(tasks)
      .select();

    if (error) {
      console.error('Error adding tasks:', error);
      return [];
    }

    return data || [];
  },

  async getTasks(): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('priority', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }

    return data || [];
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating task:', error);
      return null;
    }

    return data;
  },

  async deleteTask(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task:', error);
      return false;
    }

    return true;
  },

  async addRolePrompts(prompts: Omit<RolePrompt, 'id' | 'created_at'>[]): Promise<RolePrompt[]> {
    const { data, error } = await supabase
      .from('role_prompts')
      .insert(prompts)
      .select();

    if (error) {
      console.error('Error adding role prompts:', error);
      return [];
    }

    return data || [];
  },

  async getRolePrompts(): Promise<RolePrompt[]> {
    const { data, error } = await supabase
      .from('role_prompts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching role prompts:', error);
      return [];
    }

    return data || [];
  },

  async getOrganizationalSummary() {
    const employees = await this.getEmployees();
    const tasks = await this.getTasks();

    const deptMap = new Map<string, Map<string, Map<string, number>>>();

    employees.forEach((emp) => {
      if (!deptMap.has(emp.department)) {
        deptMap.set(emp.department, new Map());
      }
      const teamMap = deptMap.get(emp.department)!;

      if (!teamMap.has(emp.team)) {
        teamMap.set(emp.team, new Map());
      }
      const roleMap = teamMap.get(emp.team)!;

      roleMap.set(emp.role, (roleMap.get(emp.role) || 0) + 1);
    });

    const summary: {
      department: string;
      team: string;
      role: string;
      employeeCount: number;
      keyTasks: string[];
    }[] = [];

    deptMap.forEach((teamMap, department) => {
      teamMap.forEach((roleMap, team) => {
        roleMap.forEach((count, role) => {
          const roleTasks = tasks
            .filter((t) => t.department === department && t.team === team && t.role === role)
            .map((t) => t.task_name);

          summary.push({
            department,
            team,
            role,
            employeeCount: count,
            keyTasks: roleTasks,
          });
        });
      });
    });

    return summary;
  },
};
