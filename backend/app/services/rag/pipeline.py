"""
Galentix AI - RAG Pipeline
Complete pipeline for document ingestion, indexing, and retrieval.
"""
import os
import uuid
from typing import List, Optional, Dict, Any, Tuple
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass

from .chunker import DocumentChunker, Chunk, ChunkingStrategy, ProcessingStats
from .embeddings import get_embeddings_service, EmbeddingsService
from ...config import settings

try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False

try:
    from rank_bm25 import BM25Okapi
    BM25_AVAILABLE = True
except ImportError:
    BM25_AVAILABLE = False


@dataclass
class SearchResult:
    """A search result with content and metadata."""
    content: str
    metadata: Dict[str, Any]
    similarity: float
    document_id: str
    chunk_index: int
    bm25_score: float = 0.0
    hybrid_score: float = 0.0


@dataclass 
class HybridConfig:
    """Configuration for hybrid search."""
    vector_weight: float = 0.5
    bm25_weight: float = 0.5
    enable_reranking: bool = True
    rerank_top_k: int = 10


class DocumentPreprocessor:
    """Extract text from various document formats."""
    
    @staticmethod
    async def extract_text(file_path: str) -> Tuple[str, Dict[str, Any]]:
        """Extract text from file based on extension."""
        path = Path(file_path)
        ext = path.suffix.lower()
        
        if ext == '.pdf':
            return await DocumentPreprocessor._extract_pdf(file_path)
        elif ext in ['.docx', '.doc']:
            return await DocumentPreprocessor._extract_docx(file_path)
        elif ext == '.txt':
            return await DocumentPreprocessor._extract_txt(file_path)
        elif ext in ['.md', '.markdown']:
            return await DocumentPreprocessor._extract_md(file_path)
        elif ext in ['.html', '.htm']:
            return await DocumentPreprocessor._extract_html(file_path)
        else:
            return await DocumentPreprocessor._extract_txt(file_path)
    
    @staticmethod
    async def _extract_pdf(file_path: str) -> Tuple[str, Dict[str, Any]]:
        """Extract text from PDF."""
        metadata = {"source": file_path, "type": "pdf"}
        text_parts = []
        
        try:
            import pypdf
            reader = pypdf.PdfReader(file_path)
            metadata["pages"] = len(reader.pages)
            
            for i, page in enumerate(reader.pages):
                text_parts.append(page.extract_text())
                metadata[f"page_{i+1}_chars"] = len(text_parts[-1])
            
            if reader.metadata:
                metadata["title"] = reader.metadata.get('/Title', '')
                metadata["author"] = reader.metadata.get('/Author', '')
            
        except Exception as e:
            print(f"PDF extraction error: {e}")
            return "", metadata
        
        return "\n\n".join(text_parts), metadata
    
    @staticmethod
    async def _extract_docx(file_path: str) -> Tuple[str, Dict[str, Any]]:
        """Extract text from DOCX."""
        metadata = {"source": file_path, "type": "docx"}
        
        try:
            import docx
            doc = docx.Document(file_path)
            
            text_parts = []
            for para in doc.paragraphs:
                if para.text.strip():
                    text_parts.append(para.text)
            
            metadata["paragraphs"] = len(text_parts)
            
            if doc.core_properties.title:
                metadata["title"] = doc.core_properties.title
            if doc.core_properties.author:
                metadata["author"] = doc.core_properties.author
            
        except Exception as e:
            print(f"DOCX extraction error: {e}")
            return "", metadata
        
        return "\n\n".join(text_parts), metadata
    
    @staticmethod
    async def _extract_txt(file_path: str) -> Tuple[str, Dict[str, Any]]:
        """Extract text from plain text file."""
        metadata = {"source": file_path, "type": "txt"}
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
            metadata["chars"] = len(text)
        except Exception as e:
            print(f"TXT extraction error: {e}")
            return "", metadata
        
        return text, metadata
    
    @staticmethod
    async def _extract_md(file_path: str) -> Tuple[str, Dict[str, Any]]:
        """Extract text from Markdown file."""
        metadata = {"source": file_path, "type": "markdown"}
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
            metadata["chars"] = len(text)
            
            import re
            headings = re.findall(r'^#{1,6}\s+(.+)$', text, re.MULTILINE)
            metadata["headings"] = headings
            
        except Exception as e:
            print(f"Markdown extraction error: {e}")
            return "", metadata
        
        return text, metadata
    
    @staticmethod
    async def _extract_html(file_path: str) -> Tuple[str, Dict[str, Any]]:
        """Extract text from HTML file."""
        metadata = {"source": file_path, "type": "html"}
        
        try:
            from bs4 import BeautifulSoup
            
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                html = f.read()
            
            soup = BeautifulSoup(html, 'html.parser')
            
            for script in soup(["script", "style"]):
                script.decompose()
            
            text = soup.get_text()
            lines = (line.strip() for line in text.splitlines())
            text = '\n'.join(line for line in lines if line)
            
            metadata["chars"] = len(text)
            
        except Exception as e:
            print(f"HTML extraction error: {e}")
            return "", metadata
        
        return text, metadata


