import { FileText, Globe, X, ExternalLink } from 'lucide-react';
import type { Source, WebSearchResult } from '../../types';

interface SourcesPanelProps {
  sources: Source[];
  webResults: WebSearchResult[];
  onClose?: () => void;
}

export default function SourcesPanel({ sources, webResults, onClose }: SourcesPanelProps) {
  if (sources.length === 0 && webResults.length === 0) {
    return null;
  }

  return (
    <div className="w-80 border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <h3 className="font-semibold">Sources</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Document sources */}
        {sources.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documents
            </h4>
            <div className="space-y-2">
              {sources.map((source, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-slate-700"
                >
                  <p className="font-medium text-sm truncate">{source.filename}</p>
                  {source.chunk !== undefined && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Chunk {source.chunk + 1}
                    </p>
                  )}
                  {source.similarity !== undefined && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>Relevance</span>
                        <span>{Math.round(source.similarity * 100)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-galentix-300 rounded-full"
                          style={{ width: `${source.similarity * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Web search results */}
        {webResults.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Web Results
            </h4>
            <div className="space-y-2">
              {webResults.map((result, index) => (
                <a
                  key={index}
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm line-clamp-2">{result.title}</p>
                    <ExternalLink className="w-4 h-4 flex-shrink-0 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {result.snippet}
                  </p>
                  <p className="text-xs text-galentix-400 mt-1 truncate">
                    {result.source}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
