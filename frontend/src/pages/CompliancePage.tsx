import { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  Database,
  HardDrive,
  Trash2,
  Clock,
  Save,
  RefreshCw,
  FileText,
  MessageSquare,
  Users,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from '../components/ui/Card';
import { useAuthStore } from '../stores/authStore';
import * as api from '../services/api';
import type { SystemStats } from '../types';
import type { AuditLogEntry } from '../services/api';

export default function CompliancePage() {
  useEffect(() => { document.title = "Compliance - Galentix AI"; }, []);
  const { t } = useTranslation();
  const authUser = useAuthStore((s) => s.user);
  const isAdmin = authUser?.role === 'admin';

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [dataPaths, setDataPaths] = useState({ data_dir: '', chroma_dir: '' });
  const [retentionDays, setRetentionDays] = useState<number>(0);
  const [isSavingRetention, setIsSavingRetention] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLogsOpen, setAuditLogsOpen] = useState(false);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditLogsPage, setAuditLogsPage] = useState(0);
  const AUDIT_PAGE_SIZE = 20;

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsData, settingsData, searchStatus] = await Promise.all([
          api.getSystemStats(),
          api.getSettings(),
          api.getSearchStatus(),
        ]);
        setStats(statsData);
        setWebSearchEnabled(searchStatus.enabled);
        if (settingsData.paths) {
          setDataPaths(settingsData.paths);
        }
      } catch (err) {
        console.error('Failed to load compliance data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handlePurgeAll = async () => {
    setShowPurgeConfirm(false);
    setIsPurging(true);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/system/purge', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        setStatusMessage({
          text: t('compliance.purgeSuccess'),
          type: 'success',
        });
        // Refresh stats
        const updatedStats = await api.getSystemStats();
        setStats(updatedStats);
      } else {
        const err = await response
          .json()
          .catch(() => ({ detail: t('compliance.purgeFailed') }));
        setStatusMessage({
          text: err.detail || t('compliance.purgeFailed'),
          type: 'error',
        });
      }
    } catch {
      setStatusMessage({ text: t('compliance.purgeFailed'), type: 'error' });
    } finally {
      setIsPurging(false);
    }
  };

  const handleSaveRetention = async () => {
    setIsSavingRetention(true);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/system/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ retention_days: retentionDays }),
      });
      if (response.ok) {
        setStatusMessage({
          text: t('compliance.retentionSaved'),
          type: 'success',
        });
      } else {
        const err = await response
          .json()
          .catch(() => ({ detail: t('compliance.retentionFailed') }));
        setStatusMessage({
          text: err.detail || t('compliance.retentionFailed'),
          type: 'error',
        });
      }
    } catch {
      setStatusMessage({
        text: t('compliance.retentionFailed'),
        type: 'error',
      });
    } finally {
      setIsSavingRetention(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 bg-gray-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-7 h-7 text-galentix-500" />
          <div>
            <h1 className="text-2xl font-bold">
              {t('compliance.title')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('compliance.subtitle')}
            </p>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              statusMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Section 1: Data Residency Status */}
        <Card
          title={t('compliance.dataResidency')}
          icon={<Database className="w-5 h-5" />}
          className="mb-6"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-sm">
                {t('compliance.residency.localData')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-sm">
                {t('compliance.residency.noCloud')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-sm">
                {t('compliance.residency.dbLocation', { dbPath: dataPaths.data_dir || '...' })}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-sm">
                {t('compliance.residency.vectorLocation', { vectorPath: dataPaths.chroma_dir || '...' })}
              </span>
            </div>

            {webSearchEnabled && (
              <div className="flex items-start gap-3 mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  {t('compliance.residency.webSearchWarning')}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Section 2: PDPL Compliance Checklist */}
        <Card
          title={t('compliance.pdplChecklist')}
          icon={<Shield className="w-5 h-5" />}
          className="mb-6"
        >
          <div className="space-y-4">
            {/* Data Minimization */}
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-sm font-medium">
                  {t('compliance.checklist.dataMinimization')}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('compliance.checklist.dataMinimizationDesc')}
                </p>
              </div>
            </div>

            {/* Data Localization */}
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-sm font-medium">
                  {t('compliance.checklist.dataLocalization')}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('compliance.checklist.dataLocalizationDesc')}
                </p>
              </div>
            </div>

            {/* Right to Deletion */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <Trash2 className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-medium">
                  {t('compliance.checklist.rightToDeletion')}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-2">
                  {t('compliance.checklist.rightToDeletionDesc')}
                </p>
                {!showPurgeConfirm ? (
                  <button
                    onClick={() => setShowPurgeConfirm(true)}
                    disabled={isPurging}
                    className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('compliance.purgeButton')}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="text-sm text-red-700 dark:text-red-300 flex-1">
                      {t('compliance.purgeConfirmText')}
                    </span>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={handlePurgeAll}
                        disabled={isPurging}
                        className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {isPurging && (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        )}
                        {t('common.confirm')}
                      </button>
                      <button
                        onClick={() => setShowPurgeConfirm(false)}
                        className="px-3 py-1.5 bg-gray-200 dark:bg-slate-600 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Access Control */}
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-sm font-medium">
                  {t('compliance.checklist.accessControl')}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('compliance.checklist.accessControlDesc')}
                </p>
              </div>
            </div>

            {/* Audit Trail */}
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-sm font-medium">
                  {t('compliance.checklist.auditTrail')}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('compliance.checklist.auditTrailDesc')}
                </p>
                {isAdmin && (
                  <button
                    onClick={async () => {
                      setAuditLogsOpen(true);
                      setAuditLogsLoading(true);
                      setAuditLogsPage(0);
                      try {
                        const logs = await api.fetchAuditLogs(0, AUDIT_PAGE_SIZE);
                        setAuditLogs(logs);
                      } catch {
                        setAuditLogs([]);
                      } finally {
                        setAuditLogsLoading(false);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs text-galentix-500 hover:text-galentix-600 mt-1"
                  >
                    {t('compliance.checklist.viewAuditLogs')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Section 3: System Privacy Summary */}
        <Card
          title={t('compliance.privacySummary')}
          icon={<HardDrive className="w-5 h-5" />}
          className="mb-6"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
              <MessageSquare className="w-5 h-5 text-galentix-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {stats?.conversations_count ?? '-'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('compliance.summary.conversations')}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
              <FileText className="w-5 h-5 text-galentix-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {stats?.documents_count ?? '-'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('compliance.summary.documents')}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
              <Users className="w-5 h-5 text-galentix-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {stats?.messages_count ?? '-'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('compliance.summary.messages')}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
              <HardDrive className="w-5 h-5 text-galentix-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {stats?.disk_percent != null
                  ? `${stats.disk_percent.toFixed(1)}%`
                  : '-'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('compliance.summary.storageUsed')}
              </p>
            </div>
          </div>
        </Card>

        {/* Section 4: Data Retention (admin only) */}
        {isAdmin && (
          <Card
            title={t('compliance.dataRetention')}
            icon={<Clock className="w-5 h-5" />}
            className="mb-6"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('compliance.retention.autoDeleteLabel')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={3650}
                    value={retentionDays}
                    onChange={(e) =>
                      setRetentionDays(
                        Math.max(0, Math.min(3650, parseInt(e.target.value) || 0))
                      )
                    }
                    className="w-32 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-galentix-500"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t('compliance.retention.days')}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Set to 0 to disable auto-deletion
                </p>
              </div>
              <button
                onClick={handleSaveRetention}
                disabled={isSavingRetention}
                className="px-4 py-2 bg-galentix-500 text-white rounded-lg text-sm font-medium hover:bg-galentix-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSavingRetention ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSavingRetention
                  ? t('settings.saving')
                  : t('common.save')}
              </button>
            </div>
          </Card>
        )}
      </div>

      {/* Audit Logs Modal */}
      {auditLogsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setAuditLogsOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-3xl mx-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-xl p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Audit Logs</h2>
              <button
                onClick={() => setAuditLogsOpen(false)}
                aria-label="Close audit logs"
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {auditLogsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No audit logs found.</p>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700">
                      <th className="text-start py-2 px-3 font-medium text-gray-600 dark:text-gray-300">Timestamp</th>
                      <th className="text-start py-2 px-3 font-medium text-gray-600 dark:text-gray-300">User</th>
                      <th className="text-start py-2 px-3 font-medium text-gray-600 dark:text-gray-300">Action</th>
                      <th className="text-start py-2 px-3 font-medium text-gray-600 dark:text-gray-300">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 dark:border-slate-700/50">
                        <td className="py-2 px-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2 px-3">{log.user}</td>
                        <td className="py-2 px-3">{log.action}</td>
                        <td className="py-2 px-3 text-gray-500 dark:text-gray-400 truncate max-w-xs" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={async () => {
                  const newPage = Math.max(0, auditLogsPage - 1);
                  setAuditLogsPage(newPage);
                  setAuditLogsLoading(true);
                  try {
                    const logs = await api.fetchAuditLogs(newPage * AUDIT_PAGE_SIZE, AUDIT_PAGE_SIZE);
                    setAuditLogs(logs);
                  } catch {
                    setAuditLogs([]);
                  } finally {
                    setAuditLogsLoading(false);
                  }
                }}
                disabled={auditLogsPage === 0 || auditLogsLoading}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">Page {auditLogsPage + 1}</span>
              <button
                onClick={async () => {
                  const newPage = auditLogsPage + 1;
                  setAuditLogsPage(newPage);
                  setAuditLogsLoading(true);
                  try {
                    const logs = await api.fetchAuditLogs(newPage * AUDIT_PAGE_SIZE, AUDIT_PAGE_SIZE);
                    setAuditLogs(logs);
                  } catch {
                    setAuditLogs([]);
                  } finally {
                    setAuditLogsLoading(false);
                  }
                }}
                disabled={auditLogs.length < AUDIT_PAGE_SIZE || auditLogsLoading}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
