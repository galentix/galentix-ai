import { useState, useEffect, useCallback } from 'react';
import { Cpu, HardDrive, Server, Info, RefreshCw, Download, Trash2, Check, Users, UserPlus, Shield, ShieldOff, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import * as api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { DeviceInfo, SystemStats, Settings, SettingsUpdate, ModelInfo } from '../types';

interface ManagedUser {
  id: string;
  username: string;
  email: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function SettingsPage() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [activeModel, setActiveModel] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<{ status: string; percent?: number } | null>(null);
  const [switchingModel, setSwitchingModel] = useState<string | null>(null);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // User management state (admin only)
  const authUser = useAuthStore((s) => s.user);
  const isAdmin = authUser?.role === 'admin';

  // Editable settings state (admin only)
  const [editTemperature, setEditTemperature] = useState<number>(0.7);
  const [editMaxTokens, setEditMaxTokens] = useState<number>(2048);
  const [editRagEnabled, setEditRagEnabled] = useState<boolean>(true);
  const [editRagTopK, setEditRagTopK] = useState<number>(5);
  const [editSearchEnabled, setEditSearchEnabled] = useState<boolean>(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null);

  const API_BASE = '/api';

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch(`${API_BASE}/auth/users`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, [isAdmin]);

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) return;
    setUserActionLoading('add');
    try {
      const response = await fetch(`${API_BASE}/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
      });
      if (response.ok) {
        setStatusMessage({ text: `User "${newUsername.trim()}" created successfully`, type: 'success' });
        setNewUsername('');
        setNewPassword('');
        setNewRole('user');
        setShowAddUser(false);
        await loadUsers();
      } else {
        const err = await response.json().catch(() => ({ detail: 'Failed to create user' }));
        setStatusMessage({ text: err.detail || 'Failed to create user', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: `Failed to create user: ${err}`, type: 'error' });
    } finally {
      setUserActionLoading(null);
    }
  };

  const handleDeleteUser = async (user: ManagedUser) => {
    if (user.id === authUser?.id) return;
    if (!window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    setUserActionLoading(user.id);
    try {
      const response = await fetch(`${API_BASE}/auth/users/${user.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        setStatusMessage({ text: `User "${user.username}" deleted`, type: 'success' });
        await loadUsers();
      } else {
        const err = await response.json().catch(() => ({ detail: 'Failed to delete user' }));
        setStatusMessage({ text: err.detail || 'Failed to delete user', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: `Failed to delete user: ${err}`, type: 'error' });
    } finally {
      setUserActionLoading(null);
    }
  };

  const handleToggleActive = async (user: ManagedUser) => {
    setUserActionLoading(user.id);
    try {
      const response = await fetch(`${API_BASE}/auth/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      if (response.ok) {
        setStatusMessage({
          text: `User "${user.username}" ${user.is_active ? 'deactivated' : 'activated'}`,
          type: 'success',
        });
        await loadUsers();
      } else {
        const err = await response.json().catch(() => ({ detail: 'Failed to update user' }));
        setStatusMessage({ text: err.detail || 'Failed to update user', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: `Failed to update user: ${err}`, type: 'error' });
    } finally {
      setUserActionLoading(null);
    }
  };

  const handleToggleRole = async (user: ManagedUser) => {
    const newUserRole = user.role === 'admin' ? 'user' : 'admin';
    // Prevent removing admin role from the last admin
    if (user.role === 'admin') {
      const adminCount = users.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        setStatusMessage({ text: 'Cannot remove admin role from the last admin', type: 'error' });
        return;
      }
    }
    setUserActionLoading(user.id);
    try {
      const response = await fetch(`${API_BASE}/auth/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newUserRole }),
      });
      if (response.ok) {
        setStatusMessage({
          text: `User "${user.username}" role changed to ${newUserRole}`,
          type: 'success',
        });
        await loadUsers();
      } else {
        const err = await response.json().catch(() => ({ detail: 'Failed to update role' }));
        setStatusMessage({ text: err.detail || 'Failed to update role', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: `Failed to update role: ${err}`, type: 'error' });
    } finally {
      setUserActionLoading(null);
    }
  };

  const loadStaticData = async () => {
    try {
      const [device, settingsData] = await Promise.all([
        api.getDeviceInfo(),
        api.getSettings()
      ]);
      setDeviceInfo(device);
      setSettings(settingsData);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDynamicStats = async () => {
    try {
      const stats = await api.getSystemStats();
      setSystemStats(stats);
    } catch (err) {
      console.error('Failed to load system stats:', err);
    }
  };

  const loadModels = async () => {
    try {
      const data = await api.getModels();
      setModels(data.models);
      setActiveModel(data.active_model);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  useEffect(() => {
    loadStaticData();
    loadDynamicStats();
    loadModels();
    loadUsers();
    const interval = setInterval(loadDynamicStats, 10000);
    return () => clearInterval(interval);
  }, [loadUsers]);

  // Sync editable state when settings load from server
  useEffect(() => {
    if (settings) {
      setEditTemperature(settings.llm.temperature);
      setEditMaxTokens(settings.llm.max_tokens);
      setEditRagEnabled(settings.rag.enabled);
      setEditRagTopK(settings.rag.top_k);
      setEditSearchEnabled(settings.search.enabled);
      setSettingsDirty(false);
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSavingSettings(true);
    setStatusMessage(null);
    try {
      const updates: SettingsUpdate = {};
      if (editTemperature !== settings.llm.temperature) updates.temperature = editTemperature;
      if (editMaxTokens !== settings.llm.max_tokens) updates.max_tokens = editMaxTokens;
      if (editRagEnabled !== settings.rag.enabled) updates.rag_enabled = editRagEnabled;
      if (editRagTopK !== settings.rag.top_k) updates.rag_top_k = editRagTopK;
      if (editSearchEnabled !== settings.search.enabled) updates.search_enabled = editSearchEnabled;

      if (Object.keys(updates).length === 0) {
        setStatusMessage({ text: 'No changes to save', type: 'success' });
        return;
      }

      const updated = await api.updateSettings(updates);
      setSettings(updated);
      setSettingsDirty(false);
      setStatusMessage({ text: 'Settings saved successfully', type: 'success' });
    } catch (err) {
      setStatusMessage({ text: `Failed to save settings: ${err}`, type: 'error' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Mark dirty whenever an edit field differs from server state
  const markDirty = () => setSettingsDirty(true);

  const handlePullModel = async () => {
    if (!newModelName.trim()) return;
    setIsPulling(true);
    setPullProgress(null);
    setStatusMessage(null);
    try {
      const success = await api.pullModelStream(newModelName.trim(), (data) => {
        setPullProgress(data);
      });
      setStatusMessage({
        text: success ? `Model ${newModelName.trim()} downloaded successfully` : `Failed to download model`,
        type: success ? 'success' : 'error'
      });
      if (success) {
        setNewModelName('');
        await loadModels();
      }
    } catch (err) {
      setStatusMessage({ text: `Failed to download model: ${err}`, type: 'error' });
    } finally {
      setIsPulling(false);
      setPullProgress(null);
    }
  };

  const handleSwitchModel = async (modelName: string) => {
    setSwitchingModel(modelName);
    setStatusMessage(null);
    try {
      const result = await api.switchModel(modelName);
      setActiveModel(modelName);
      setStatusMessage({
        text: result.message,
        type: result.success ? 'success' : 'error'
      });
      await loadModels();
      await loadStaticData();
    } catch (err) {
      setStatusMessage({ text: `Failed to switch model: ${err}`, type: 'error' });
    } finally {
      setSwitchingModel(null);
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    if (!confirm(`Delete model "${modelName}"? This cannot be undone.`)) return;
    setDeletingModel(modelName);
    setStatusMessage(null);
    try {
      const result = await api.deleteModel(modelName);
      setStatusMessage({
        text: result.message,
        type: result.success ? 'success' : 'error'
      });
      if (result.success) {
        await loadModels();
      }
    } catch (err) {
      setStatusMessage({ text: `Failed to delete model: ${err}`, type: 'error' });
    } finally {
      setDeletingModel(null);
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
        <h1 className="text-2xl font-bold mb-6">Settings & System Info</h1>

        {/* Status Message */}
        {statusMessage && (
          <div className={`mb-6 p-4 rounded-lg border ${
            statusMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}>
            {statusMessage.text}
          </div>
        )}

        {/* Model Management - Full Width */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Cpu className="w-5 h-5 text-galentix-500" />
            <h2 className="text-lg font-semibold">AI Models</h2>
          </div>

          {/* Download New Model */}
          <div className="mb-6">
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
              Download a new model
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePullModel()}
                placeholder="Enter Ollama model ID (e.g. llama3:8b, mistral:7b)"
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-galentix-500"
                disabled={isPulling}
              />
              <button
                onClick={handlePullModel}
                disabled={isPulling || !newModelName.trim()}
                className="px-4 py-2 bg-galentix-500 text-white rounded-lg text-sm font-medium hover:bg-galentix-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isPulling ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isPulling ? 'Downloading...' : 'Download'}
              </button>
            </div>
            {/* Download Progress Bar */}
            {isPulling && pullProgress && (
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {pullProgress.status || 'Downloading...'}
                  </span>
                  {pullProgress.percent !== undefined && (
                    <span className="text-xs font-medium text-galentix-500">
                      {pullProgress.percent.toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-galentix-500 rounded-full transition-all duration-300"
                    style={{ width: `${pullProgress.percent ?? 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Models List */}
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
              Downloaded models
            </label>
            {models.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">No models found. Download one above or check Ollama status.</p>
            ) : (
              <div className="space-y-2">
                {models.map((model) => (
                  <div
                    key={model.name}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      model.name === activeModel
                        ? 'border-galentix-500 bg-galentix-500/10'
                        : 'border-gray-200 dark:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {model.name === activeModel && (
                        <Check className="w-4 h-4 text-galentix-500" />
                      )}
                      <div>
                        <span className="font-medium text-sm">{model.name}</span>
                        {model.name === activeModel && (
                          <span className="ms-2 text-xs text-galentix-500 font-medium">Active</span>
                        )}
                        {model.size && (
                          <span className="ms-2 text-xs text-gray-400">{model.size}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {model.name !== activeModel && (
                        <>
                          <button
                            onClick={() => handleSwitchModel(model.name)}
                            disabled={switchingModel !== null}
                            className="px-3 py-1 text-xs font-medium rounded-md bg-galentix-500 text-white hover:bg-galentix-600 disabled:opacity-50"
                          >
                            {switchingModel === model.name ? 'Switching...' : 'Use'}
                          </button>
                          <button
                            onClick={() => handleDeleteModel(model.name)}
                            disabled={deletingModel === model.name}
                            className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
                            title="Delete model"
                          >
                            {deletingModel === model.name ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current Config */}
          {settings && deviceInfo && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 space-y-3">
              <InfoRow label="Engine" value={deviceInfo.llm.engine.toUpperCase()} />
              {isAdmin ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">Temperature</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={editTemperature}
                        onChange={(e) => { setEditTemperature(parseFloat(e.target.value)); markDirty(); }}
                        className="w-28 accent-galentix-500"
                      />
                      <span className="font-medium w-8 text-end">{editTemperature.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">Max Tokens</span>
                    <input
                      type="number"
                      min="256"
                      max="8192"
                      step="256"
                      value={editMaxTokens}
                      onChange={(e) => { setEditMaxTokens(Math.max(256, Math.min(8192, parseInt(e.target.value) || 256))); markDirty(); }}
                      className="w-24 px-2 py-1 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-end font-medium focus:outline-none focus:ring-2 focus:ring-galentix-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  <InfoRow label="Temperature" value={settings.llm.temperature.toString()} />
                  <InfoRow label="Max Tokens" value={settings.llm.max_tokens.toString()} />
                </>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Device Info */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <Server className="w-5 h-5 text-galentix-500" />
              <h2 className="text-lg font-semibold">Device Information</h2>
            </div>

            {deviceInfo && (
              <div className="space-y-3">
                <InfoRow label="Device ID" value={deviceInfo.device_id.substring(0, 16) + '...'} />
                <InfoRow label="Version" value={deviceInfo.version} />
                <InfoRow label="Uptime" value={deviceInfo.uptime || 'N/A'} />
                <InfoRow label="CPU" value={deviceInfo.hardware.cpu_model} />
                <InfoRow label="CPU Cores" value={deviceInfo.hardware.cpu_cores.toString()} />
                <InfoRow label="RAM" value={`${deviceInfo.hardware.ram_gb} GB`} />
                <InfoRow
                  label="GPU"
                  value={deviceInfo.hardware.gpu_detected ? deviceInfo.hardware.gpu_name : 'None detected'}
                />
              </div>
            )}
          </div>

          {/* System Stats */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <HardDrive className="w-5 h-5 text-galentix-500" />
              <h2 className="text-lg font-semibold">System Resources</h2>
            </div>

            {systemStats && (
              <div className="space-y-4">
                <ResourceBar label="CPU" value={systemStats.cpu_percent} />
                <ResourceBar label="Memory" value={systemStats.memory_percent} />
                <ResourceBar label="Disk" value={systemStats.disk_percent} />
              </div>
            )}
          </div>

          {/* Usage Stats */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <Info className="w-5 h-5 text-galentix-500" />
              <h2 className="text-lg font-semibold">Usage Statistics</h2>
            </div>

            {systemStats && (
              <div className="space-y-3">
                <InfoRow label="Conversations" value={systemStats.conversations_count.toString()} />
                <InfoRow label="Messages" value={systemStats.messages_count.toString()} />
                <InfoRow label="Documents" value={systemStats.documents_count.toString()} />
              </div>
            )}
          </div>

          {/* RAG Settings */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <HardDrive className="w-5 h-5 text-galentix-500" />
              <h2 className="text-lg font-semibold">RAG Configuration</h2>
            </div>

            {settings && (
              <div className="space-y-3">
                {isAdmin ? (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">Enabled</span>
                    <button
                      type="button"
                      onClick={() => { setEditRagEnabled(!editRagEnabled); markDirty(); }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        editRagEnabled ? 'bg-galentix-500' : 'bg-gray-300 dark:bg-slate-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          editRagEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ) : (
                  <InfoRow label="Enabled" value={settings.rag.enabled ? 'Yes' : 'No'} />
                )}
                <InfoRow label="Chunk Size" value={settings.rag.chunk_size.toString()} />
                <InfoRow label="Chunk Overlap" value={settings.rag.chunk_overlap.toString()} />
                {isAdmin ? (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">Top K Results</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={editRagTopK}
                      onChange={(e) => { setEditRagTopK(Math.max(1, Math.min(20, parseInt(e.target.value) || 1))); markDirty(); }}
                      className="w-20 px-2 py-1 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-end font-medium focus:outline-none focus:ring-2 focus:ring-galentix-500"
                    />
                  </div>
                ) : (
                  <InfoRow label="Top K Results" value={settings.rag.top_k.toString()} />
                )}
              </div>
            )}
          </div>

          {/* Search Settings */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <Info className="w-5 h-5 text-galentix-500" />
              <h2 className="text-lg font-semibold">Web Search</h2>
            </div>

            {settings && (
              <div className="space-y-3">
                {isAdmin ? (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">Enabled</span>
                    <button
                      type="button"
                      onClick={() => { setEditSearchEnabled(!editSearchEnabled); markDirty(); }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        editSearchEnabled ? 'bg-galentix-500' : 'bg-gray-300 dark:bg-slate-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          editSearchEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ) : (
                  <InfoRow label="Enabled" value={settings.search.enabled ? 'Yes' : 'No'} />
                )}
                <InfoRow label="Max Results" value={settings.search.max_results.toString()} />
              </div>
            )}
          </div>
        </div>

        {/* Save Settings Button (admin only, shown when dirty) */}
        {isAdmin && settingsDirty && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="px-6 py-2.5 bg-galentix-500 text-white rounded-lg text-sm font-medium hover:bg-galentix-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              {isSavingSettings ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSavingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}

        {/* User Management Section (admin only) */}
        {isAdmin && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-galentix-500" />
                <h2 className="text-lg font-semibold">User Management</h2>
              </div>
              <button
                onClick={() => setShowAddUser(!showAddUser)}
                className="px-4 py-2 bg-galentix-500 text-white rounded-lg text-sm font-medium hover:bg-galentix-600 flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Add User
              </button>
            </div>

            {/* Add User Form */}
            {showAddUser && (
              <div className="mb-6 p-4 rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50">
                <h3 className="text-sm font-semibold mb-3">New User</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Username"
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-galentix-500"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Password"
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-galentix-500"
                  />
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-galentix-500"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddUser}
                    disabled={userActionLoading === 'add' || !newUsername.trim() || !newPassword.trim()}
                    className="px-4 py-2 bg-galentix-500 text-white rounded-lg text-sm font-medium hover:bg-galentix-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {userActionLoading === 'add' ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowAddUser(false);
                      setNewUsername('');
                      setNewPassword('');
                      setNewRole('user');
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Users List */}
            {users.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">No users found.</p>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      !user.is_active
                        ? 'border-gray-200 dark:border-slate-700 opacity-60'
                        : 'border-gray-200 dark:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{user.username}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              user.role === 'admin'
                                ? 'bg-galentix-500/20 text-galentix-500'
                                : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            {user.role === 'admin' ? 'Admin' : 'User'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs ${
                              user.is_active
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-500 dark:text-red-400'
                            }`}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {user.email && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">{user.email}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Toggle role */}
                      <button
                        onClick={() => handleToggleRole(user)}
                        disabled={userActionLoading === user.id}
                        className="p-1.5 text-gray-400 hover:text-galentix-500 disabled:opacity-50"
                        title={user.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                      >
                        {user.role === 'admin' ? (
                          <Shield className="w-4 h-4" />
                        ) : (
                          <ShieldOff className="w-4 h-4" />
                        )}
                      </button>
                      {/* Toggle active */}
                      <button
                        onClick={() => handleToggleActive(user)}
                        disabled={userActionLoading === user.id}
                        className="p-1.5 text-gray-400 hover:text-yellow-500 disabled:opacity-50"
                        title={user.is_active ? 'Deactivate user' : 'Activate user'}
                      >
                        {user.is_active ? (
                          <ToggleRight className="w-4 h-4 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </button>
                      {/* Delete user */}
                      {user.id !== authUser?.id && (
                        <button
                          onClick={() => handleDeleteUser(user)}
                          disabled={userActionLoading === user.id}
                          className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-50"
                          title="Delete user"
                        >
                          {userActionLoading === user.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Galentix AI v{deviceInfo?.version} - Local AI Assistant</p>
          <p className="mt-1">100% Private - Your data stays on this device</p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ResourceBar({ label, value }: { label: string; value: number }) {
  const getColor = (v: number) => {
    if (v > 90) return 'bg-red-500';
    if (v > 70) return 'bg-yellow-500';
    return 'bg-galentix-500';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <span className="text-sm font-medium">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
