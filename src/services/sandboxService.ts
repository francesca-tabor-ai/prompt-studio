import { supabase } from '../lib/supabase';

export interface PromptVersion {
  id: string;
  prompt_text: string;
  scenario_id: string;
  scenario_name: string;
  version_number: number;
  created_at: string;
}

export interface TestResultData {
  id: string;
  prompt_version_id: string | null;
  test_input: string;
  test_output: string;
  accuracy: number;
  relevance: number;
  tone: number;
  consistency: number;
  created_at: string;
}

export const sandboxService = {
  async savePromptVersion(
    promptText: string,
    scenarioId: string,
    scenarioName: string
  ): Promise<PromptVersion | null> {
    const { count } = await supabase
      .from('prompt_versions')
      .select('*', { count: 'exact', head: true })
      .eq('scenario_id', scenarioId);

    const versionNumber = (count || 0) + 1;

    const { data, error } = await supabase
      .from('prompt_versions')
      .insert({
        prompt_text: promptText,
        scenario_id: scenarioId,
        scenario_name: scenarioName,
        version_number: versionNumber,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving prompt version:', error);
      return null;
    }

    return data;
  },

  async getPromptVersions(scenarioId?: string): Promise<PromptVersion[]> {
    let query = supabase
      .from('prompt_versions')
      .select('*')
      .order('created_at', { ascending: false });

    if (scenarioId) {
      query = query.eq('scenario_id', scenarioId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching prompt versions:', error);
      return [];
    }

    return data || [];
  },

  async saveTestResult(
    promptVersionId: string | null,
    testInput: string,
    testOutput: string,
    metrics: {
      accuracy: number;
      relevance: number;
      tone: number;
      consistency: number;
    }
  ): Promise<TestResultData | null> {
    const { data, error } = await supabase
      .from('test_results')
      .insert({
        prompt_version_id: promptVersionId,
        test_input: testInput,
        test_output: testOutput,
        accuracy: metrics.accuracy,
        relevance: metrics.relevance,
        tone: metrics.tone,
        consistency: metrics.consistency,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving test result:', error);
      return null;
    }

    return data;
  },

  async getTestResults(promptVersionId?: string): Promise<TestResultData[]> {
    let query = supabase
      .from('test_results')
      .select('*')
      .order('created_at', { ascending: false });

    if (promptVersionId) {
      query = query.eq('prompt_version_id', promptVersionId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching test results:', error);
      return [];
    }

    return data || [];
  },

  async getLatestPromptVersion(scenarioId: string): Promise<PromptVersion | null> {
    const { data, error } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('scenario_id', scenarioId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching latest prompt version:', error);
      return null;
    }

    return data;
  },

  async deletePromptVersion(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('prompt_versions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting prompt version:', error);
      return false;
    }

    return true;
  },
};
