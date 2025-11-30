import { supabase } from '../lib/supabase';

export interface TaskGenerationRequest {
  roleTitle: string;
  department?: string;
  teamContext?: string;
  additionalRequirements?: string[];
  numSuggestions?: number;
}

export interface SuggestedTask {
  id: string;
  suggestionNumber: number;
  taskName: string;
  taskDescription: string;
  typicalFrequency: string;
  priorityTags: string[];
  estimatedTimeMinutes: number;
  confidenceScore: number;
  reasoning: string;
  wasAccepted?: boolean;
  wasModified?: boolean;
}

export interface TaskGenerationResponse {
  requestId: string;
  roleTitle: string;
  suggestions: SuggestedTask[];
  usedTemplate: boolean;
  processingTime: number;
}

export class AITaskGenerator {
  private static instance: AITaskGenerator;

  private constructor() {}

  static getInstance(): AITaskGenerator {
    if (!AITaskGenerator.instance) {
      AITaskGenerator.instance = new AITaskGenerator();
    }
    return AITaskGenerator.instance;
  }

  async generateTasks(request: TaskGenerationRequest): Promise<TaskGenerationResponse> {
    const startTime = Date.now();
    const user = await this.getCurrentUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: requestRecord, error: requestError } = await supabase
      .from('ai_task_generation_requests')
      .insert({
        user_id: user.id,
        role_title: request.roleTitle,
        department: request.department,
        team_context: request.teamContext,
        additional_requirements: request.additionalRequirements || [],
        num_suggestions: request.numSuggestions || 7,
        status: 'processing',
      })
      .select()
      .single();

    if (requestError) throw requestError;

