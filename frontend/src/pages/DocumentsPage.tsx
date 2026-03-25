import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Trash2, RefreshCw, CheckCircle, XCircle, Clock, Loader2, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import * as api from '../services/api';
import type { Document } from '../types';
import ConfirmDialog from '../components/ui/ConfirmDialog';

export default function DocumentsPage() {
  useEffect(() => { document.title = "Documents - Galentix AI"; }, []);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Search, sort, pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const data = await api.getDocuments();
      setDocuments(data.documents);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    // Only poll when documents are being processed
    const hasProcessing = documents.some(d =>
      d.status === 'pending' || d.status === 'processing'
    );
    if (!hasProcessing) return;

    const interval = setInterval(loadDocuments, 5000);
    return () => clearInterval(interval);
  }, [documents]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    setError(null);

    for (const file of acceptedFiles) {
      try {
        await api.uploadDocument(file);
      } catch (err) {
        setError((err as Error).message);
      }
    }

    setIsUploading(false);
    loadDocuments();
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/csv': ['.csv'],
      'application/json': ['.json']
    }
  });

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDocument(id);
      setDocuments(docs => docs.filter(d => d.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      await api.reprocessDocument(id);
      loadDocuments();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // Filtered, sorted, paginated documents
  const filteredSortedDocs = useMemo(() => {
    let filtered = documents;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = documents.filter(d => d.original_name.toLowerCase().includes(q));
    }
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name': cmp = a.original_name.localeCompare(b.original_name); break;
        case 'date': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case 'size': cmp = a.file_size - b.file_size; break;
        case 'type': cmp = a.file_type.localeCompare(b.file_type); break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [documents, searchQuery, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredSortedDocs.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedDocs = filteredSortedDocs.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-gray-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Documents</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Upload documents to enable AI-powered question answering (RAG)
        </p>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Upload zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-6 ${
            isDragActive
              ? 'border-galentix-500 bg-galentix-50 dark:bg-galentix-900/20'
              : 'border-gray-300 dark:border-slate-600 hover:border-galentix-500'
          }`}
        >
          <input {...getInputProps()} aria-label="Upload documents" />
          <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? 'text-galentix-500' : 'text-gray-400'}`} />
          {isUploading ? (
            <p className="text-gray-600 dark:text-gray-300">Uploading...</p>
          ) : isDragActive ? (
            <p className="text-galentix-600 dark:text-galentix-500">Drop files here...</p>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                {('ontouchstart' in window || navigator.maxTouchPoints > 0)
                  ? 'Tap to select files for upload'
                  : 'Drag & drop files here, or click to select'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Supported: PDF, TXT, MD, DOCX, CSV, JSON
              </p>
            </>
          )}
        </div>

        {/* Search & Sort Controls */}
        {documents.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search documents..."
                className="w-full ps-10 pe-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-galentix-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Sort:</span>
              {(['name', 'date', 'size', 'type'] as const).map((field) => (
                <button
                  key={field}
                  onClick={() => toggleSort(field)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors flex items-center gap-1 ${
                    sortBy === field
                      ? 'border-galentix-500 bg-galentix-50 dark:bg-galentix-900/20 text-galentix-600 dark:text-galentix-400'
                      : 'border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {field.charAt(0).toUpperCase() + field.slice(1)}
                  <SortIcon field={field} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Documents list */}
        {isLoading && documents.length === 0 ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No documents uploaded yet</p>
          </div>
        ) : filteredSortedDocs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No documents match your search</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedDocs.map((doc) => (
              <div
                key={doc.id}
                className="bg-white dark:bg-slate-800 rounded-lg p-4 flex items-center gap-4 border border-gray-200 dark:border-slate-700"
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-gray-500" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.original_name}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>{doc.file_type.toUpperCase()}</span>
                    {doc.chunk_count > 0 && (
                      <span>{doc.chunk_count} chunks</span>
                    )}
                  </div>
                  {doc.error_message && (
                    <p className="text-sm text-red-500 mt-1">{doc.error_message}</p>
                  )}
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  {getStatusIcon(doc.status)}
                  <span className="text-sm capitalize">{doc.status}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {doc.status === 'error' && (
                    <button
                      onClick={() => handleReprocess(doc.id)}
                      aria-label="Reprocess document"
                      className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Reprocess"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteConfirm({ id: doc.id, name: doc.original_name })}
                    aria-label="Delete document"
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-500"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {filteredSortedDocs.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Page {safePage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Delete Document"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirm) handleDelete(deleteConfirm.id);
          setDeleteConfirm(null);
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
