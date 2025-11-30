import { supabase } from '../lib/supabase';

export interface AnalysisResult {
  id: string;
  promptId: string;
  overallScore: number;
  clarityScore: number;
  specificityScore: number;
  toneScore: number;
  completenessScore: number;
  qualityGrade: string;
  needsReview: boolean;
  flaggedForIssues: boolean;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: Recommendation[];
  biasDetections: BiasDetection[];
  toneAssessment?: ToneAssessment;
}

export interface Recommendation {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  exampleBefore?: string;
  exampleAfter?: string;
  impactScore: number;
}

export interface BiasDetection {
  id: string;
  biasType: string;
  severity: string;
  detectedText: string;
  explanation: string;
  suggestedReplacement?: string;
}

export interface ToneAssessment {
  intendedTone: string;
  detectedTone: string;
  consistencyScore: number;
  appropriatenessScore: number;
  inconsistencies: string[];
  recommendations: string;
}

export class ContentAnalysisService {
  private static instance: ContentAnalysisService;

  private constructor() {}

  static getInstance(): ContentAnalysisService {
    if (!ContentAnalysisService.instance) {
      ContentAnalysisService.instance = new ContentAnalysisService();
    }
    return ContentAnalysisService.instance;
  }

  async analyzePrompt(promptId: string, intendedRole?: string): Promise<AnalysisResult> {
    const { data: prompt } = await supabase
      .from('prompts')
      .select('*')
      .eq('id', promptId)
      .single();

    if (!prompt) {
      throw new Error('Prompt not found');
    }

    const clarityScore = this.analyzeClarityAndSpecificity(prompt.content, prompt.title);
    const toneScore = this.analyzeTone(prompt.content, intendedRole || prompt.role);
    const completenessScore = this.analyzeCompleteness(prompt);
    const specificityScore = this.analyzeSpecificity(prompt.content);

    const overallScore = this.calculateOverallScore({
      clarity: clarityScore.clarity,
      specificity: specificityScore,
      tone: toneScore.score,
      completeness: completenessScore.score,
    });

    const qualityGrade = this.determineGrade(overallScore);
    const needsReview = overallScore < 5.0 || clarityScore.issues.length > 3;

    const biasDetections = await this.detectBias(prompt.content);
    const flaggedForIssues = biasDetections.some(b => b.severity === 'critical' || b.severity === 'high');

    const strengths = this.identifyStrengths({
      clarity: clarityScore.clarity,
      specificity: specificityScore,
      tone: toneScore.score,
      completeness: completenessScore.score,
    });

    const weaknesses = this.identifyWeaknesses({
      clarity: clarityScore.clarity,
      specificity: specificityScore,
      tone: toneScore.score,
      completeness: completenessScore.score,
    }, clarityScore.issues);

    const { data: analysisRecord } = await supabase
      .from('prompt_analyses')
      .insert({
        prompt_id: promptId,
        overall_score: overallScore,
        clarity_score: clarityScore.clarity,
        specificity_score: specificityScore,
        tone_score: toneScore.score,
        completeness_score: completenessScore.score,
        quality_grade: qualityGrade,
        needs_review: needsReview,
        flagged_for_issues: flaggedForIssues,
        analysis_summary: this.generateSummary(overallScore, qualityGrade, strengths, weaknesses),
        strengths: strengths,
        weaknesses: weaknesses,
      })
      .select()
      .single();

    await this.saveDetailedScores(analysisRecord.id, {
      clarity: clarityScore,
      tone: toneScore,
      completeness: completenessScore,
      specificity: specificityScore,
    });

    const recommendations = await this.generateRecommendations(
      analysisRecord.id,
      prompt,
      {
        clarity: clarityScore,
        tone: toneScore,
        completeness: completenessScore,
        specificity: specificityScore,
      }
    );

    await this.saveBiasDetections(analysisRecord.id, biasDetections);

    const toneAssessment = await this.saveToneAssessment(
      analysisRecord.id,
      toneScore,
      intendedRole || prompt.role
    );

    return {
      id: analysisRecord.id,
      promptId,
      overallScore,
      clarityScore: clarityScore.clarity,
      specificityScore,
      toneScore: toneScore.score,
      completenessScore: completenessScore.score,
      qualityGrade,
      needsReview,
      flaggedForIssues,
      summary: analysisRecord.analysis_summary,
      strengths,
      weaknesses,
      recommendations,
      biasDetections,
      toneAssessment,
    };
  }

