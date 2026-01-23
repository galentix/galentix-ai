"""
Galentix AI - Document Chunker
Splits documents into optimally-sized chunks for RAG.
"""
from typing import List, Optional
from dataclasses import dataclass
import re


@dataclass
class Chunk:
    """A chunk of text from a document."""
    content: str
    metadata: dict
    chunk_index: int
    start_char: int
    end_char: int


class DocumentChunker:
    """
    Chunks documents into smaller pieces for embedding and retrieval.
    Uses semantic boundaries (paragraphs, sentences) when possible.
    """
    
    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        min_chunk_size: int = 100
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_size = min_chunk_size
    
    def chunk_text(
        self,
        text: str,
        metadata: Optional[dict] = None
    ) -> List[Chunk]:
        """
        Split text into chunks with overlap.
        
        Tries to split on semantic boundaries:
        1. Paragraph breaks (double newline)
        2. Sentence boundaries
        3. Word boundaries (fallback)
        """
        if not text or not text.strip():
            return []
        
        metadata = metadata or {}
        chunks = []
        
        # Clean text
        text = self._clean_text(text)
        
        # Split into paragraphs first
        paragraphs = self._split_paragraphs(text)
        
        current_chunk = ""
        current_start = 0
        char_position = 0
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                char_position += 2  # Account for paragraph break
                continue
            
            # If adding this paragraph exceeds chunk size
            if len(current_chunk) + len(para) + 1 > self.chunk_size:
                # Save current chunk if it's large enough
                if len(current_chunk) >= self.min_chunk_size:
                    chunks.append(Chunk(
                        content=current_chunk.strip(),
                        metadata=metadata.copy(),
                        chunk_index=len(chunks),
                        start_char=current_start,
                        end_char=char_position
                    ))
                    
                    # Start new chunk with overlap
                    overlap_text = self._get_overlap(current_chunk)
                    current_chunk = overlap_text + " " + para if overlap_text else para
                    current_start = char_position - len(overlap_text) if overlap_text else char_position
                else:
                    # Current chunk too small, just append
                    current_chunk = current_chunk + "\n\n" + para if current_chunk else para
                
                # If paragraph itself is too large, split it further
                if len(para) > self.chunk_size:
                    sub_chunks = self._split_large_paragraph(para, metadata, len(chunks), char_position)
                    chunks.extend(sub_chunks)
                    current_chunk = ""
                    current_start = char_position + len(para)
            else:
                # Add paragraph to current chunk
                if current_chunk:
                    current_chunk += "\n\n" + para
                else:
                    current_chunk = para
                    current_start = char_position
            
            char_position += len(para) + 2  # +2 for paragraph break
        
        # Don't forget the last chunk
        if current_chunk and len(current_chunk) >= self.min_chunk_size:
            chunks.append(Chunk(
                content=current_chunk.strip(),
                metadata=metadata.copy(),
                chunk_index=len(chunks),
                start_char=current_start,
                end_char=char_position
            ))
        
        # Update chunk indices
        for i, chunk in enumerate(chunks):
            chunk.chunk_index = i
            chunk.metadata["chunk_index"] = i
            chunk.metadata["total_chunks"] = len(chunks)
        
        return chunks
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text."""
        # Replace multiple spaces with single space
        text = re.sub(r' +', ' ', text)
        # Replace multiple newlines with double newline
        text = re.sub(r'\n{3,}', '\n\n', text)
        # Remove leading/trailing whitespace from lines
        lines = [line.strip() for line in text.split('\n')]
        return '\n'.join(lines)
    
    def _split_paragraphs(self, text: str) -> List[str]:
        """Split text into paragraphs."""
        return re.split(r'\n\n+', text)
    
    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences."""
        # Simple sentence splitting
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _get_overlap(self, text: str) -> str:
        """Get the overlap portion from the end of text."""
        if len(text) <= self.chunk_overlap:
            return text
        
        # Try to get overlap at sentence boundary
        overlap_region = text[-self.chunk_overlap * 2:]
        sentences = self._split_sentences(overlap_region)
        
        if len(sentences) > 1:
            # Return last complete sentence(s) within overlap size
            overlap = ""
            for sent in reversed(sentences):
                if len(overlap) + len(sent) <= self.chunk_overlap:
                    overlap = sent + " " + overlap if overlap else sent
                else:
                    break
            return overlap.strip()
        
        # Fallback to word boundary
        overlap_text = text[-self.chunk_overlap:]
        # Find first space to start at word boundary
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
