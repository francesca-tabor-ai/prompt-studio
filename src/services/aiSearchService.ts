import { supabase } from '../lib/supabase';

export interface AISearchQuery {
  query: string;
  filters?: {
    role?: string;
    department?: string;
    category?: string[];
    status?: string;
  };
  limit?: number;
  useSemanticSearch?: boolean;
}

export interface AISearchResult {
  id: string;
  title: string;
  content: string;
  role?: string;
  department?: string;
  category: string[];
  relevanceScore: number;
  rankPosition: number;
}

export interface Recommendation {
  id: string;
  promptId: string;
  type: string;
  score: number;
  reasoning: any;
  prompt?: any;
}

export class AISearchService {
  private static instance: AISearchService;
  private sessionId: string;

  private constructor() {
    this.sessionId = this.generateSessionId();
  }

  static getInstance(): AISearchService {
    if (!AISearchService.instance) {
      AISearchService.instance = new AISearchService();
    }
    return AISearchService.instance;
  }

  async search(searchQuery: AISearchQuery): Promise<{
    results: AISearchResult[];
    queryId: string;
    suggestions?: string[];
  }> {
    const user = await this.getCurrentUser();
    const normalizedQuery = this.normalizeQuery(searchQuery.query);

    const queryEmbedding = searchQuery.useSemanticSearch
      ? await this.generateEmbedding(searchQuery.query)
      : null;

    let results: AISearchResult[] = [];

    if (queryEmbedding && searchQuery.useSemanticSearch) {
      results = await this.semanticSearch(queryEmbedding, searchQuery);
    } else {
      results = await this.keywordSearch(normalizedQuery, searchQuery);
    }

    const { data: queryRecord } = await supabase
      .from('search_queries')
      .insert({
        user_id: user?.id,
        query_text: searchQuery.query,
        normalized_query: normalizedQuery,
        query_embedding: queryEmbedding,
        search_type: searchQuery.useSemanticSearch ? 'semantic' : 'keyword',
        filters: searchQuery.filters || {},
        results_count: results.length,
        session_id: this.sessionId,
      })
      .select()
      .single();

    await this.updateAutocomplete(searchQuery.query);

    const didYouMean = results.length === 0 ? await this.getDidYouMeanSuggestion(searchQuery.query) : null;

    return {
      results,
      queryId: queryRecord?.id || '',
      suggestions: didYouMean ? [didYouMean] : undefined,
    };
  }

