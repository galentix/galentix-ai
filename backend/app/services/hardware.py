"""
Galentix AI - Hardware Detection Service
Automatically detects system capabilities and recommends optimal configuration.
"""
import os
import subprocess
import platform
from typing import Optional, Dict, Any
from dataclasses import dataclass


@dataclass
class GPUInfo:
    """GPU information."""
    detected: bool = False
    name: str = "None"
    vram_gb: int = 0
    cuda_available: bool = False


@dataclass
class HardwareInfo:
    """Complete hardware information."""
    ram_gb: int = 0
    cpu_cores: int = 0
    cpu_model: str = "Unknown"
    gpu: GPUInfo = None
    
    def __post_init__(self):
        if self.gpu is None:
            self.gpu = GPUInfo()


class HardwareDetector:
    """Detects system hardware and recommends LLM configuration."""
    
    def __init__(self):
        self._hardware_info: Optional[HardwareInfo] = None
    
    def detect(self) -> HardwareInfo:
        """Detect all hardware information."""
        if self._hardware_info is not None:
            return self._hardware_info
        
        info = HardwareInfo()
        
        # Detect RAM
        info.ram_gb = self._detect_ram()
        
        # Detect CPU
        info.cpu_cores = os.cpu_count() or 1
        info.cpu_model = self._detect_cpu_model()
        
        # Detect GPU
        info.gpu = self._detect_gpu()
        
        self._hardware_info = info
        return info
    
    def _detect_ram(self) -> int:
        """Detect total RAM in GB."""
        try:
            if platform.system() == "Linux":
                with open("/proc/meminfo", "r") as f:
                    for line in f:
                        if line.startswith("MemTotal"):
                            kb = int(line.split()[1])
                            return kb // 1024 // 1024
            elif platform.system() == "Windows":
                import ctypes
                kernel32 = ctypes.windll.kernel32
                c_ulong = ctypes.c_ulong
                class MEMORYSTATUS(ctypes.Structure):
                    _fields_ = [
                        ('dwLength', c_ulong),
                        ('dwMemoryLoad', c_ulong),
                        ('dwTotalPhys', c_ulong),
                        ('dwAvailPhys', c_ulong),
                        ('dwTotalPageFile', c_ulong),
                        ('dwAvailPageFile', c_ulong),
                        ('dwTotalVirtual', c_ulong),
                        ('dwAvailVirtual', c_ulong),
                    ]
                memoryStatus = MEMORYSTATUS()
                memoryStatus.dwLength = ctypes.sizeof(MEMORYSTATUS)
                kernel32.GlobalMemoryStatus(ctypes.byref(memoryStatus))
                return memoryStatus.dwTotalPhys // 1024 // 1024 // 1024
        except Exception:
            pass
        return 4  # Default assumption
    
    def _detect_cpu_model(self) -> str:
        """Detect CPU model name."""
        try:
            if platform.system() == "Linux":
                with open("/proc/cpuinfo", "r") as f:
                    for line in f:
                        if "model name" in line:
                            return line.split(":")[1].strip()
            elif platform.system() == "Windows":
                return platform.processor()
        except Exception:
            pass
        return "Unknown CPU"
    
    def _detect_gpu(self) -> GPUInfo:
        """Detect NVIDIA GPU information."""
        gpu = GPUInfo()
        
        try:
            # Check if nvidia-smi is available
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0 and result.stdout.strip():
                parts = result.stdout.strip().split(",")
                gpu.detected = True
                gpu.name = parts[0].strip()
                gpu.vram_gb = int(parts[1].strip()) // 1024
                gpu.cuda_available = True
        except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
            pass
        
        return gpu
    
    def get_recommended_config(self) -> Dict[str, Any]:
        """Get recommended LLM configuration based on hardware."""
        hw = self.detect()
        
        config = {
            "engine": "ollama",
            "model": "tinyllama",
            "reason": ""
        }
        
        # Check if GPU is available and has enough VRAM
        if hw.gpu.detected and hw.gpu.vram_gb >= 8:
            config["engine"] = "vllm"
            
            if hw.gpu.vram_gb >= 24:
                config["model"] = "meta-llama/Llama-3-70b-chat-hf"
                config["reason"] = f"GPU with {hw.gpu.vram_gb}GB VRAM detected - using large model"
            elif hw.gpu.vram_gb >= 16:
                config["model"] = "meta-llama/Llama-3-8b-chat-hf"
                config["reason"] = f"GPU with {hw.gpu.vram_gb}GB VRAM detected - using medium model"
            else:
                config["model"] = "mistralai/Mistral-7B-Instruct-v0.2"
                config["reason"] = f"GPU with {hw.gpu.vram_gb}GB VRAM detected - using 7B model"
        else:
            # CPU-only configuration based on RAM
            config["engine"] = "ollama"
            
            if hw.ram_gb >= 16:
                config["model"] = "llama3:8b"
                config["reason"] = f"{hw.ram_gb}GB RAM detected - using Llama 3 8B"
            elif hw.ram_gb >= 8:
                config["model"] = "mistral:7b"
                config["reason"] = f"{hw.ram_gb}GB RAM detected - using Mistral 7B"
            elif hw.ram_gb >= 4:
                config["model"] = "phi3:mini"
                config["reason"] = f"{hw.ram_gb}GB RAM detected - using Phi-3 Mini"
            else:
                config["model"] = "tinyllama"
                config["reason"] = f"Limited RAM ({hw.ram_gb}GB) - using TinyLlama"
        
        return config
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert hardware info to dictionary."""
        hw = self.detect()
        return {
            "ram_gb": hw.ram_gb,
            "cpu_cores": hw.cpu_cores,
            "cpu_model": hw.cpu_model,
            "gpu_detected": hw.gpu.detected,
            "gpu_name": hw.gpu.name,
            "gpu_vram_gb": hw.gpu.vram_gb,
            "cuda_available": hw.gpu.cuda_available
        }


# Global instance
hardware_detector = HardwareDetector()