    try {
      const templates = await this.getTemplatesForRole(request.roleTitle, request.department);
      const knowledgeBaseTasks = await this.getKnowledgeBaseTasks(
        request.roleTitle,
        request.department
      );

      let suggestions: any[] = [];
      let usedTemplate = false;

      if (templates.length >= (request.numSuggestions || 7)) {
        suggestions = templates.slice(0, request.numSuggestions || 7);
        usedTemplate = true;
      } else {
        suggestions = [
          ...templates,
          ...knowledgeBaseTasks.slice(0, (request.numSuggestions || 7) - templates.length),
        ];

        if (suggestions.length < (request.numSuggestions || 7)) {
          const aiGenerated = await this.generateWithAI(
            request,
            (request.numSuggestions || 7) - suggestions.length
          );
          suggestions = [...suggestions, ...aiGenerated];
        }
      }

      const taskRecords = [];
      for (let i = 0; i < suggestions.length; i++) {
        const task = suggestions[i];
        const { data: taskRecord } = await supabase
          .from('ai_suggested_tasks')
          .insert({
            request_id: requestRecord.id,
            suggestion_number: i + 1,
            task_name: task.taskName || task.task_name,
            task_description: task.taskDescription || task.task_description,
            typical_frequency: task.typicalFrequency || task.typical_frequency || 'as_needed',
            priority_tags: task.priorityTags || task.tags || [],
            estimated_time_minutes: task.estimatedTimeMinutes || task.estimated_time_minutes || 30,
            confidence_score: task.confidenceScore || task.confidence_score || 75,
            reasoning: task.reasoning || `Template-based suggestion for ${request.roleTitle}`,
          })
          .select()
          .single();

        taskRecords.push(taskRecord);
      }

      const processingTime = Date.now() - startTime;

      await supabase
        .from('ai_task_generation_requests')
        .update({
          status: 'completed',
          total_suggestions: suggestions.length,
          processing_time_ms: processingTime,
          used_template: usedTemplate,
          completed_at: new Date().toISOString(),
        })
        .eq('id', requestRecord.id);

      return {
        requestId: requestRecord.id,
        roleTitle: request.roleTitle,
        suggestions: taskRecords as SuggestedTask[],
        usedTemplate,
        processingTime,
      };
    } catch (error: any) {
      await supabase
        .from('ai_task_generation_requests')
        .update({
          status: 'failed',
        })
        .eq('id', requestRecord.id);

      throw error;
    }
  }

  private async getTemplatesForRole(roleTitle: string, department?: string): Promise<any[]> {
    let query = supabase
      .from('role_task_templates')
      .select('*')
      .eq('role_title', roleTitle)
      .order('usage_count', { ascending: false });

    if (department) {
      query = query.eq('department', department);
    }

    const { data } = await query;
    return data || [];
  }

  private async getKnowledgeBaseTasks(roleTitle: string, department?: string): Promise<any[]> {
    const normalizedRole = this.normalizeRole(roleTitle);

    let query = supabase
      .from('role_task_knowledge_base')
      .select('*')
      .eq('normalized_role', normalizedRole)
      .gt('confirmation_count', 0)
      .order('confidence_score', { ascending: false });

    if (department) {
      query = query.eq('department', department);
    }

    const { data } = await query.limit(5);
    return data || [];
  }

  private async generateWithAI(
    request: TaskGenerationRequest,
    numNeeded: number
  ): Promise<any[]> {
    const mockTasks = [
      {
        taskName: `${request.roleTitle} Strategy Planning`,
        taskDescription: `Develop and execute strategic plans for ${request.roleTitle} initiatives`,
        typicalFrequency: 'monthly',
        priorityTags: ['Strategic', 'High Impact'],
        estimatedTimeMinutes: 120,
        confidenceScore: 70,
        reasoning: 'AI-generated based on role requirements',
      },
      {
        taskName: `Team Collaboration for ${request.roleTitle}`,
        taskDescription: `Work with cross-functional teams to achieve objectives`,
        typicalFrequency: 'weekly',
        priorityTags: ['Operational'],
        estimatedTimeMinutes: 60,
        confidenceScore: 68,
        reasoning: 'Common collaborative task across roles',
      },
      {
        taskName: `Performance Reporting`,
        taskDescription: `Track and report on key performance metrics`,
        typicalFrequency: 'weekly',
        priorityTags: ['Operational', 'Frequent'],
        estimatedTimeMinutes: 45,
        confidenceScore: 65,
        reasoning: 'Standard reporting requirement',
      },
    ];

    return mockTasks.slice(0, numNeeded);
  }

  async acceptTask(taskId: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const { data: task } = await supabase
      .from('ai_suggested_tasks')
      .select('*, ai_task_generation_requests(role_title, department)')
      .eq('id', taskId)
      .single();

    if (!task) throw new Error('Task not found');

    await supabase
      .from('ai_suggested_tasks')
      .update({ was_accepted: true })
      .eq('id', taskId);

    await supabase.from('task_modification_history').insert({
      suggested_task_id: taskId,
      user_id: user.id,
      modification_type: 'accept',
    });

    await this.learnFromAcceptance(task);
  }

  async rejectTask(taskId: string, reason?: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const { data: task } = await supabase
      .from('ai_suggested_tasks')
      .select('*, ai_task_generation_requests(role_title, department)')
      .eq('id', taskId)
      .single();

    if (!task) throw new Error('Task not found');

    await supabase
      .from('ai_suggested_tasks')
      .update({
        was_removed: true,
        user_feedback: reason,
      })
      .eq('id', taskId);

    await supabase.from('task_modification_history').insert({
      suggested_task_id: taskId,
      user_id: user.id,
      modification_type: 'reject',
      reasoning: reason,
    });

    await this.learnFromRejection(task);
  }

  async modifyTask(
    taskId: string,
    modifications: {
      taskName?: string;
      taskDescription?: string;
      typicalFrequency?: string;
      priorityTags?: string[];
      estimatedTimeMinutes?: number;
    }
  ): Promise<SuggestedTask> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const { data: task } = await supabase
      .from('ai_suggested_tasks')
      .select('*, ai_task_generation_requests(role_title, department)')
      .eq('id', taskId)
      .single();

    if (!task) throw new Error('Task not found');

    const updates: any = { was_modified: true };

    if (modifications.taskName) {
      updates.final_task_name = modifications.taskName;
      await this.logModification(taskId, user.id, 'edit', 'task_name', task.task_name, modifications.taskName);
    }

    if (modifications.taskDescription) {
      updates.final_description = modifications.taskDescription;
      await this.logModification(taskId, user.id, 'edit', 'description', task.task_description, modifications.taskDescription);
    }

    if (modifications.typicalFrequency) {
      updates.typical_frequency = modifications.typicalFrequency;
    }

    if (modifications.priorityTags) {
      updates.priority_tags = modifications.priorityTags;
    }

    if (modifications.estimatedTimeMinutes) {
      updates.estimated_time_minutes = modifications.estimatedTimeMinutes;
    }

    const { data: updated } = await supabase
      .from('ai_suggested_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    await this.learnFromModification(updated as any);

    return updated as SuggestedTask;
  }

  private async learnFromAcceptance(task: any): Promise<void> {
    const normalizedRole = this.normalizeRole(task.ai_task_generation_requests.role_title);
    const dept = task.ai_task_generation_requests.department;

    await supabase
      .from('role_task_knowledge_base')
      .upsert({
        role_title: task.ai_task_generation_requests.role_title,
        normalized_role: normalizedRole,
        department: dept,
        task_name: task.final_task_name || task.task_name,
        task_description: task.final_description || task.task_description,
        frequency: task.typical_frequency,
        priority_tags: task.priority_tags,
        source_type: 'user_confirmed',
        confirmation_count: 1,
        confidence_score: Math.min((task.confidence_score || 70) + 5, 100),
      }, {
        onConflict: 'normalized_role,task_name',
      });
  }

  private async learnFromRejection(task: any): Promise<void> {
    const normalizedRole = this.normalizeRole(task.ai_task_generation_requests.role_title);

    const { data: existing } = await supabase
      .from('role_task_knowledge_base')
      .select('*')
      .eq('normalized_role', normalizedRole)
      .eq('task_name', task.task_name)
      .single();

    if (existing) {
      await supabase
        .from('role_task_knowledge_base')
        .update({
          rejection_count: (existing.rejection_count || 0) + 1,
          confidence_score: Math.max((existing.confidence_score || 70) - 10, 0),
        })
        .eq('id', existing.id);
    }
  }

  private async learnFromModification(task: any): Promise<void> {
    const normalizedRole = this.normalizeRole(task.ai_task_generation_requests.role_title);

    const { data: existing } = await supabase
      .from('role_task_knowledge_base')
      .select('*')
      .eq('normalized_role', normalizedRole)
      .eq('task_name', task.task_name)
      .single();

    if (existing) {
      await supabase
        .from('role_task_knowledge_base')
        .update({
          modification_count: (existing.modification_count || 0) + 1,
          confidence_score: Math.max((existing.confidence_score || 70) - 2, 50),
        })
        .eq('id', existing.id);
    }
  }

  private async logModification(
    taskId: string,
    userId: string,
    type: string,
    field: string,
    oldValue: string,
    newValue: string
  ): Promise<void> {
    await supabase.from('task_modification_history').insert({
      suggested_task_id: taskId,
      user_id: userId,
      modification_type: type,
      field_modified: field,
      original_value: oldValue,
      new_value: newValue,
    });
  }

  async getTasksByRequest(requestId: string): Promise<SuggestedTask[]> {
    const { data } = await supabase
      .from('ai_suggested_tasks')
      .select('*')
      .eq('request_id', requestId)
      .order('suggestion_number');

    return (data || []) as SuggestedTask[];
  }

  async getTemplates(roleTitle?: string, department?: string): Promise<any[]> {
    let query = supabase
      .from('role_task_templates')
      .select('*')
      .order('usage_count', { ascending: false });

    if (roleTitle) {
      query = query.eq('role_title', roleTitle);
    }

    if (department) {
      query = query.eq('department', department);
    }

    const { data } = await query;
    return data || [];
  }

  async getPriorityTags(): Promise<any[]> {
    const { data } = await supabase
      .from('task_priority_tags')
      .select('*')
      .order('tag_category');

    return data || [];
  }

  private normalizeRole(role: string): string {
    return role.toLowerCase().replace(/\s+/g, '_');
  }

  private async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  async getUserGenerationHistory(userId: string, limit: number = 10): Promise<any[]> {
    const { data } = await supabase
      .from('ai_task_generation_requests')
      .select('*, ai_suggested_tasks(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }
}

export const aiTaskGenerator = AITaskGenerator.getInstance();