class BM25Index:
    """BM25 index for text-based retrieval."""
    
    def __init__(self):
        self.index: Optional[BM25Okapi] = None
        self.corpus: List[str] = []
        self.doc_ids: List[str] = []
    
    def build(self, documents: List[Tuple[str, str]]):
        """Build BM25 index from documents."""
        if not BM25_AVAILABLE:
            return
        
        self.corpus = [doc[0] for doc in documents]
        self.doc_ids = [doc[1] for doc in documents]
        
        if self.corpus:
            tokenized = [doc.split() for doc in self.corpus]
            self.index = BM25Okapi(tokenized)
    
    def search(self, query: str, top_k: int = 10) -> List[Tuple[str, float]]:
        """Search BM25 index."""
        if not self.index or not query:
            return []
        
        scores = self.index.get_scores(query.split())
        
        top_indices = sorted(
            range(len(scores)), 
            key=lambda i: scores[i], 
            reverse=True
        )[:top_k]
        
        return [(self.doc_ids[i], scores[i]) for i in top_indices]


class RAGPipeline:
    """
    RAG (Retrieval-Augmented Generation) Pipeline.
    
    Features:
    - Multiple chunking strategies (semantic, markdown, sentence, fixed)
    - Multiple embedding backends (Ollama, Sentence Transformers)
    - Hybrid search (vector + BM25)
    - Reranking
    - Document preprocessing (PDF, DOCX, TXT, MD, HTML)
    """
    
    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 100,
        embedding_model: Optional[str] = None,
        embedding_backend: str = "ollama",
        hybrid_config: Optional[HybridConfig] = None
    ):
        self.chunker = DocumentChunker(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            strategy=ChunkingStrategy.SEMANTIC
        )
        
        self.embeddings = get_embeddings_service(
            model=embedding_model,
            backend=embedding_backend
        )
        
        self.hybrid_config = hybrid_config or HybridConfig()
        
        self._client = None
        self._collection = None
        self._initialized = False
        self._bm25_index = BM25Index()
    
    async def initialize(self) -> bool:
        """Initialize the vector store."""
        if self._initialized:
            return True
        
        if not CHROMA_AVAILABLE:
            print("ChromaDB not available - RAG disabled")
            return False
        
        try:
            chroma_path = settings.data_dir / "chroma"
            chroma_path.mkdir(parents=True, exist_ok=True)
            
            self._client = chromadb.PersistentClient(
                path=str(chroma_path),
                settings=ChromaSettings(
                    anonymized_telemetry=False,
                    allow_reset=True
                )
            )
            
            self._collection = self._client.get_or_create_collection(
                name="galentix_documents",
                metadata={"hnsw:space": "cosine"}
            )
            
            self._initialized = True
            await self._rebuild_bm25_index()
            return True
        except Exception as e:
            print(f"Failed to initialize RAG pipeline: {e}")
            return False
    
    async def _rebuild_bm25_index(self):
        """Rebuild BM25 index from existing documents."""
        if not BM25_AVAILABLE or not self._collection:
            return
        
        try:
            results = self._collection.get(include=["documents", "ids"])
            
            if results and results["documents"]:
                documents = list(zip(results["documents"], results["ids"]))
                self._bm25_index.build(documents)
        except Exception as e:
            print(f"Failed to rebuild BM25 index: {e}")
    
    async def add_document(
        self,
        document_id: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        chunking_strategy: ChunkingStrategy = ChunkingStrategy.SEMANTIC
    ) -> int:
        """Add a document to the vector store."""
        if not await self.initialize():
            return 0
        
        metadata = metadata or {}
        metadata["document_id"] = document_id
        metadata["indexed_at"] = datetime.utcnow().isoformat()
        
        self.chunker.strategy = chunking_strategy
        chunks = self.chunker.chunk_text(content, metadata)
        
        if not chunks:
            return 0
        
        chunk_texts = [chunk.content for chunk in chunks]
        embeddings = await self.embeddings.get_embeddings_batch(chunk_texts)
        
        valid_data = [
            (chunk, emb) for chunk, emb in zip(chunks, embeddings)
            if emb and len(emb) > 0
        ]
        
        if not valid_data:
            return 0
        
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
        
        self._collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings_list,
            metadatas=metadatas
        )
        
        await self._rebuild_bm25_index()
        
        return len(valid_data)
    
    async def add_document_from_file(
        self,
        file_path: str,
        document_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[int, Dict[str, Any]]:
        """Add a document from file with automatic format detection."""
        document_id = document_id or str(uuid.uuid4())
        
        content, extracted_meta = await DocumentPreprocessor.extract_text(file_path)
        
        if metadata:
            extracted_meta.update(metadata)
        
        extracted_meta["filename"] = os.path.basename(file_path)
        
        chunk_count = await self.add_document(
            document_id=document_id,
            content=content,
            metadata=extracted_meta
        )
        
        return chunk_count, extracted_meta
    
    async def search(
        self,
        query: str,
        top_k: int = 5,
        filter_document_id: Optional[str] = None,
        use_hybrid: bool = True
    ) -> List[SearchResult]:
        """Search for relevant chunks with hybrid search support."""
        if not await self.initialize():
            return []
        
        if not use_hybrid or not BM25_AVAILABLE:
            return await self._vector_search(query, top_k, filter_document_id)
        
        vector_results = await self._vector_search(query, top_k * 2, filter_document_id)
        bm25_results = self._bm25_search(query, top_k * 2, filter_document_id)
        
        combined = self._combine_results(vector_results, bm25_results, top_k)
        
        if self.hybrid_config.enable_reranking:
            combined = await self._rerank(query, combined)
        
        return combined[:top_k]
    
    async def _vector_search(
        self,
        query: str,
        top_k: int,
        filter_document_id: Optional[str] = None
    ) -> List[SearchResult]:
        """Pure vector search."""
        query_embedding = await self.embeddings.get_embedding(query)
        
        if not query_embedding:
            return []
        
        where_filter = None
        if filter_document_id:
            where_filter = {"document_id": filter_document_id}
        
        try:
            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=where_filter,
                include=["documents", "metadatas", "distances"]
            )
        except Exception as e:
            print(f"Vector search error: {e}")
            return []
        
        formatted_results = []
        
        if results and results["documents"] and results["documents"][0]:
            documents = results["documents"][0]
            metadatas = results["metadatas"][0] if results["metadatas"] else [{}] * len(documents)
            distances = results["distances"][0] if results["distances"] else [0] * len(documents)
            
            for doc, meta, dist in zip(documents, metadatas, distances):
                similarity = 1 - dist
                
                formatted_results.append(SearchResult(
                    content=doc,
                    metadata=meta,
                    similarity=similarity,
                    document_id=meta.get("document_id", "unknown"),
                    chunk_index=meta.get("chunk_index", 0)
                ))
        
        return formatted_results
    
    def _bm25_search(
        self,
        query: str,
        top_k: int,
        filter_document_id: Optional[str] = None
    ) -> List[SearchResult]:
        """BM25 text search."""
        if not self._bm25_index.index:
            return []
        
        raw_results = self._bm25_index.search(query, top_k * 2)
        
        results = []
        for doc_id, bm25_score in raw_results:
            try:
                result = self._collection.get(
                    ids=[doc_id],
                    include=["documents", "metadatas"]
                )
                
                if result and result["documents"]:
                    doc = result["documents"][0]
                    meta = result["metadatas"][0] if result["metadatas"] else {}
                    
                    if filter_document_id and meta.get("document_id") != filter_document_id:
                        continue
                    
                    results.append(SearchResult(
                        content=doc,
                        metadata=meta,
                        similarity=0.0,
                        document_id=meta.get("document_id", "unknown"),
                        chunk_index=meta.get("chunk_index", 0),
                        bm25_score=bm25_score
                    ))
            except Exception:
                continue
        
        return results
    
    def _combine_results(
        self,
        vector_results: List[SearchResult],
        bm25_results: List[SearchResult],
        top_k: int
    ) -> List[SearchResult]:
        """Combine vector and BM25 results with weighted scoring."""
        doc_map: Dict[str, SearchResult] = {}
        
        for r in vector_results:
            key = f"{r.document_id}_{r.chunk_index}"
            doc_map[key] = r
        
        for r in bm25_results:
            key = f"{r.document_id}_{r.chunk_index}"
            if key in doc_map:
                doc_map[key].bm25_score = r.bm25_score
            else:
                doc_map[key] = r
        
        vw = self.hybrid_config.vector_weight
        bw = self.hybrid_config.bm25_weight
        
        combined = []
        for r in doc_map.values():
            max_bm25 = max(r.bm25_score, 1.0)
            r.hybrid_score = (vw * r.similarity) + (bw * min(r.bm25_score / max_bm25, 1.0))
            combined.append(r)
        
        combined.sort(key=lambda x: x.hybrid_score, reverse=True)
        
        return combined[:top_k]
    
    async def _rerank(
        self,
        query: str,
        results: List[SearchResult]
    ) -> List[SearchResult]:
        """Rerank results using cross-encoder scoring."""
        try:
            from sentence_transformers import CrossEncoder
            
            cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
            
            pairs = [(query, r.content) for r in results]
            scores = cross_encoder.predict(pairs)
            
            for r, score in zip(results, scores):
                r.similarity = float(score)
            
            results.sort(key=lambda x: x.similarity, reverse=True)
            
        except ImportError:
            pass
        except Exception as e:
            print(f"Reranking error: {e}")
        
        return results
    
    async def delete_document(self, document_id: str) -> bool:
        """Delete all chunks for a document."""
        if not await self.initialize():
            return False
        
        try:
            results = self._collection.get(
                where={"document_id": document_id},
                include=[]
            )
            
            if results and results["ids"]:
                self._collection.delete(ids=results["ids"])
            
            await self._rebuild_bm25_index()
            
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
            
            chunks.sort(key=lambda x: x["metadata"].get("chunk_index", 0))
            return chunks
        except Exception:
            return []
    
    async def build_context(
        self,
        query: str,
        top_k: int = 5,
        use_hybrid: bool = True
    ) -> str:
        """Build context string from relevant documents for LLM."""
        results = await self.search(query, top_k=top_k, use_hybrid=use_hybrid)
        
        if not results:
            return ""
        
        context_parts = []
        for i, result in enumerate(results, 1):
            source_info = ""
            if "filename" in result.metadata:
                source_info = f" (Source: {result.metadata['filename']})"
            
            context_parts.append(
                f"[Document {i}{source_info}]\n{result.content}"
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
                "collection": "galentix_documents",
                "embedding_model": self.embeddings.model,
                "embedding_backend": self.embeddings.backend.value,
                "embedding_dimension": self.embeddings.dimension,
                "bm25_available": BM25_AVAILABLE,
                "hybrid_enabled": self.hybrid_config is not None
            }
        except Exception:
            return {"status": "error", "count": 0}
    
    def get_available_embedding_models(self) -> Dict[str, int]:
        """Get available embedding models."""
        return self.embeddings.get_available_models()


_rag_pipeline: Optional[RAGPipeline] = None


def get_rag_pipeline() -> RAGPipeline:
    """Get or create the RAG pipeline."""
    global _rag_pipeline
    if _rag_pipeline is None:
        _rag_pipeline = RAGPipeline(
            chunk_size=settings.rag_chunk_size,
            chunk_overlap=settings.rag_chunk_overlap,
            embedding_model=settings.embedding_model
        )
    return _rag_pipeline