  private analyzeClarityAndSpecificity(content: string, title: string): {
    clarity: number;
    issues: string[];
  } {
    let score = 10;
    const issues: string[] = [];

    if (content.length < 100) {
      score -= 2;
      issues.push('Content is too brief and may lack detail');
    }

    const vagueTerms = ['something', 'things', 'stuff', 'somehow', 'maybe', 'probably'];
    const vagueCount = vagueTerms.filter(term =>
      content.toLowerCase().includes(term)
    ).length;

    if (vagueCount > 0) {
      score -= vagueCount * 0.5;
      issues.push(`Contains ${vagueCount} vague term(s) that reduce clarity`);
    }

    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = content.length / Math.max(sentences.length, 1);

    if (avgSentenceLength > 150) {
      score -= 1;
      issues.push('Sentences are too long; break them down for clarity');
    }

    const hasHeaders = /#{1,6}\s/.test(content);
    if (!hasHeaders && content.length > 300) {
      score -= 1;
      issues.push('Lacks structural headers for organization');
    }

    const hasExamples = /example|for instance|such as|e\.g\./i.test(content);
    if (!hasExamples && content.length > 200) {
      score -= 0.5;
      issues.push('Could benefit from examples');
    }

    return {
      clarity: Math.max(1, Math.min(10, score)),
      issues,
    };
  }

  private analyzeSpecificity(content: string): number {
    let score = 10;

    const specificIndicators = [
      /\d+/,
      /exactly|specifically|precisely|must|required|always|never/i,
      /step \d+|first|second|third|finally/i,
      /\[.*?\]|\(.*?\)/,
    ];

    const specificityCount = specificIndicators.filter(pattern =>
      pattern.test(content)
    ).length;

    score = 5 + (specificityCount * 1.25);

    const genericPhrases = ['as needed', 'if possible', 'try to', 'attempt', 'consider'];
    const genericCount = genericPhrases.filter(phrase =>
      content.toLowerCase().includes(phrase)
    ).length;

    score -= genericCount * 0.5;

    return Math.max(1, Math.min(10, score));
  }

  private analyzeTone(content: string, role: string): {
    score: number;
    detectedTone: string;
    consistency: number;
    issues: string[];
  } {
    const professionalKeywords = ['please', 'kindly', 'ensure', 'maintain', 'provide'];
    const casualKeywords = ['hey', 'cool', 'awesome', 'gonna', 'wanna'];
    const technicalKeywords = ['implement', 'configure', 'execute', 'parameter', 'function'];
    const formalKeywords = ['hereby', 'therefore', 'pursuant', 'aforementioned'];

    const professionalCount = professionalKeywords.filter(k =>
      content.toLowerCase().includes(k)
    ).length;
    const casualCount = casualKeywords.filter(k =>
      content.toLowerCase().includes(k)
    ).length;
    const technicalCount = technicalKeywords.filter(k =>
      content.toLowerCase().includes(k)
    ).length;
    const formalCount = formalKeywords.filter(k =>
      content.toLowerCase().includes(k)
    ).length;

    let detectedTone = 'neutral';
    let dominantCount = 0;

    if (professionalCount > dominantCount) {
      detectedTone = 'professional';
      dominantCount = professionalCount;
    }
    if (casualCount > dominantCount) {
      detectedTone = 'casual';
      dominantCount = casualCount;
    }
    if (technicalCount > dominantCount) {
      detectedTone = 'technical';
      dominantCount = technicalCount;
    }
    if (formalCount > dominantCount) {
      detectedTone = 'formal';
      dominantCount = formalCount;
    }

    const consistency = this.calculateToneConsistency(
      professionalCount,
      casualCount,
      technicalCount,
      formalCount
    );

    const issues: string[] = [];
    if (consistency < 7) {
      issues.push('Tone is inconsistent throughout the prompt');
    }
    if (casualCount > 0 && role && role.toLowerCase().includes('executive')) {
      issues.push('Casual language may not be appropriate for executive role');
    }

    const appropriatenessScore = this.calculateToneAppropriateness(detectedTone, role);
    const score = (consistency * 0.6 + appropriatenessScore * 0.4);

    return {
      score: Math.max(1, Math.min(10, score)),
      detectedTone,
      consistency,
      issues,
    };
  }

