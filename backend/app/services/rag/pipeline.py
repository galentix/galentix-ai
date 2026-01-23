"""
Galentix AI - RAG Pipeline
Complete pipeline for document ingestion, indexing, and retrieval.
"""
import os
import uuid
from typing import List, Optional, Dict, Any
from pathlib import Path
from datetime import datetime

from .chunker import DocumentChunker, Chunk
from .embeddings import get_embeddings_service
from ...config import settings

# Try to import chromadb
try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False


class RAGPipeline:
    """
    RAG (Retrieval-Augmented Generation) Pipeline.
    
    Handles:
    - Document processing and chunking
    - Embedding generation
    - Vector storage and retrieval
    - Context building for LLM
    """
    
    def __init__(self):
        self.chunker = DocumentChunker(
            chunk_size=settings.rag_chunk_size,
            chunk_overlap=settings.rag_chunk_overlap
        )
        self.embeddings = get_embeddings_service()
        self._client = None
        self._collection = None
        self._initialized = False
    
    async def initialize(self) -> bool:
        """Initialize the vector store."""
        if self._initialized:
            return True
        
        if not CHROMA_AVAILABLE:
            print("ChromaDB not available - RAG disabled")
            return False
        
        try:
            # Create ChromaDB client with persistent storage
            chroma_path = settings.data_dir / "chroma"
            chroma_path.mkdir(parents=True, exist_ok=True)
            
            self._client = chromadb.PersistentClient(
                path=str(chroma_path),
                settings=ChromaSettings(
                    anonymized_telemetry=False,
                    allow_reset=True
                )
            )
            
            # Get or create collection
            self._collection = self._client.get_or_create_collection(
                name="galentix_documents",
                metadata={"hnsw:space": "cosine"}
            )
            
            self._initialized = True
            return True
        except Exception as e:
            print(f"Failed to initialize RAG pipeline: {e}")
            return False
    
    async def add_document(
        self,
        document_id: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Add a document to the vector store.
        
        Returns the number of chunks created.
        """
        if not await self.initialize():
            return 0
        
        metadata = metadata or {}
        metadata["document_id"] = document_id
        metadata["indexed_at"] = datetime.utcnow().isoformat()
        
        # Chunk the document
        chunks = self.chunker.chunk_text(content, metadata)
        
        if not chunks:
            return 0
        
        # Generate embeddings for all chunks
        chunk_texts = [chunk.content for chunk in chunks]
        embeddings = await self.embeddings.get_embeddings_batch(chunk_texts)
        
        # Filter out failed embeddings
        valid_data = [
            (chunk, emb) for chunk, emb in zip(chunks, embeddings)
            if emb and len(emb) > 0
        ]
        
        if not valid_data:
            return 0
        
        # Prepare data for ChromaDB
        ids = [f"{document_id}_{i}" for i in range(len(valid_data))]
        documents = [chunk.content for chunk, _ in valid_data]
        embeddings_list = [emb for _, emb in valid_data]
        metadatas = []
        
        for chunk, _ in valid_data:
            chunk_meta = chunk.metadata.copy()
            chunk_meta["chunk_index"] = chunk.chunk_index
            chunk_meta["start_char"] = chunk.start_char
            chunk_meta["end_char"] = chunk.end_char
            metadatas.append(chunk_meta)
        
        # Add to collection
        self._collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings_list,
            metadatas=metadatas
        )
        
        return len(valid_data)
    
    async def search(
        self,
        query: str,
        top_k: int = 5,
        filter_document_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for relevant chunks.
        
        Returns list of results with content, metadata, and similarity score.
        """
        if not await self.initialize():
            return []
        
        # Generate query embedding
        query_embedding = await self.embeddings.get_embedding(query)
        
        if not query_embedding:
            return []
        
        # Build filter
        where_filter = None
        if filter_document_id:
            where_filter = {"document_id": filter_document_id}
        
        # Search
        try:
            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=where_filter,
                include=["documents", "metadatas", "distances"]
            )
        except Exception as e:
            print(f"Search error: {e}")
            return []
        
        # Format results
        formatted_results = []
        
        if results and results["documents"] and results["documents"][0]:
            documents = results["documents"][0]
            metadatas = results["metadatas"][0] if results["metadatas"] else [{}] * len(documents)
            distances = results["distances"][0] if results["distances"] else [0] * len(documents)
            
            for doc, meta, dist in zip(documents, metadatas, distances):
                # Convert distance to similarity score (cosine distance to similarity)
                similarity = 1 - dist
                
                formatted_results.append({
                    "content": doc,
                    "metadata": meta,
                    "similarity": similarity,
                    "document_id": meta.get("document_id", "unknown"),
                    "chunk_index": meta.get("chunk_index", 0)
                })
        
        return formatted_results
    
    async def delete_document(self, document_id: str) -> bool:
        """Delete all chunks for a document."""
        if not await self.initialize():
            return False
        
        try:
            # Get all chunks for this document
            results = self._collection.get(
                where={"document_id": document_id},
                include=[]
            )
            
            if results and results["ids"]:
                self._collection.delete(ids=results["ids"])
            
            return True
        except Exception as e:
            print(f"Delete error: {e}")
            return False
    
    async def get_document_chunks(self, document_id: str) -> List[Dict[str, Any]]:
        """Get all chunks for a document."""
        if not await self.initialize():
            return []
        
        try:
            results = self._collection.get(
                where={"document_id": document_id},
                include=["documents", "metadatas"]
            )
            
            chunks = []
            if results and results["documents"]:
                for doc, meta in zip(results["documents"], results["metadatas"]):
                    chunks.append({
                        "content": doc,
                        "metadata": meta
                    })
            
            # Sort by chunk index
            chunks.sort(key=lambda x: x["metadata"].get("chunk_index", 0))
            return chunks
        except Exception:
            return []
    
    async def build_context(
        self,
        query: str,
        top_k: int = 5
    ) -> str:
        """
        Build context string from relevant documents for LLM.
        """
        results = await self.search(query, top_k=top_k)
        
        if not results:
            return ""
        
        context_parts = []
        for i, result in enumerate(results, 1):
            source_info = ""
            if "filename" in result["metadata"]:
                source_info = f" (Source: {result['metadata']['filename']})"
            
            context_parts.append(
                f"[Document {i}{source_info}]\n{result['content']}"
            )
        
        return "\n\n---\n\n".join(context_parts)
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector store."""
        if not await self.initialize():
            return {"status": "unavailable", "count": 0}
        
        try:
            count = self._collection.count()
            return {
                "status": "available",
                "count": count,
                "collection": "galentix_documents"
            }
        except Exception:
            return {"status": "error", "count": 0}


# Global instance
_rag_pipeline: Optional[RAGPipeline] = None


def get_rag_pipeline() -> RAGPipeline:
    """Get or create the RAG pipeline."""
    global _rag_pipeline
    if _rag_pipeline is None:
        _rag_pipeline = RAGPipeline()
    return _rag_pipeline
