import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Trash2, RefreshCw, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import * as api from '../services/api';
import type { Document } from '../types';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const interval = setInterval(loadDocuments, 5000);
    return () => clearInterval(interval);
  }, []);

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
    if (!confirm('Are you sure you want to delete this document?')) return;
    
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

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold mb-2">Documents</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Upload documents to enable AI-powered question answering (RAG)
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 animate-slide-up" role="alert">
            {error}
          </div>
        )}

        <div
          {...getRootProps()}
          role="button"
          tabIndex={0}
          aria-label="Upload documents"
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 mb-6 focus:ring-2 focus:ring-galentix-300 focus:ring-offset-2 ${
            isDragActive
              ? 'border-galentix-300 bg-galentix-50 dark:bg-galentix-900/20 scale-[1.02]'
              : 'border-gray-300 dark:border-slate-600 hover:border-galentix-300 hover:shadow-lg hover:shadow-galentix-300/10'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className={`w-12 h-12 mx-auto mb-4 transition-transform ${isDragActive ? 'text-galentix-300 scale-110' : 'text-gray-400'}`} />
          {isUploading ? (
            <p className="text-gray-600 dark:text-gray-300">Uploading...</p>
          ) : isDragActive ? (
            <p className="text-galentix-600 dark:text-galentix-300">Drop files here...</p>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                Drag & drop files here, or click to select
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Supported: PDF, TXT, MD, DOCX, CSV, JSON
              </p>
            </>
          )}
        </div>

        {isLoading && documents.length === 0 ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 animate-fade-in">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No documents uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc, index) => (
              <div
                key={doc.id}
                className="bg-white dark:bg-slate-800 rounded-lg p-4 flex items-center gap-4 border border-gray-200 dark:border-slate-700 hover:shadow-lg hover:shadow-galentix-300/5 transition-all duration-200 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.original_name}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-xs">{doc.file_type.toUpperCase()}</span>
                    {doc.chunk_count > 0 && (
                      <span>{doc.chunk_count} chunks</span>
                    )}
                  </div>
                  {doc.error_message && (
                    <p className="text-sm text-red-500 mt-1">{doc.error_message}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {getStatusIcon(doc.status)}
                  <span className="text-sm capitalize hidden sm:inline">{doc.status}</span>
                </div>

                <div className="flex items-center gap-1">
                  {doc.status === 'error' && (
                    <button
                      onClick={() => handleReprocess(doc.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors focus:ring-2 focus:ring-galentix-300"
                      title="Reprocess"
                      aria-label={`Reprocess ${doc.original_name}`}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-500 focus:ring-2 focus:ring-red-300"
                    title="Delete"
                    aria-label={`Delete ${doc.original_name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