  private async semanticSearch(
    embedding: number[],
    searchQuery: AISearchQuery
  ): Promise<AISearchResult[]> {
    const { data: similarPrompts } = await supabase
      .from('prompt_embeddings')
      .select('prompt_id, embedding')
      .limit(100);

    if (!similarPrompts) {
      return this.keywordSearch(searchQuery.query, searchQuery);
    }

    const scores = similarPrompts.map(p => ({
      promptId: p.prompt_id,
      score: this.cosineSimilarity(embedding, p.embedding),
    }))
      .filter(s => s.score >= 0.7)
      .sort((a, b) => b.score - a.score)
      .slice(0, searchQuery.limit || 10);

    if (scores.length === 0) {
      return this.keywordSearch(searchQuery.query, searchQuery);
    }

    const promptIds = scores.map(s => s.promptId);
    let query = supabase
      .from('prompts')
      .select('*')
      .in('id', promptIds);

    if (searchQuery.filters?.role) {
      query = query.eq('role', searchQuery.filters.role);
    }

    if (searchQuery.filters?.department) {
      query = query.eq('department', searchQuery.filters.department);
    }

    if (searchQuery.filters?.status) {
      query = query.eq('status', searchQuery.filters.status);
    }

    const { data: prompts } = await query;

    return (prompts || []).map((prompt, index) => ({
      id: prompt.id,
      title: prompt.title,
      content: prompt.content,
      role: prompt.role,
      department: prompt.department,
      category: prompt.category || [],
      relevanceScore: scores.find(s => s.promptId === prompt.id)?.score || 0,
      rankPosition: index + 1,
    }));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async keywordSearch(
    normalizedQuery: string,
    searchQuery: AISearchQuery
  ): Promise<AISearchResult[]> {
    const keywords = normalizedQuery.split(' ').filter(k => k.length > 2);

    let query = supabase
      .from('prompts')
      .select('*')
      .or(
        keywords
          .map(k => `title.ilike.%${k}%,content.ilike.%${k}%,description.ilike.%${k}%`)
          .join(',')
      );

    if (searchQuery.filters?.role) {
      query = query.eq('role', searchQuery.filters.role);
    }

    if (searchQuery.filters?.department) {
      query = query.eq('department', searchQuery.filters.department);
    }

    if (searchQuery.filters?.status) {
      query = query.eq('status', searchQuery.filters.status);
    }

    query = query.limit(searchQuery.limit || 10);

    const { data: prompts } = await query;

    return (prompts || []).map((prompt, index) => {
      const relevanceScore = this.calculateKeywordRelevance(prompt, keywords);
      return {
        id: prompt.id,
        title: prompt.title,
        content: prompt.content,
        role: prompt.role,
        department: prompt.department,
        category: prompt.category || [],
        relevanceScore,
        rankPosition: index + 1,
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private calculateKeywordRelevance(prompt: any, keywords: string[]): number {
    let score = 0;
    const text = `${prompt.title} ${prompt.content} ${prompt.description || ''}`.toLowerCase();

    keywords.forEach(keyword => {
      const count = (text.match(new RegExp(keyword, 'g')) || []).length;
      if (text.includes(keyword)) score += 0.3;
      score += count * 0.1;
    });

    return Math.min(score, 1);
  }

  async autocomplete(query: string, limit: number = 5): Promise<string[]> {
    const normalized = this.normalizeQuery(query);

    const { data: suggestions } = await supabase
      .from('autocomplete_suggestions')
      .select('suggestion_text')
      .ilike('normalized_text', `${normalized}%`)
      .order('search_count', { ascending: false })
      .limit(limit);

    return (suggestions || []).map((s: any) => s.suggestion_text);
  }

  private async getDidYouMeanSuggestion(query: string): Promise<string | null> {
    const normalized = this.normalizeQuery(query);

    const { data: suggestions } = await supabase
      .from('autocomplete_suggestions')
      .select('suggestion_text, normalized_text')
      .order('search_count', { ascending: false })
      .limit(50);

    if (!suggestions || suggestions.length === 0) return null;

    let bestMatch: { text: string; distance: number } | null = null;

    for (const suggestion of suggestions) {
      const distance = this.levenshteinDistance(normalized, suggestion.normalized_text);
      if (distance <= 3 && (!bestMatch || distance < bestMatch.distance)) {
        bestMatch = { text: suggestion.suggestion_text, distance };
      }
    }

    return bestMatch && bestMatch.text !== query ? bestMatch.text : null;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  async trackInteraction(
    queryId: string,
    promptId: string,
    interactionType: string,
    rankPosition: number,
    relevanceScore: number,
    rating?: number,
    feedback?: string
  ): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) return;

    await supabase.from('search_interactions').insert({
      search_query_id: queryId,
      user_id: user.id,
      prompt_id: promptId,
      interaction_type: interactionType,
      rank_position: rankPosition,
      relevance_score: relevanceScore,
      feedback_rating: rating,
      feedback_text: feedback,
    });

    if (interactionType === 'click') {
      await supabase
        .from('search_queries')
        .update({
          selected_result_id: promptId,
          selected_result_rank: rankPosition,
        })
        .eq('id', queryId);
    }

    await this.learnFromInteraction(promptId, interactionType, rating);
  }

  private async learnFromInteraction(
    promptId: string,
    interactionType: string,
    rating?: number
  ): Promise<void> {
    if (interactionType === 'click' || interactionType === 'save') {
      const { data: prompt } = await supabase
        .from('prompts')
        .select('usage_count')
        .eq('id', promptId)
        .maybeSingle();

      if (prompt) {
        await supabase
          .from('prompts')
          .update({
            usage_count: (prompt.usage_count || 0) + 1,
          })
          .eq('id', promptId);
      }
    }

    if (rating && rating >= 4) {
      const { data: prompt } = await supabase
        .from('prompts')
        .select('rating_average, rating_count')
        .eq('id', promptId)
        .maybeSingle();

      if (prompt) {
        const newCount = (prompt.rating_count || 0) + 1;
        const newAverage =
          ((prompt.rating_average || 0) * (prompt.rating_count || 0) + rating) / newCount;

        await supabase
          .from('prompts')
          .update({
            rating_average: newAverage,
            rating_count: newCount,
          })
          .eq('id', promptId);
      }
    }
  }

  async getRecommendations(limit: number = 10): Promise<Recommendation[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];

    await this.generateRecommendations(user.id);

    const { data: recommendations } = await supabase
      .from('user_recommendations')
      .select('*, prompts(*)')
      .eq('user_id', user.id)
      .eq('dismissed', false)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('score', { ascending: false })
      .limit(limit);

    return (recommendations || []).map((rec: any) => ({
      id: rec.id,
      promptId: rec.prompt_id,
      type: rec.recommendation_type,
      score: rec.score,
      reasoning: rec.reasoning,
      prompt: rec.prompts,
    }));
  }

  private async generateRecommendations(userId: string): Promise<void> {
    await Promise.all([
      this.generateRoleBasedRecommendations(userId),
      this.generateActivityBasedRecommendations(userId),
      this.generatePeerUsageRecommendations(userId),
      this.generateTrendingRecommendations(userId),
    ]);
  }

  private async generateRoleBasedRecommendations(userId: string): Promise<void> {
    const { data: user } = await supabase
      .from('users')
      .select('role, department')
      .eq('id', userId)
      .maybeSingle();

    if (!user || !user.role) return;

    const { data: prompts } = await supabase
      .from('prompts')
      .select('*')
      .eq('role', user.role)
      .eq('status', 'Active')
      .order('usage_count', { ascending: false })
      .limit(5);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const prompt of prompts || []) {
      await supabase.from('user_recommendations').upsert({
        user_id: userId,
        prompt_id: prompt.id,
        recommendation_type: 'role_based',
        score: 0.8,
        reasoning: { reason: 'Matches your role', role: user.role },
        expires_at: expiresAt,
      });
    }
  }

  private async generateActivityBasedRecommendations(userId: string): Promise<void> {
    const { data: interactions } = await supabase
      .from('search_interactions')
      .select('prompt_id')
      .eq('user_id', userId)
      .in('interaction_type', ['click', 'save'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (!interactions || interactions.length === 0) return;

    const promptIds = interactions.map(i => i.prompt_id);

    const { data: similarPrompts } = await supabase
      .from('similar_prompts')
      .select('similar_prompt_id, similarity_score')
      .in('prompt_id', promptIds)
      .order('similarity_score', { ascending: false })
      .limit(5);

    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    for (const similar of similarPrompts || []) {
      await supabase.from('user_recommendations').upsert({
        user_id: userId,
        prompt_id: similar.similar_prompt_id,
        recommendation_type: 'activity_based',
        score: similar.similarity_score,
        reasoning: { reason: 'Similar to prompts you viewed' },
        expires_at: expiresAt,
      });
    }
  }

  private async generatePeerUsageRecommendations(userId: string): Promise<void> {
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (!user || !user.role) return;

    const { data: peerInteractions } = await supabase
      .from('search_interactions')
      .select('prompt_id, prompts!inner(role)')
      .eq('prompts.role', user.role)
      .neq('user_id', userId)
      .in('interaction_type', ['click', 'save', 'rate'])
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(100);

    const promptCounts: Record<string, number> = {};
    (peerInteractions || []).forEach((interaction: any) => {
      promptCounts[interaction.prompt_id] = (promptCounts[interaction.prompt_id] || 0) + 1;
    });

    const topPrompts = Object.entries(promptCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const [promptId, count] of topPrompts) {
      await supabase.from('user_recommendations').upsert({
        user_id: userId,
        prompt_id: promptId,
        recommendation_type: 'peer_usage',
        score: Math.min(count / 10, 1),
        reasoning: { reason: 'Popular with peers in your role', role: user.role, interactions: count },
        expires_at: expiresAt,
      });
    }
  }

  private async generateTrendingRecommendations(userId: string): Promise<void> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: trending } = await supabase
      .from('search_interactions')
      .select('prompt_id')
      .gte('created_at', weekAgo)
      .in('interaction_type', ['click', 'save'])
      .limit(200);

    const promptCounts: Record<string, number> = {};
    (trending || []).forEach((interaction: any) => {
      promptCounts[interaction.prompt_id] = (promptCounts[interaction.prompt_id] || 0) + 1;
    });

    const topTrending = Object.entries(promptCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    for (const [promptId, count] of topTrending) {
      await supabase.from('user_recommendations').upsert({
        user_id: userId,
        prompt_id: promptId,
        recommendation_type: 'trending',
        score: Math.min(count / 20, 1),
        reasoning: { reason: 'Trending this week', interactions: count },
        expires_at: expiresAt,
      });
    }
  }

  async dismissRecommendation(recommendationId: string): Promise<void> {
    await supabase
      .from('user_recommendations')
      .update({ dismissed: true })
      .eq('id', recommendationId);
  }

  async getSearchAnalytics(days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: analytics } = await supabase
      .from('search_analytics')
      .select('*')
      .gte('analytics_date', startDate.toISOString().split('T')[0])
      .order('search_count', { ascending: false })
      .limit(50);

    return analytics || [];
  }

  async getPopularQueries(limit: number = 10): Promise<any[]> {
    const { data } = await supabase
      .from('autocomplete_suggestions')
      .select('suggestion_text, search_count')
      .order('search_count', { ascending: false })
      .limit(limit);

    return data || [];
  }

  private async generateEmbedding(text: string): Promise<number[] | null> {
    return Array(384).fill(0).map(() => Math.random() * 2 - 1);
  }

  private async updateAutocomplete(query: string): Promise<void> {
    const normalized = this.normalizeQuery(query);

    const { data: existing } = await supabase
      .from('autocomplete_suggestions')
      .select('*')
      .eq('suggestion_text', query)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('autocomplete_suggestions')
        .update({
          search_count: existing.search_count + 1,
          last_searched_at: new Date().toISOString(),
          is_popular: existing.search_count + 1 > 10,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('autocomplete_suggestions').insert({
        suggestion_text: query,
        normalized_text: normalized,
        search_count: 1,
        last_searched_at: new Date().toISOString(),
      });
    }
  }

  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  }
}

export const aiSearchService = AISearchService.getInstance();
