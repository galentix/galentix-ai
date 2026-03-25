"""
Galentix AI - Document Chunker
Splits documents into optimally-sized chunks for RAG.
"""
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum
import re


class ChunkingStrategy(Enum):
    """Available chunking strategies."""
    SEMANTIC = "semantic"
    MARKDOWN = "markdown"
    FIXED = "fixed"
    SENTENCE = "sentence"


@dataclass
class Chunk:
    """A chunk of text from a document."""
    content: str
    metadata: dict
    chunk_index: int
    start_char: int
    end_char: int


@dataclass
class ProcessingStats:
    """Statistics from document processing."""
    total_chunks: int = 0
    total_characters: int = 0
    avg_chunk_size: float = 0.0
    chunking_strategy: str = "semantic"


class DocumentChunker:
    """
    Chunks documents into smaller pieces for embedding and retrieval.
    Supports multiple chunking strategies for different document types.
    """
    
    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 100,
        min_chunk_size: int = 50,
        strategy: ChunkingStrategy = ChunkingStrategy.SEMANTIC,
        extract_headings: bool = True
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_size = min_chunk_size
        self.strategy = strategy
        self.extract_headings = extract_headings
    
    def chunk_text(
        self,
        text: str,
        metadata: Optional[dict] = None,
        preserve_structure: bool = True
    ) -> List[Chunk]:
        """Split text into chunks based on selected strategy."""
        if not text or not text.strip():
            return []
        
        metadata = metadata or {}
        
        if self.strategy == ChunkingStrategy.MARKDOWN:
            return self._chunk_markdown(text, metadata)
        elif self.strategy == ChunkingStrategy.SENTENCE:
            return self._chunk_sentences(text, metadata)
        elif self.strategy == ChunkingStrategy.FIXED:
            return self._chunk_fixed(text, metadata)
        else:
            return self._chunk_semantic(text, metadata, preserve_structure)
    
    def _chunk_markdown(self, text: str, metadata: dict) -> List[Chunk]:
        """Split text by markdown headers and sections."""
        chunks = []
        lines = text.split('\n')
        
        current_section = ""
        current_heading = ""
        section_start = 0
        char_position = 0
        
        heading_pattern = re.compile(r'^(#{1,6})\s+(.+)$')
        
        for i, line in enumerate(lines):
            heading_match = heading_pattern.match(line)
            
            if heading_match:
                if current_section.strip():
                    chunk = self._create_chunk(
                        current_section.strip(),
                        metadata,
                        len(chunks),
                        section_start,
                        char_position,
                        current_heading
                    )
                    chunks.append(chunk)
                
                current_heading = heading_match.group(2)
                current_section = line + "\n"
                section_start = char_position
            else:
                current_section += line + "\n"
            
            char_position += len(line) + 1
        
        if current_section.strip():
            chunk = self._create_chunk(
                current_section.strip(),
                metadata,
                len(chunks),
                section_start,
                char_position,
                current_heading
            )
            chunks.append(chunk)
        
        oversized = []
        final_chunks = []
        for chunk in chunks:
            if len(chunk.content) > self.chunk_size:
                sub_chunks = self._split_large_chunk(chunk, metadata)
                oversized.extend(sub_chunks)
            else:
                final_chunks.append(chunk)
        
        final_chunks.extend(oversized)
        
        for i, chunk in enumerate(final_chunks):
            chunk.chunk_index = i
            chunk.metadata["chunk_index"] = i
            chunk.metadata["total_chunks"] = len(final_chunks)
        
        return final_chunks
    
    def _create_chunk(
        self,
        content: str,
        metadata: dict,
        index: int,
        start: int,
        end: int,
        heading: str = ""
    ) -> Chunk:
        meta = metadata.copy()
        if heading:
            meta["heading"] = heading
        return Chunk(
            content=content,
            metadata=meta,
            chunk_index=index,
            start_char=start,
            end_char=end
        )
    
    def _split_large_chunk(self, chunk: Chunk, metadata: dict) -> List[Chunk]:
        """Split an oversized chunk into smaller pieces."""
        sentences = self._split_sentences(chunk.content)
        sub_chunks = []
        current = ""
        current_start = chunk.start_char
        
        for i, sent in enumerate(sentences):
            if len(current) + len(sent) + 1 > self.chunk_size:
                if current:
                    overlap = self._get_overlap(current)
                    sub_chunks.append(Chunk(
                        content=current.strip(),
                        metadata=chunk.metadata.copy(),
                        chunk_index=chunk.chunk_index + len(sub_chunks),
                        start_char=current_start,
                        end_char=current_start + len(current)
                    ))
                    current = overlap + " " + sent if overlap else sent
                    current_start = current_start + len(current) - len(overlap) - len(sent) if overlap else current_start
                else:
                    current = sent
            else:
                current = current + " " + sent if current else sent
        
        if current.strip():
            sub_chunks.append(Chunk(
                content=current.strip(),
                metadata=chunk.metadata.copy(),
                chunk_index=chunk.chunk_index + len(sub_chunks),
                start_char=current_start,
                end_char=chunk.end_char
            ))
        
        return sub_chunks
    
    def _chunk_sentences(self, text: str, metadata: dict) -> List[Chunk]:
        """Split text into sentence-based chunks."""
        sentences = self._split_sentences(text)
        chunks = []
        current = ""
        start_pos = 0
        
        for i, sentence in enumerate(sentences):
            if len(current) + len(sentence) + 1 > self.chunk_size:
                if len(current) >= self.min_chunk_size:
                    chunks.append(Chunk(
                        content=current.strip(),
                        metadata=metadata.copy(),
                        chunk_index=len(chunks),
                        start_char=start_pos,
                        end_char=start_pos + len(current)
                    ))
                    overlap = self._get_overlap(current)
                    current = overlap + " " + sentence if overlap else sentence
                    start_pos = start_pos + len(current) - len(overlap) - len(sentence) if overlap else start_pos
                else:
                    current = current + " " + sentence if current else sentence
            else:
                if not current:
                    start_pos = text.find(sentence)
                current = current + " " + sentence if current else sentence
        
        if current and len(current) >= self.min_chunk_size:
            chunks.append(Chunk(
                content=current.strip(),
                metadata=metadata.copy(),
                chunk_index=len(chunks),
                start_char=start_pos,
                end_char=start_pos + len(current)
            ))
        
        return self._finalize_chunks(chunks, metadata)
    
    def _chunk_fixed(self, text: str, metadata: dict) -> List[Chunk]:
        """Simple fixed-size chunking with overlap."""
        chunks = []
        text = self._clean_text(text)
        
        for i in range(0, len(text), self.chunk_size - self.chunk_overlap):
            chunk_text = text[i:i + self.chunk_size]
            if len(chunk_text) >= self.min_chunk_size:
                chunks.append(Chunk(
                    content=chunk_text.strip(),
                    metadata=metadata.copy(),
                    chunk_index=len(chunks),
                    start_char=i,
                    end_char=i + len(chunk_text)
                ))
        
        return self._finalize_chunks(chunks, metadata)
    
    def _chunk_semantic(
        self,
        text: str,
        metadata: dict,
        preserve_structure: bool = True
    ) -> List[Chunk]:
        """Split text trying to maintain semantic boundaries."""
        text = self._clean_text(text)
        chunks = []
        
        paragraphs = self._split_paragraphs(text)
        
        current_chunk = ""
        current_start = 0
        char_position = 0
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                char_position += 2
                continue
            
            if len(current_chunk) + len(para) + 1 > self.chunk_size:
                if len(current_chunk) >= self.min_chunk_size:
                    chunks.append(Chunk(
                        content=current_chunk.strip(),
                        metadata=metadata.copy(),
                        chunk_index=len(chunks),
                        start_char=current_start,
                        end_char=char_position
                    ))
                    
                    overlap_text = self._get_overlap(current_chunk)
                    current_chunk = overlap_text + " " + para if overlap_text else para
                    current_start = char_position - len(overlap_text) if overlap_text else char_position
                else:
                    current_chunk = current_chunk + "\n\n" + para if current_chunk else para
                
                if len(para) > self.chunk_size:
                    sub_chunks = self._split_large_paragraph(
                        para, metadata, len(chunks), char_position
                    )
                    chunks.extend(sub_chunks)
                    current_chunk = ""
                    current_start = char_position + len(para)
            else:
                if current_chunk:
                    current_chunk += "\n\n" + para
                else:
                    current_chunk = para
                    current_start = char_position
            
            char_position += len(para) + 2
        
        if current_chunk and len(current_chunk) >= self.min_chunk_size:
            chunks.append(Chunk(
                content=current_chunk.strip(),
                metadata=metadata.copy(),
                chunk_index=len(chunks),
                start_char=current_start,
                end_char=char_position
            ))
        
        return self._finalize_chunks(chunks, metadata)
    
    def _finalize_chunks(
        self,
        chunks: List[Chunk],
        metadata: dict
    ) -> List[Chunk]:
        """Finalize chunk metadata."""
        if not chunks:
            return chunks
        
        # Remove very short chunks by merging with previous
        merged = []
        for chunk in chunks:
            if merged and len(chunk.content) < self.min_chunk_size:
                merged[-1].content += "\n\n" + chunk.content
                merged[-1].end_char = chunk.end_char
            else:
                merged.append(chunk)
        
        for i, chunk in enumerate(merged):
            chunk.chunk_index = i
            chunk.metadata["chunk_index"] = i
            chunk.metadata["total_chunks"] = len(merged)
        
        return merged
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text."""
        text = re.sub(r' +', ' ', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        lines = [line.strip() for line in text.split('\n')]
        return '\n'.join(lines)
    
    def _split_paragraphs(self, text: str) -> List[str]:
        """Split text into paragraphs."""
        return re.split(r'\n\n+', text)
    
    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences with better handling."""
        # Handle abbreviations and other cases
        text = re.sub(r'(?<=[a-z])\.(?=[A-Z])', '. ', text)
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _get_overlap(self, text: str) -> str:
        """Get overlap portion maintaining semantic boundaries."""
        if len(text) <= self.chunk_overlap:
            return text
        
        overlap_region = text[-self.chunk_overlap * 2:]
        sentences = self._split_sentences(overlap_region)
        
        if len(sentences) > 1:
            overlap = ""
            for sent in reversed(sentences):
                if len(overlap) + len(sent) <= self.chunk_overlap:
                    overlap = sent + " " + overlap if overlap else sent
                else:
                    break
            return overlap.strip()
        
        overlap_text = text[-self.chunk_overlap:]
        space_idx = overlap_text.find(' ')
        if space_idx != -1:
            return overlap_text[space_idx + 1:]
        return overlap_text
    
    def _split_large_paragraph(
        self,
        text: str,
        metadata: dict,
        start_index: int,
        char_position: int
    ) -> List[Chunk]:
        """Split a large paragraph into smaller chunks."""
        chunks = []
        sentences = self._split_sentences(text)
        
        current_chunk = ""
        current_start = char_position
        local_position = 0
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) + 1 > self.chunk_size:
                if current_chunk:
                    chunks.append(Chunk(
                        content=current_chunk.strip(),
                        metadata=metadata.copy(),
                        chunk_index=start_index + len(chunks),
                        start_char=current_start,
                        end_char=char_position + local_position
                    ))
                    overlap = self._get_overlap(current_chunk)
                    current_chunk = overlap + " " + sentence if overlap else sentence
                    current_start = char_position + local_position - len(overlap) if overlap else char_position + local_position
                else:
                    current_chunk = sentence
            else:
                current_chunk = current_chunk + " " + sentence if current_chunk else sentence
            
            local_position += len(sentence) + 1
        
        if current_chunk:
            chunks.append(Chunk(
                content=current_chunk.strip(),
                metadata=metadata.copy(),
                chunk_index=start_index + len(chunks),
                start_char=current_start,
                end_char=char_position + local_position
            ))
        
        return chunks
    
    def extract_headings_from_text(self, text: str) -> List[Dict[str, Any]]:
        """Extract headings and their positions from text."""
        headings = []
        
        md_heading_pattern = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
        for match in md_heading_pattern.finditer(text):
            headings.append({
                "level": len(match.group(1)),
                "text": match.group(2),
                "position": match.start()
            })
        
        if not headings:
            underline_pattern = re.compile(r'^([^\n]+)\n[=-]+\s*$', re.MULTILINE)
            for match in underline_pattern.finditer(text):
                level = 1 if text[match.end():].startswith('=') else 2
                headings.append({
                    "level": level,
                    "text": match.group(1).strip(),
                    "position": match.start()
                })
        
        return headings
    
    def get_stats(self, chunks: List[Chunk]) -> ProcessingStats:
        """Get processing statistics."""
        if not chunks:
            return ProcessingStats()
        
        total_chars = sum(len(c.content) for c in chunks)
        return ProcessingStats(
            total_chunks=len(chunks),
            total_characters=total_chars,
            avg_chunk_size=total_chars / len(chunks) if chunks else 0,
            chunking_strategy=self.strategy.value
        )
