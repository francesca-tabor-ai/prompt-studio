import React, { useState, useEffect } from 'react';
import { Filter, X, Save, Bookmark } from 'lucide-react';
import { searchApi, type SavedSearch } from '../api/searchApi';
import type { SearchFilters, SearchFacets } from '../services/searchService';

interface AdvancedSearchPanelProps {
  onFilterChange: (filters: SearchFilters) => void;
  currentFilters: SearchFilters;
}

export function AdvancedSearchPanel({ onFilterChange, currentFilters }: AdvancedSearchPanelProps) {
  const [facets, setFacets] = useState<SearchFacets>({
    roles: [],
    departments: [],
    workflows: [],
    types: [],
    statuses: [],
  });
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchDescription, setSearchDescription] = useState('');

  useEffect(() => {
    loadFacets();
    loadSavedSearches();
  }, []);

  const loadFacets = async () => {
    try {
      const response = await searchApi.getFacets();
      setFacets(response.data);
    } catch (error) {
      console.error('Failed to load facets:', error);
    }
  };

  const loadSavedSearches = async () => {
    try {
      const response = await searchApi.listSavedSearches();
      setSavedSearches(response.data);
    } catch (error) {
      console.error('Failed to load saved searches:', error);
    }
  };

  const handleFilterToggle = (category: keyof SearchFilters, value: string) => {
    const currentValues = currentFilters[category] as string[] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];

    onFilterChange({
      ...currentFilters,
      [category]: newValues,
    });
  };

  const handleClearFilters = () => {
    onFilterChange({});
  };

  const handleSaveSearch = async () => {
    if (!searchName.trim()) return;

    try {
      await searchApi.createSavedSearch({
        name: searchName,
        description: searchDescription,
        filters: currentFilters,
      });

      setSearchName('');
      setSearchDescription('');
      setShowSaveDialog(false);
      loadSavedSearches();
    } catch (error) {
      console.error('Failed to save search:', error);
    }
  };

  const handleLoadSavedSearch = async (id: string) => {
    try {
      const response = await searchApi.useSavedSearch(id);
    } catch (error) {
      console.error('Failed to load saved search:', error);
    }
  };

  const isFilterActive = (category: keyof SearchFilters, value: string): boolean => {
    const values = currentFilters[category] as string[] || [];
    return values.includes(value);
  };

  const activeFilterCount = Object.values(currentFilters).reduce((count, values) => {
    if (Array.isArray(values)) return count + values.length;
    if (values) return count + 1;
    return count;
  }, 0);

  return (
    <div className="advanced-search-panel bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-gray-900">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={handleClearFilters}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setShowSaveDialog(true)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Save search"
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>

      {savedSearches.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Saved Searches</h4>
          <div className="space-y-1">
            {savedSearches.slice(0, 5).map((saved) => (
              <button
                key={saved.id}
                onClick={() => handleLoadSavedSearch(saved.id)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2"
              >
                <Bookmark className="w-3 h-3" />
                {saved.name}
                {saved.is_default && (
                  <span className="ml-auto text-xs text-blue-600">Default</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {facets.roles.length > 0 && (
          <FilterSection
            title="Roles"
            items={facets.roles}
            activeValues={currentFilters.roles || []}
            onToggle={(value) => handleFilterToggle('roles', value)}
          />
        )}

        {facets.departments.length > 0 && (
          <FilterSection
            title="Departments"
            items={facets.departments}
            activeValues={currentFilters.departments || []}
            onToggle={(value) => handleFilterToggle('departments', value)}
          />
        )}

        {facets.workflows.length > 0 && (
          <FilterSection
            title="Workflows"
            items={facets.workflows}
            activeValues={currentFilters.workflows || []}
            onToggle={(value) => handleFilterToggle('workflows', value)}
          />
        )}

        {facets.types.length > 0 && (
          <FilterSection
            title="Prompt Types"
            items={facets.types}
            activeValues={currentFilters.types || []}
            onToggle={(value) => handleFilterToggle('types', value)}
          />
        )}

        {facets.statuses.length > 0 && (
          <FilterSection
            title="Status"
            items={facets.statuses}
            activeValues={currentFilters.statuses || []}
            onToggle={(value) => handleFilterToggle('statuses', value)}
          />
        )}
      </div>

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Save Search</h3>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Name
                </label>
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="e.g., Customer Support Templates"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={searchDescription}
                  onChange={(e) => setSearchDescription(e.target.value)}
                  placeholder="Describe this saved search..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveSearch}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Search
                </button>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FilterSectionProps {
  title: string;
  items: Array<{ value: string; count: number }>;
  activeValues: string[];
  onToggle: (value: string) => void;
}

function FilterSection({ title, items, activeValues, onToggle }: FilterSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="filter-section">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-2"
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-1">
          {items.map((item) => (
            <label
              key={item.value}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
            >
              <input
                type="checkbox"
                checked={activeValues.includes(item.value)}
                onChange={() => onToggle(item.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="flex-1 text-sm text-gray-700">{item.value}</span>
              <span className="text-xs text-gray-400">{item.count}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
