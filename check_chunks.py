import chromadb
c = chromadb.PersistentClient(path="/opt/galentix/data/chroma")
col = c.get_collection("galentix_documents")
r = col.get(include=["documents"])
for i, doc in enumerate(r["documents"]):
    print(f"--- Chunk {i} ---")
    print(doc[:300])
    print()