  private calculateToneConsistency(...counts: number[]): number {
    const total = counts.reduce((sum, c) => sum + c, 0);
    if (total === 0) return 7;

    const maxCount = Math.max(...counts);
    const consistency = (maxCount / total) * 10;

    return Math.max(1, Math.min(10, consistency));
  }

  private calculateToneAppropriateness(detectedTone: string, role: string): number {
    const roleType = role.toLowerCase();

    const appropriateness: Record<string, Record<string, number>> = {
      professional: { executive: 9, manager: 9, support: 8, technical: 7 },
      technical: { engineer: 10, developer: 10, analyst: 9, support: 7 },
      formal: { executive: 8, legal: 10, compliance: 9, manager: 7 },
      casual: { creative: 8, marketing: 7, support: 6, executive: 4 },
      neutral: { executive: 7, manager: 7, support: 7, technical: 7 },
    };

    for (const [tone, roles] of Object.entries(appropriateness)) {
      if (detectedTone === tone) {
        for (const [roleKey, score] of Object.entries(roles)) {
          if (roleType.includes(roleKey)) {
            return score;
          }
        }
      }
    }

    return 7;
  }

  private analyzeCompleteness(prompt: any): {
    score: number;
    missing: string[];
  } {
    let score = 10;
    const missing: string[] = [];

    if (!prompt.title || prompt.title.length < 10) {
      score -= 1;
      missing.push('Title is missing or too short');
    }

    if (!prompt.description || prompt.description.length < 20) {
      score -= 1;
      missing.push('Description is missing or insufficient');
    }

    if (!prompt.content || prompt.content.length < 50) {
      score -= 2;
      missing.push('Content is insufficient');
    }

    const hasConstraints = /constraint|requirement|must|should not|cannot/i.test(prompt.content);
    if (!hasConstraints) {
      score -= 1;
      missing.push('Lacks explicit constraints or requirements');
    }

    const hasOutputFormat = /output|format|response|result|return/i.test(prompt.content);
    if (!hasOutputFormat) {
      score -= 1;
      missing.push('Output format not specified');
    }

    const hasContext = /context|background|scenario|situation/i.test(prompt.content);
    if (!hasContext && prompt.content.length > 100) {
      score -= 0.5;
      missing.push('Could benefit from more context');
    }

    if (!prompt.role) {
      score -= 1;
      missing.push('Role is not specified');
    }

    if (!prompt.department) {
      score -= 0.5;
      missing.push('Department is not specified');
    }

    return {
      score: Math.max(1, Math.min(10, score)),
      missing,
    };
  }

  private async detectBias(content: string): Promise<BiasDetection[]> {
    const detections: BiasDetection[] = [];

    const genderBiasTerms = [
      { term: 'he/she', replacement: 'they', severity: 'low' },
      { term: 'his/her', replacement: 'their', severity: 'low' },
      { term: 'guys', replacement: 'everyone/team', severity: 'medium' },
      { term: 'manpower', replacement: 'workforce/staff', severity: 'medium' },
      { term: 'chairman', replacement: 'chairperson/chair', severity: 'medium' },
    ];

    for (const { term, replacement, severity } of genderBiasTerms) {
      if (content.toLowerCase().includes(term.toLowerCase())) {
        detections.push({
          id: '',
          biasType: 'gender',
          severity: severity as 'low' | 'medium' | 'high' | 'critical',
          detectedText: term,
          explanation: `Gender-biased language detected: "${term}"`,
          suggestedReplacement: replacement,
        });
      }
    }

    const ageismTerms = ['young', 'old', 'elderly', 'millennial', 'boomer'];
    for (const term of ageismTerms) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      if (regex.test(content)) {
        detections.push({
          id: '',
          biasType: 'age',
          severity: 'medium',
          detectedText: term,
          explanation: `Age-related language that may introduce bias: "${term}"`,
          suggestedReplacement: 'Consider removing age references if not essential',
        });
      }
    }

    const abilityBiasTerms = ['crazy', 'insane', 'lame', 'dumb', 'blind to'];
    for (const term of abilityBiasTerms) {
      if (content.toLowerCase().includes(term.toLowerCase())) {
        detections.push({
          id: '',
          biasType: 'ability',
          severity: 'high',
          detectedText: term,
          explanation: `Ableist language detected: "${term}"`,
          suggestedReplacement: 'Use neutral descriptive language',
        });
      }
    }

