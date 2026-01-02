import { useState, useEffect, useCallback } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { Message } from "@/services/mockData";
import { cn } from "@/lib/utils";

interface MessageSearchProps {
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (messageId: string) => void;
  onQueryChange?: (query: string) => void;
}

export function MessageSearch({ messages, isOpen, onClose, onNavigate, onQueryChange }: MessageSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Message[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Notify parent of query changes
  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);

  // Search messages when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setCurrentIndex(0);
      return;
    }

    const searchQuery = query.toLowerCase().trim();
    const matches = messages.filter((msg) =>
      msg.text?.toLowerCase().includes(searchQuery)
    );
    setResults(matches);
    setCurrentIndex(matches.length > 0 ? 0 : -1);
  }, [query, messages]);

  // Navigate to current result
  useEffect(() => {
    if (results.length > 0 && currentIndex >= 0 && currentIndex < results.length) {
      onNavigate(results[currentIndex].id);
    }
  }, [currentIndex, results, onNavigate]);

  const handlePrev = useCallback(() => {
    if (results.length === 0) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
  }, [results.length]);

  const handleNext = useCallback(() => {
    if (results.length === 0) return;
    setCurrentIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
  }, [results.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [handleNext, handlePrev, onClose]);

  const handleClose = () => {
    setQuery("");
    setResults([]);
    setCurrentIndex(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border animate-in slide-in-from-top-2 duration-200">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search messages..."
          autoFocus
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-background border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Results counter */}
      {query.trim() && (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {results.length > 0 ? `${currentIndex + 1} / ${results.length}` : "No results"}
        </span>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={handlePrev}
          disabled={results.length === 0}
          className={cn(
            "p-1.5 rounded-full transition-colors",
            results.length > 0 ? "hover:bg-accent text-foreground" : "text-muted-foreground cursor-not-allowed"
          )}
          title="Previous result (Shift+Enter)"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
        <button
          onClick={handleNext}
          disabled={results.length === 0}
          className={cn(
            "p-1.5 rounded-full transition-colors",
            results.length > 0 ? "hover:bg-accent text-foreground" : "text-muted-foreground cursor-not-allowed"
          )}
          title="Next result (Enter)"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      <button
        onClick={handleClose}
        className="p-1.5 rounded-full hover:bg-accent transition-colors"
        title="Close search"
      >
        <X className="h-5 w-5 text-muted-foreground" />
      </button>
    </div>
  );
}

// Helper function to highlight search query in text
export function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text;

  const searchQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(searchQuery);

  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <mark className="bg-yellow-300 dark:bg-yellow-500/50 text-foreground rounded px-0.5">
        {match}
      </mark>
      {highlightText(after, query)}
    </>
  );
}
