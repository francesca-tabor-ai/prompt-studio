import React, { useState, useEffect } from 'react';
import { Tag as TagIcon, X, Plus, TrendingUp, Sparkles } from 'lucide-react';
import { tagsApi } from '../api/tagsApi';
import type { Tag, TagSuggestion } from '../services/tagService';

interface TagSelectorProps {
  promptId?: string;
  promptContent?: string;
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  showSuggestions?: boolean;
}

export function TagSelector({
  promptId,
  promptContent,
  selectedTags,
  onTagsChange,
  showSuggestions = true,
}: TagSelectorProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTags();
    if (showSuggestions && promptId && promptContent) {
      loadSuggestions();
    }
  }, []);

  const loadTags = async () => {
    try {
      const response = await tagsApi.getAllTags();
      setAvailableTags(response.data);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const loadSuggestions = async () => {
    if (!promptId || !promptContent) return;

    setLoading(true);
    try {
      const response = await tagsApi.suggestTagsForPrompt(promptId, promptContent);
      setSuggestions(response.data);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = (tag: Tag) => {
    if (!selectedTags.find(t => t.id === tag.id)) {
      onTagsChange([...selectedTags, tag]);
      if (promptId) {
        tagsApi.assignTagToPrompt({ promptId, tagId: tag.id });
      }
    }
    setShowDropdown(false);
    setSearchQuery('');
  };

  const handleRemoveTag = (tagId: string) => {
    onTagsChange(selectedTags.filter(t => t.id !== tagId));
    if (promptId) {
      tagsApi.removeTagFromPrompt(promptId, tagId);
    }
  };

  const handleAcceptSuggestion = async (suggestion: TagSuggestion) => {
    handleAddTag(suggestion.tag);
    if (promptId) {
      await tagsApi.acceptSuggestion(promptId, suggestion.tag.id);
    }
    setSuggestions(suggestions.filter(s => s.tag.id !== suggestion.tag.id));
  };

  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !selectedTags.find(t => t.id === tag.id)
  );

  return (
    <div className="tag-selector">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tags
        </label>

        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
              style={{
                backgroundColor: tag.color + '20',
                color: tag.color,
                border: `1px solid ${tag.color}40`,
              }}
            >
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="hover:opacity-70 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="inline-flex items-center gap-1 px-3 py-1 border-2 border-dashed border-gray-300 rounded-full text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add Tag
            </button>

            {showDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-2 border-b border-gray-100">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tags..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {filteredTags.length > 0 ? (
                    filteredTags.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => handleAddTag(tag)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm text-gray-700">{tag.name}</span>
                        {tag.is_system_tag && (
                          <span className="ml-auto text-xs text-gray-400">System</span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-gray-500 text-center">
                      No tags found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-semibold text-blue-900">Suggested Tags</h4>
          </div>

          <div className="space-y-2">
            {suggestions.map(suggestion => (
              <div
                key={suggestion.tag.id}
                className="flex items-center justify-between bg-white rounded-lg p-2"
              >
                <div className="flex items-center gap-2 flex-1">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: suggestion.tag.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {suggestion.tag.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {suggestion.reason}
                    </div>
                  </div>
                  <div className="text-xs font-medium text-blue-600 flex-shrink-0">
                    {Math.round(suggestion.confidence * 100)}%
                  </div>
                </div>
                <button
                  onClick={() => handleAcceptSuggestion(suggestion)}
                  className="ml-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors flex-shrink-0"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-2 text-sm text-gray-500">
          Generating suggestions...
        </div>
      )}
    </div>
  );
}

interface TagCloudProps {
  tags: Array<Tag & { trend?: string }>;
  onTagClick?: (tag: Tag) => void;
  showTrend?: boolean;
}

export function TagCloud({ tags, onTagClick, showTrend = false }: TagCloudProps) {
  const maxUsage = Math.max(...tags.map(t => t.usage_count), 1);

  const getFontSize = (usageCount: number): number => {
    const ratio = usageCount / maxUsage;
    return 12 + ratio * 12;
  };

  return (
    <div className="tag-cloud flex flex-wrap gap-3 p-4">
      {tags.map(tag => (
        <button
          key={tag.id}
          onClick={() => onTagClick?.(tag)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg hover:opacity-80 transition-all"
          style={{
            fontSize: `${getFontSize(tag.usage_count)}px`,
            backgroundColor: tag.color + '20',
            color: tag.color,
            border: `1px solid ${tag.color}40`,
          }}
        >
          <TagIcon className="w-3 h-3" />
          {tag.name}
          <span className="text-xs opacity-70">({tag.usage_count})</span>
          {showTrend && tag.trend === 'up' && (
            <TrendingUp className="w-3 h-3" />
          )}
        </button>
      ))}
    </div>
  );
}
