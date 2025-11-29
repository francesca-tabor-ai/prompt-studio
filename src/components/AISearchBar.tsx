import { Search, Sparkles, X, Star } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { searchApi } from '../api/searchApi';

interface AISearchBarProps {
  onSearch: (query: string) => void;
}

export default function AISearchBar({ onSearch }: AISearchBarProps) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [popularSearches, setPopularSearches] = useState<Array<{ query: string; count: number }>>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const aiSuggestions = [
    'Customer support templates for technical issues',
    'Sales outreach prompts for B2B leads',
    'Data analysis prompts for quarterly reports',
    'Content creation templates for blog posts',
    'Code review prompts for pull requests',
    'Meeting summary generators',
    'Email response templates for customer inquiries',
    'Product description generators',
  ];

  useEffect(() => {
    loadPopularSearches();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadPopularSearches = async () => {
    try {
      const response = await searchApi.getPopularSearches(5);
      setPopularSearches(response.data);
    } catch (error) {
      console.error('Failed to load popular searches:', error);
    }
  };

  const getSuggestions = () => {
    if (query.length > 2) {
      const filtered = aiSuggestions.filter((s) =>
        s.toLowerCase().includes(query.toLowerCase())
      );
      return filtered.slice(0, 5);
    }
    return popularSearches.map(s => s.query);
  };

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    onSearch(searchQuery);
    setShowSuggestions(false);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
    setShowSuggestions(false);
  };

  const suggestions = getSuggestions();

  return (
    <div ref={searchRef} className="relative flex-1 max-w-3xl">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Sparkles className="absolute left-11 top-1/2 -translate-y-1/2 w-4 h-4 text-green-yellow animate-pulse" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
          placeholder="Search prompts with AI-powered suggestions..."
          className="w-full pl-20 pr-12 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-light-sea-green focus:border-transparent transition-all duration-200 text-sm font-medium"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-all duration-200"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-light-sea-green/5 to-green-yellow/5">
            <div className="flex items-center gap-2">
              {query.length > 2 ? (
                <>
                  <Sparkles className="w-4 h-4 text-jungle-green" />
                  <span className="text-xs font-semibold text-gray-700">AI-Powered Suggestions</span>
                </>
              ) : (
                <>
                  <Star className="w-4 h-4 text-jungle-green" />
                  <span className="text-xs font-semibold text-gray-700">Popular Searches</span>
                </>
              )}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSearch(suggestion)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-all duration-200 group border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-jungle-green to-light-sea-green rounded-lg flex items-center justify-center flex-shrink-0">
                    <Search className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm text-gray-700 group-hover:text-light-sea-green font-medium">
                    {suggestion}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
