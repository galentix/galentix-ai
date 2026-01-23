"""
Galentix AI - Configuration Management
"""
import json
import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment and config files."""
    
    # Paths
    base_dir: Path = Field(default=Path("/opt/galentix"))
    config_dir: Path = Field(default=Path("/opt/galentix/config"))
    data_dir: Path = Field(default=Path("/opt/galentix/data"))
    log_dir: Path = Field(default=Path("/opt/galentix/logs"))
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8080
    debug: bool = False
    
    # LLM Settings
    llm_engine: str = "ollama"  # "ollama" or "vllm"
    llm_model: str = "tinyllama"
    ollama_url: str = "http://127.0.0.1:11434"
    vllm_url: str = "http://127.0.0.1:8000"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 2048
    
    # RAG Settings
    rag_enabled: bool = True
    rag_chunk_size: int = 500
    rag_chunk_overlap: int = 50
    rag_top_k: int = 5
    embedding_model: str = "nomic-embed-text"
    
    # Web Search Settings
    search_enabled: bool = True
    searxng_url: str = "http://127.0.0.1:8888"
    search_max_results: int = 5
    
    # Database
    database_url: str = "sqlite+aiosqlite:///data/galentix.db"
    
    # UI Settings
    brand_name: str = "Galentix AI"
    brand_color: str = "#6BBF9E"
    ui_theme: str = "dark"
    
    class Config:
        env_prefix = "GALENTIX_"
        env_file = ".env"


def load_settings() -> Settings:
    """Load settings from config file and environment."""
    settings = Settings()
    
    # Try to load from config file
    config_file = settings.config_dir / "settings.json"
    
    if config_file.exists():
        try:
            with open(config_file, 'r') as f:
                config_data = json.load(f)
            
            # Update settings from config file
            if 'llm' in config_data:
                llm = config_data['llm']
                settings.llm_engine = llm.get('engine', settings.llm_engine)
                settings.llm_model = llm.get('model', settings.llm_model)
                settings.ollama_url = llm.get('ollama_url', settings.ollama_url)
                settings.vllm_url = llm.get('vllm_url', settings.vllm_url)
                settings.llm_temperature = llm.get('temperature', settings.llm_temperature)
                settings.llm_max_tokens = llm.get('max_tokens', settings.llm_max_tokens)
            
            if 'rag' in config_data:
                rag = config_data['rag']
                settings.rag_enabled = rag.get('enabled', settings.rag_enabled)
                settings.rag_chunk_size = rag.get('chunk_size', settings.rag_chunk_size)
                settings.rag_chunk_overlap = rag.get('chunk_overlap', settings.rag_chunk_overlap)
                settings.rag_top_k = rag.get('top_k', settings.rag_top_k)
                settings.embedding_model = rag.get('embedding_model', settings.embedding_model)
            
            if 'search' in config_data:
                search = config_data['search']
                settings.search_enabled = search.get('enabled', settings.search_enabled)
                settings.searxng_url = search.get('searxng_url', settings.searxng_url)
                settings.search_max_results = search.get('max_results', settings.search_max_results)
            
            if 'ui' in config_data:
                ui = config_data['ui']
                settings.brand_name = ui.get('brand_name', settings.brand_name)
                settings.brand_color = ui.get('brand_color', settings.brand_color)
                settings.ui_theme = ui.get('theme', settings.ui_theme)
                
        except Exception as e:
            print(f"Warning: Could not load config file: {e}")
    
    # Ensure directories exist (for development)
    for dir_path in [settings.data_dir, settings.log_dir, settings.config_dir]:
        dir_path.mkdir(parents=True, exist_ok=True)
    
    # Update database URL with actual path
    db_path = settings.data_dir / "galentix.db"
    settings.database_url = f"sqlite+aiosqlite:///{db_path}"
    
    return settings


def load_device_info() -> dict:
    """Load device information from config file."""
    settings = load_settings()
    device_file = settings.config_dir / "device.json"
    
    if device_file.exists():
        try:
            with open(device_file, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    
    return {
        "device_id": "unknown",
        "hardware": {
            "ram_gb": 0,
            "cpu_cores": 0,
            "gpu_detected": False,
            "gpu_name": "None"
        },
        "llm": {
            "engine": "ollama",
            "model": "tinyllama"
        },
        "version": "2.0.0"
    }


# Global settings instance
settings = load_settings()
