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
  const [pullProgress, setPullProgress] = useState<{ status: string; percent?: number } | null>(null);
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
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-galentix-300" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 animate-fade-in">Settings & System Info</h1>

        {statusMessage && (
          <div 
            className={`mb-6 p-4 rounded-lg border animate-slide-up ${
              statusMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
            }`}
            role="alert"
          >
            {statusMessage.text}
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700 mb-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-galentix-300 to-galentix-500 flex items-center justify-center shadow-lg shadow-galentix-300/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold">AI Models</h2>
          </div>

          <div className="mb-6">
            <label htmlFor="model-input" className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
              Download a new model
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="model-input"
                type="text"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePullModel()}
                placeholder="Enter Ollama model ID (e.g. llama3:8b, mistral:7b)"
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-galentix-300 focus:border-transparent transition-all"
                disabled={isPulling}
                aria-describedby="model-help"
              />
              <button
                onClick={handlePullModel}
                disabled={isPulling || !newModelName.trim()}
                className="px-4 py-2 bg-gradient-to-r from-galentix-300 to-galentix-400 text-white rounded-lg text-sm font-medium hover:from-galentix-400 hover:to-galentix-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-galentix-300/20 focus:ring-2 focus:ring-galentix-300 focus:ring-offset-2"
              >
                {isPulling ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isPulling ? 'Downloading...' : 'Download'}
              </button>
            </div>
            <p id="model-help" className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Enter the Ollama model ID from model library
            </p>
            {isPulling && pullProgress && (
              <div className="mt-3 animate-fade-in">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {pullProgress.status || 'Downloading...'}
                  </span>
                  {pullProgress.percent !== undefined && (
                    <span className="text-xs font-medium text-galentix-300">
                      {pullProgress.percent.toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-galentix-300 to-galentix-400 rounded-full transition-all duration-300"
                    style={{ width: `${pullProgress.percent ?? 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
              Downloaded models
            </label>
            {models.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">No models found. Download one above or check Ollama status.</p>
            ) : (
              <div className="space-y-2">
                {models.map((model, index) => (
                  <div
                    key={model.name}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                      model.name === activeModel
                        ? 'border-galentix-300 bg-galentix-300/10 shadow-sm'
                        : 'border-gray-200 dark:border-slate-600 hover:border-galentix-200 dark:hover:border-galentix-700'
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
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
                            className="px-3 py-1 text-xs font-medium rounded-md bg-galentix-300 text-white hover:bg-galentix-400 disabled:opacity-50 transition-all hover:shadow-md"
                          >
                            {switchingModel === model.name ? 'Switching...' : 'Use'}
                          </button>
                          <button
                            onClick={() => handleDeleteModel(model.name)}
                            disabled={deletingModel === model.name}
                            className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                            title="Delete model"
                            aria-label={`Delete model ${model.name}`}
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

          {settings && deviceInfo && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 space-y-3">
              <InfoRow label="Engine" value={deviceInfo.llm.engine.toUpperCase()} />
              <InfoRow label="Temperature" value={settings.llm.temperature.toString()} />
              <InfoRow label="Max Tokens" value={settings.llm.max_tokens.toString()} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { icon: Server, title: 'Device Information', info: deviceInfo ? [
              { label: 'Device ID', value: deviceInfo.device_id.substring(0, 16) + '...' },
              { label: 'Version', value: deviceInfo.version },
              { label: 'Uptime', value: deviceInfo.uptime || 'N/A' },
              { label: 'CPU', value: deviceInfo.hardware.cpu_model },
              { label: 'CPU Cores', value: deviceInfo.hardware.cpu_cores.toString() },
              { label: 'RAM', value: `${deviceInfo.hardware.ram_gb} GB` },
              { label: 'GPU', value: deviceInfo.hardware.gpu_detected ? deviceInfo.hardware.gpu_name : 'None detected' },
            ] : [] },
            { icon: HardDrive, title: 'System Resources', stats: systemStats ? [
              { label: 'CPU', value: systemStats.cpu_percent },
              { label: 'Memory', value: systemStats.memory_percent },
              { label: 'Disk', value: systemStats.disk_percent },
            ] : [] },
            { icon: Info, title: 'Usage Statistics', info: systemStats ? [
              { label: 'Conversations', value: systemStats.conversations_count.toString() },
              { label: 'Messages', value: systemStats.messages_count.toString() },
              { label: 'Documents', value: systemStats.documents_count.toString() },
            ] : [] },
            { icon: HardDrive, title: 'RAG Configuration', info: settings ? [
              { label: 'Enabled', value: settings.rag.enabled ? 'Yes' : 'No' },
              { label: 'Chunk Size', value: settings.rag.chunk_size.toString() },
              { label: 'Chunk Overlap', value: settings.rag.chunk_overlap.toString() },
              { label: 'Top K Results', value: settings.rag.top_k.toString() },
            ] : [] },
            { icon: Info, title: 'Web Search', info: settings ? [
              { label: 'Enabled', value: settings.search.enabled ? 'Yes' : 'No' },
              { label: 'Max Results', value: settings.search.max_results.toString() },
            ] : [] },
          ].map((card, index) => (
            <div 
              key={card.title}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700 hover:shadow-lg hover:shadow-galentix-300/5 transition-all duration-200 animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-galentix-300/20 to-galentix-500/20 flex items-center justify-center">
                  <card.icon className="w-5 h-5 text-galentix-300" />
                </div>
                <h2 className="text-lg font-semibold">{card.title}</h2>
              </div>
              
              {'stats' in card && card.stats ? (
                <div className="space-y-4">
                  {card.stats.map(stat => (
                    <ResourceBar key={stat.label} label={stat.label} value={stat.value} />
                  ))}
                </div>
              ) : 'info' in card && card.info ? (
                <div className="space-y-3">
                  {card.info.map(item => (
                    <InfoRow key={item.label} label={item.label} value={item.value} />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Galentix AI v{deviceInfo?.version} - Local AI Assistant
          </div>
          <p>100% Private - Your data stays on this device</p>
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
    if (v > 90) return 'bg-gradient-to-r from-red-500 to-red-600';
    if (v > 70) return 'bg-gradient-to-r from-yellow-500 to-yellow-600';
    return 'bg-gradient-to-r from-galentix-300 to-galentix-400';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <span className="text-sm font-medium">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
