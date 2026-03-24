import { useState, useEffect } from 'react';
import { Cpu, HardDrive, Server, Info, RefreshCw, Download, Trash2, Check } from 'lucide-react';
import * as api from '../services/api';
import type { DeviceInfo, SystemStats, Settings, ModelInfo } from '../types';

export default function SettingsPage() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [activeModel, setActiveModel] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [switchingModel, setSwitchingModel] = useState<string | null>(null);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const [device, stats, settingsData] = await Promise.all([
        api.getDeviceInfo(),
        api.getSystemStats(),
        api.getSettings()
      ]);
      setDeviceInfo(device);
      setSystemStats(stats);
      setSettings(settingsData);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
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
    loadData();
    loadModels();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handlePullModel = async () => {
    if (!newModelName.trim()) return;
    setIsPulling(true);
    setStatusMessage(null);
    try {
      const result = await api.pullModel(newModelName.trim());
      setStatusMessage({
        text: result.message,
        type: result.success ? 'success' : 'error'
      });
      if (result.success) {
        setNewModelName('');
        await loadModels();
      }
    } catch (err) {
      setStatusMessage({ text: `Failed to download model: ${err}`, type: 'error' });
    } finally {
      setIsPulling(false);
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
      await loadData();
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
            <Cpu className="w-5 h-5 text-galentix-300" />
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
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-galentix-300"
                disabled={isPulling}
              />
              <button
                onClick={handlePullModel}
                disabled={isPulling || !newModelName.trim()}
                className="px-4 py-2 bg-galentix-300 text-white rounded-lg text-sm font-medium hover:bg-galentix-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isPulling ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isPulling ? 'Downloading...' : 'Download'}
              </button>
            </div>
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
                        ? 'border-galentix-300 bg-galentix-300/10'
                        : 'border-gray-200 dark:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {model.name === activeModel && (
                        <Check className="w-4 h-4 text-galentix-300" />
                      )}
                      <div>
                        <span className="font-medium text-sm">{model.name}</span>
                        {model.name === activeModel && (
                          <span className="ml-2 text-xs text-galentix-300 font-medium">Active</span>
                        )}
                        {model.size && (
                          <span className="ml-2 text-xs text-gray-400">{model.size}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {model.name !== activeModel && (
                        <>
                          <button
                            onClick={() => handleSwitchModel(model.name)}
                            disabled={switchingModel !== null}
                            className="px-3 py-1 text-xs font-medium rounded-md bg-galentix-300 text-white hover:bg-galentix-400 disabled:opacity-50"
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
              <InfoRow label="Temperature" value={settings.llm.temperature.toString()} />
              <InfoRow label="Max Tokens" value={settings.llm.max_tokens.toString()} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Device Info */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <Server className="w-5 h-5 text-galentix-300" />
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
              <HardDrive className="w-5 h-5 text-galentix-300" />
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
              <Info className="w-5 h-5 text-galentix-300" />
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
              <HardDrive className="w-5 h-5 text-galentix-300" />
              <h2 className="text-lg font-semibold">RAG Configuration</h2>
            </div>

            {settings && (
              <div className="space-y-3">
                <InfoRow label="Enabled" value={settings.rag.enabled ? 'Yes' : 'No'} />
                <InfoRow label="Chunk Size" value={settings.rag.chunk_size.toString()} />
                <InfoRow label="Chunk Overlap" value={settings.rag.chunk_overlap.toString()} />
                <InfoRow label="Top K Results" value={settings.rag.top_k.toString()} />
              </div>
            )}
          </div>

          {/* Search Settings */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <Info className="w-5 h-5 text-galentix-300" />
              <h2 className="text-lg font-semibold">Web Search</h2>
            </div>

            {settings && (
              <div className="space-y-3">
                <InfoRow label="Enabled" value={settings.search.enabled ? 'Yes' : 'No'} />
                <InfoRow label="Max Results" value={settings.search.max_results.toString()} />
              </div>
            )}
          </div>
        </div>

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
    return 'bg-galentix-300';
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
