import { useState, useEffect } from 'react';
import { Cpu, HardDrive, Server, Info, RefreshCw } from 'lucide-react';
import * as api from '../services/api';
import type { DeviceInfo, SystemStats, Settings } from '../types';

export default function SettingsPage() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
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

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

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

          {/* LLM Configuration */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <Cpu className="w-5 h-5 text-galentix-300" />
              <h2 className="text-lg font-semibold">AI Model</h2>
            </div>
            
            {settings && deviceInfo && (
              <div className="space-y-3">
                <InfoRow label="Engine" value={deviceInfo.llm.engine.toUpperCase()} />
                <InfoRow label="Model" value={deviceInfo.llm.model} />
                <InfoRow label="Temperature" value={settings.llm.temperature.toString()} />
                <InfoRow label="Max Tokens" value={settings.llm.max_tokens.toString()} />
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