    return detections;
  }

  private calculateOverallScore(scores: {
    clarity: number;
    specificity: number;
    tone: number;
    completeness: number;
  }): number {
    const weights = {
      clarity: 0.25,
      specificity: 0.20,
      tone: 0.20,
      completeness: 0.25,
      structure: 0.10,
    };

    const structureScore = (scores.clarity + scores.specificity) / 2;

    const weighted =
      scores.clarity * weights.clarity +
      scores.specificity * weights.specificity +
      scores.tone * weights.tone +
      scores.completeness * weights.completeness +
      structureScore * weights.structure;

    return Math.round(weighted * 10) / 10;
  }

  private determineGrade(score: number): string {
    if (score >= 9.0) return 'Excellent';
    if (score >= 7.0) return 'Good';
    if (score >= 5.0) return 'Fair';
    if (score >= 3.0) return 'Poor';
    return 'Needs Improvement';
  }

  private identifyStrengths(scores: {
    clarity: number;
    specificity: number;
    tone: number;
    completeness: number;
  }): string[] {
    const strengths: string[] = [];

    if (scores.clarity >= 8) {
      strengths.push('Clear and easy to understand instructions');
    }
    if (scores.specificity >= 8) {
      strengths.push('Highly specific and detailed requirements');
    }
    if (scores.tone >= 8) {
      strengths.push('Consistent and appropriate tone');
    }
    if (scores.completeness >= 8) {
      strengths.push('Comprehensive coverage of all necessary elements');
    }

    return strengths;
  }

  private identifyWeaknesses(
    scores: {
      clarity: number;
      specificity: number;
      tone: number;
      completeness: number;
    },
    clarityIssues: string[]
  ): string[] {
    const weaknesses: string[] = [];

    if (scores.clarity < 6) {
      weaknesses.push('Instructions lack clarity');
      weaknesses.push(...clarityIssues);
    }
    if (scores.specificity < 6) {
      weaknesses.push('Not specific enough; needs more detail');
    }
    if (scores.tone < 6) {
      weaknesses.push('Tone is inconsistent or inappropriate');
    }
    if (scores.completeness < 6) {
      weaknesses.push('Missing key elements or information');
    }

    return weaknesses;
  }

  private generateSummary(
    score: number,
    grade: string,
    strengths: string[],
    weaknesses: string[]
  ): string {
    let summary = `Overall Quality: ${grade} (${score}/10)\n\n`;

    if (strengths.length > 0) {
      summary += `Strengths:\n${strengths.map(s => `• ${s}`).join('\n')}\n\n`;
    }

    if (weaknesses.length > 0) {
      summary += `Areas for Improvement:\n${weaknesses.map(w => `• ${w}`).join('\n')}`;
    }

    return summary;
  }

  private async saveDetailedScores(analysisId: string, scores: any): Promise<void> {
    const scoreRecords = [
      {
        analysis_id: analysisId,
        metric_name: 'Clarity',
        metric_category: 'clarity',
        score: scores.clarity.clarity,
        explanation: scores.clarity.issues.join('; '),
      },
      {
        analysis_id: analysisId,
        metric_name: 'Specificity',
        metric_category: 'specificity',
        score: scores.specificity,
        explanation: 'Measures how specific and detailed the prompt is',
      },
      {
        analysis_id: analysisId,
        metric_name: 'Tone Consistency',
        metric_category: 'tone',
        score: scores.tone.score,
        explanation: scores.tone.issues.join('; ') || 'Tone is appropriate',
      },
      {
        analysis_id: analysisId,
        metric_name: 'Completeness',
        metric_category: 'completeness',
        score: scores.completeness.score,
        explanation: scores.completeness.missing.join('; ') || 'All elements present',
      },
    ];

    await supabase.from('quality_scores').insert(scoreRecords);
  }

  private async generateRecommendations(
    analysisId: string,
    prompt: any,
    scores: any
  ): Promise<Recommendation[]> {
    const recommendations: any[] = [];

    if (scores.clarity.issues.length > 0) {
      recommendations.push({
        analysis_id: analysisId,
        recommendation_type: 'clarity',
        priority: scores.clarity.clarity < 5 ? 'high' : 'medium',
        title: 'Improve Clarity',
        description: scores.clarity.issues.join('. '),
        impact_score: 10 - scores.clarity.clarity,
      });
    }

    if (scores.specificity < 7) {
      recommendations.push({
        analysis_id: analysisId,
        recommendation_type: 'specificity',
        priority: 'medium',
        title: 'Add More Specific Details',
        description: 'Include specific requirements, parameters, or examples to make the prompt more actionable.',
        example_before: 'Handle customer inquiries',
        example_after: 'Respond to customer inquiries within 24 hours using the standard email template',
        impact_score: 8,
      });
    }

    if (scores.tone.issues.length > 0) {
      recommendations.push({
        analysis_id: analysisId,
        recommendation_type: 'tone',
        priority: 'medium',
        title: 'Adjust Tone',
        description: scores.tone.issues.join('. '),
        impact_score: 7,
      });
    }

    if (scores.completeness.missing.length > 0) {
      recommendations.push({
        analysis_id: analysisId,
        recommendation_type: 'completeness',
        priority: 'high',
        title: 'Add Missing Elements',
        description: scores.completeness.missing.join('. '),
        impact_score: 9,
      });
    }

    const { data: saved } = await supabase
      .from('analysis_recommendations')
      .insert(recommendations)
      .select();

    return (saved || []).map(r => ({
      id: r.id,
      type: r.recommendation_type,
      priority: r.priority,
      title: r.title,
      description: r.description,
      exampleBefore: r.example_before,
      exampleAfter: r.example_after,
      impactScore: r.impact_score,
    }));
  }

  private async saveBiasDetections(
    analysisId: string,
    detections: BiasDetection[]
  ): Promise<void> {
    if (detections.length === 0) return;

    const records = detections.map(d => ({
      analysis_id: analysisId,
      bias_type: d.biasType,
      severity: d.severity,
      detected_text: d.detectedText,
      explanation: d.explanation,
      suggested_replacement: d.suggestedReplacement,
    }));

    await supabase.from('bias_detections').insert(records);
  }

  private async saveToneAssessment(
    analysisId: string,
    toneScore: any,
    intendedRole: string
  ): Promise<ToneAssessment> {
    const { data } = await supabase
      .from('tone_assessments')
      .insert({
        analysis_id: analysisId,
        intended_tone: 'professional',
        detected_tone: toneScore.detectedTone,
        consistency_score: toneScore.consistency,
        appropriateness_score: toneScore.score,
        inconsistencies: toneScore.issues,
        recommendations: toneScore.issues.length > 0
          ? 'Review tone consistency and appropriateness for the intended role'
          : 'Tone is appropriate',
      })
      .select()
      .single();

    return {
      intendedTone: data.intended_tone,
      detectedTone: data.detected_tone,
      consistencyScore: data.consistency_score,
      appropriatenessScore: data.appropriateness_score,
      inconsistencies: data.inconsistencies,
      recommendations: data.recommendations,
    };
  }

  async getAnalysis(promptId: string): Promise<AnalysisResult | null> {
    const { data: analysis } = await supabase
      .from('prompt_analyses')
      .select('*, analysis_recommendations(*), bias_detections(*), tone_assessments(*)')
      .eq('prompt_id', promptId)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!analysis) return null;

    return {
      id: analysis.id,
      promptId: analysis.prompt_id,
      overallScore: analysis.overall_score,
      clarityScore: analysis.clarity_score,
      specificityScore: analysis.specificity_score,
      toneScore: analysis.tone_score,
      completenessScore: analysis.completeness_score,
      qualityGrade: analysis.quality_grade,
      needsReview: analysis.needs_review,
      flaggedForIssues: analysis.flagged_for_issues,
      summary: analysis.analysis_summary,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.analysis_recommendations || [],
      biasDetections: analysis.bias_detections || [],
      toneAssessment: analysis.tone_assessments?.[0],
    };
  }

  async flagForReview(analysisId: string, reason: string): Promise<void> {
    await supabase
      .from('prompt_analyses')
      .update({
        needs_review: true,
        flagged_for_issues: true,
      })
      .eq('id', analysisId);
  }

  async getPromptsNeedingReview(): Promise<any[]> {
    const { data } = await supabase
      .from('prompt_analyses')
      .select('*, prompts(*)')
      .eq('needs_review', true)
      .order('analyzed_at', { ascending: false });

    return data || [];
  }
}

export const contentAnalysisService = ContentAnalysisService.getInstance();
