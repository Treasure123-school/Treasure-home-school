import { useState, useRef, useEffect } from 'react';
import { Search, X, Users, BookOpen, Calendar, FileText, GraduationCap } from 'lucide-react';
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
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
      case 'student': return <GraduationCap className="h-3.5 w-3.5 text-blue-500" />;
      case 'teacher': return <Users className="h-3.5 w-3.5 text-green-500" />;
      case 'class': return <BookOpen className="h-3.5 w-3.5 text-purple-500" />;
      case 'exam': return <FileText className="h-3.5 w-3.5 text-orange-500" />;
      case 'announcement': return <Calendar className="h-3.5 w-3.5 text-pink-500" />;
      default: return <Search className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    navigate(result.href);
    setIsFocused(false);
    setQuery('');
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsFocused(false);
      setQuery('');
      setResults([]);
      inputRef.current?.blur();
    }
  };

  const showDropdown = isFocused && (results.length > 0 || isLoading);

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={`flex items-center gap-2 w-full h-8 px-3 rounded-lg border bg-muted/50 transition-all duration-200 ${
          isFocused
            ? 'border-primary/50 bg-background shadow-sm ring-1 ring-primary/20'
            : 'border-border hover:border-border/80 hover:bg-muted/70'
        }`}
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search anything..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          data-testid="input-search"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-search-clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-background rounded-lg shadow-lg border border-border overflow-hidden z-50">
          {isLoading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Searching...
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/60 transition-colors text-left border-b border-border last:border-b-0"
                  data-testid={`search-result-${result.id}`}
                >
                  <div className="flex-shrink-0">{getTypeIcon(result.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                    {result.description && (
                      <p className="text-xs text-muted-foreground truncate">{result.description}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                    {result.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
