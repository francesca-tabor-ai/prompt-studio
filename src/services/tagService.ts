import { supabase } from '../lib/supabase';

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description: string;
  tag_type: string;
  color: string;
  is_system_tag: boolean;
  is_approved: boolean;
  created_by: string;
  visibility: string;
  usage_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TagWithMetadata extends Tag {
  aliases: string[];
  keywords: string[];
  auto_suggest_enabled: boolean;
  is_deprecated: boolean;
}

export interface TagSuggestion {
  tag: Tag;
  confidence: number;
  reason: string;
}

export interface TagHierarchy {
  parent: Tag;
  children: Tag[];
}

export class TagService {
  private static instance: TagService;

  private constructor() {}

  static getInstance(): TagService {
    if (!TagService.instance) {
      TagService.instance = new TagService();
    }
    return TagService.instance;
  }

  async getAllTags(filters?: {
    type?: string;
    visibility?: string;
    systemOnly?: boolean;
  }): Promise<Tag[]> {
    let query = supabase
      .from('tag_registry')
      .select('*')
      .eq('is_approved', true)
      .order('usage_count', { ascending: false });

    if (filters?.type) {
      query = query.eq('tag_type', filters.type);
    }

    if (filters?.visibility) {
      query = query.eq('visibility', filters.visibility);
    }

    if (filters?.systemOnly) {
      query = query.eq('is_system_tag', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []) as Tag[];
  }

  async searchTags(query: string, limit: number = 10): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('tag_registry')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .eq('is_approved', true)
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []) as Tag[];
  }

  async getTagById(id: string): Promise<TagWithMetadata | null> {
    const { data: tag, error: tagError } = await supabase
      .from('tag_registry')
      .select('*')
      .eq('id', id)
      .single();

    if (tagError) throw tagError;

    const { data: metadata, error: metadataError } = await supabase
      .from('tag_metadata_extended')
      .select('*')
      .eq('tag_id', id)
      .single();

    if (metadataError && metadataError.code !== 'PGRST116') throw metadataError;

    return {
      ...(tag as Tag),
      aliases: metadata?.aliases || [],
      keywords: metadata?.keywords || [],
      auto_suggest_enabled: metadata?.auto_suggest_enabled || false,
      is_deprecated: metadata?.is_deprecated || false,
    };
  }

  async getTagsByPromptId(promptId: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('prompt_tag_assignments')
      .select(`
        tag_id,
        tag_registry (*)
      `)
      .eq('prompt_id', promptId);

    if (error) throw error;

    return (data || []).map((item: any) => item.tag_registry as Tag);
  }

  async assignTagToPrompt(
    promptId: string,
    tagId: string,
    source: 'manual' | 'auto_suggest' | 'ai_generated' = 'manual',
    confidence?: number
  ): Promise<void> {
    const user = await this.getCurrentUser();

    const { error } = await supabase
      .from('prompt_tag_assignments')
      .insert({
        prompt_id: promptId,
        tag_id: tagId,
        assigned_by: user?.id,
        assignment_source: source,
        confidence_score: confidence,
      });

    if (error) throw error;
  }

  async removeTagFromPrompt(promptId: string, tagId: string): Promise<void> {
    const { error } = await supabase
      .from('prompt_tag_assignments')
      .delete()
      .eq('prompt_id', promptId)
      .eq('tag_id', tagId);

    if (error) throw error;
  }

  async suggestTagsForPrompt(
    promptId: string,
    content: string
  ): Promise<TagSuggestion[]> {
    const tags = await this.getAllTags();
    const suggestions: TagSuggestion[] = [];

    const contentLower = content.toLowerCase();
    const words = new Set(contentLower.split(/\s+/));

    for (const tag of tags) {
      const tagNameLower = tag.name.toLowerCase();
      const tagWords = tagNameLower.split(/\s+/);

      let matchScore = 0;

      if (contentLower.includes(tagNameLower)) {
        matchScore += 0.8;
      }

      for (const tagWord of tagWords) {
        if (words.has(tagWord)) {
          matchScore += 0.3;
        }
      }

      const { data: metadata } = await supabase
        .from('tag_metadata_extended')
        .select('keywords, auto_suggest_enabled')
        .eq('tag_id', tag.id)
        .single();

      if (metadata?.auto_suggest_enabled && metadata?.keywords) {
        for (const keyword of metadata.keywords) {
          if (contentLower.includes(keyword.toLowerCase())) {
            matchScore += 0.5;
          }
        }
      }

      if (matchScore > 0.7) {
        const confidence = Math.min(matchScore, 1.0);
        suggestions.push({
          tag,
          confidence: Math.round(confidence * 100) / 100,
          reason: this.generateSuggestionReason(tag, contentLower),
        });
      }
    }

    suggestions.sort((a, b) => b.confidence - a.confidence);

    const existingTags = await this.getTagsByPromptId(promptId);
    const existingTagIds = new Set(existingTags.map(t => t.id));

    return suggestions.filter(s => !existingTagIds.has(s.tag.id)).slice(0, 5);
  }

  private generateSuggestionReason(tag: Tag, content: string): string {
    if (content.includes(tag.name.toLowerCase())) {
      return `Content mentions "${tag.name}"`;
    }
    return `Related to ${tag.tag_type} category`;
  }

  async saveSuggestions(promptId: string, suggestions: TagSuggestion[]): Promise<void> {
    const records = suggestions.map(s => ({
      prompt_id: promptId,
      tag_id: s.tag.id,
      confidence_score: s.confidence,
    }));

    const { error } = await supabase
      .from('tag_auto_suggestions')
      .upsert(records, {
        onConflict: 'prompt_id,tag_id',
      });

    if (error) throw error;
  }

  async acceptSuggestion(promptId: string, tagId: string): Promise<void> {
    const user = await this.getCurrentUser();

    await this.assignTagToPrompt(promptId, tagId, 'auto_suggest');

    await supabase
      .from('tag_auto_suggestions')
      .update({
        is_accepted: true,
        accepted_by: user?.id,
      })
      .eq('prompt_id', promptId)
      .eq('tag_id', tagId);
  }

  async getTagHierarchy(tagId: string): Promise<TagHierarchy | null> {
    const { data: tag, error: tagError } = await supabase
      .from('tag_registry')
      .select('*')
      .eq('id', tagId)
      .single();

    if (tagError) throw tagError;

    const { data: children, error: childrenError } = await supabase
      .from('tag_hierarchies')
      .select(`
        child_tag_id,
        tag_registry!tag_hierarchies_child_tag_id_fkey (*)
      `)
      .eq('parent_tag_id', tagId)
      .eq('relationship_type', 'parent_child');

    if (childrenError) throw childrenError;

    return {
      parent: tag as Tag,
      children: (children || []).map((item: any) => item.tag_registry as Tag),
    };
  }

  async createTag(
    name: string,
    options: {
      description?: string;
      type?: string;
      color?: string;
      visibility?: string;
      keywords?: string[];
    } = {}
  ): Promise<Tag> {
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const slug = this.generateSlug(name);

    const { data, error } = await supabase
      .from('tag_registry')
      .insert({
        name,
        slug,
        description: options.description || '',
        tag_type: options.type || 'custom',
        color: options.color || '#6B7280',
        visibility: options.visibility || 'private',
        created_by: user.id,
        is_system_tag: false,
        is_approved: false,
      })
      .select()
      .single();

    if (error) throw error;

    if (options.keywords && options.keywords.length > 0) {
      await supabase
        .from('tag_metadata_extended')
        .insert({
          tag_id: data.id,
          keywords: options.keywords,
        });
    }

    await supabase.from('tag_governance_requests').insert({
      tag_id: data.id,
      action: 'create',
      requested_by: user.id,
      status: 'pending',
      request_details: { name, ...options },
    });

    return data as Tag;
  }

  async getTrendingTags(limit: number = 10): Promise<Array<Tag & { trend: string }>> {
    const { data, error } = await supabase
      .from('tag_usage_analytics')
      .select(`
        tag_id,
        trend_direction,
        usage_count,
        tag_registry (*)
      `)
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...(item.tag_registry as Tag),
      trend: item.trend_direction || 'stable',
    }));
  }

  async getTagAnalytics(tagId: string, days: number = 30): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('tag_usage_analytics')
      .select('*')
      .eq('tag_id', tagId)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .order('metric_date', { ascending: true });

    if (error) throw error;

    return data || [];
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }
}

export const tagService = TagService.getInstance();
