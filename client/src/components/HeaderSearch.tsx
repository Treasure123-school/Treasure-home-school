import { useState, useRef, useEffect } from 'react';
import { Search, X, Users, BookOpen, Calendar, FileText, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';

interface SearchResult {
  id: string;
  title: string;
  type: 'student' | 'teacher' | 'class' | 'exam' | 'announcement';
  description?: string;
  href: string;
}

interface HeaderSearchProps {
  userRole: 'student' | 'teacher' | 'admin' | 'parent' | 'superadmin';
}

export function HeaderSearch({ userRole }: HeaderSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
        setQuery('');
        setResults([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.length >= 2) {
        setIsLoading(true);
        try {
          const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&role=${userRole}`);
          if (response.ok) {
            const data = await response.json();
            setResults(data.results || []);
          }
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query, userRole]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'student':
        return <GraduationCap className="h-4 w-4 text-blue-500" />;
      case 'teacher':
        return <Users className="h-4 w-4 text-green-500" />;
      case 'class':
        return <BookOpen className="h-4 w-4 text-purple-500" />;
      case 'exam':
        return <FileText className="h-4 w-4 text-orange-500" />;
      case 'announcement':
        return <Calendar className="h-4 w-4 text-pink-500" />;
      default:
        return <Search className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    navigate(result.href);
    setIsExpanded(false);
    setQuery('');
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsExpanded(false);
      setQuery('');
      setResults([]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {!isExpanded ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(true)}
          className="h-9 w-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
          data-testid="button-search-expand"
          title="Search"
        >
          <Search className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </Button>
      ) : (
        <div className="flex items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-48 sm:w-64 pl-10 pr-8 h-9 rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              data-testid="input-search"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsExpanded(false);
                setQuery('');
                setResults([]);
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-gray-200 dark:hover:bg-gray-700"
              data-testid="button-search-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {(results.length > 0 || isLoading) && (
            <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                  Searching...
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {results.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className="w-full p-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                      data-testid={`search-result-${result.id}`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getTypeIcon(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {result.title}
                        </p>
                        {result.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {result.description}
                          </p>
                        )}
                        <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                          {result.type}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
