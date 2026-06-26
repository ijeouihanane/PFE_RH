import os
import sys
from rag.indexer import extract_text_by_page, chunk_pages, store_chunks_in_chromadb, get_chroma_collection
from rag.retriever import search_similar_chunks
from sentence_transformers import SentenceTransformer

def run_test():
    print("1. Loading embedding model...")
    embeddings_model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    collection = get_chroma_collection(embeddings_model)
    
    # Delete existing to force clean re-index
    print("2. Clearing old collection...")
    try:
        all_docs = collection.get()
        if all_docs['ids']:
            collection.delete(ids=all_docs['ids'])
    except Exception as e:
        print("Delete error", e)

    print("3. Indexing PDF...")
    pdf_path = "RéglementIntérieur (1).pdf"
    if not os.path.exists(pdf_path):
        print(f"File {pdf_path} not found.")
        return
        
    pages = extract_text_by_page(pdf_path)
    chunks = chunk_pages(pages, "test_doc_1", "RéglementIntérieur (1).pdf")
    stored = store_chunks_in_chromadb(chunks, collection)
    print(f"Indexed {stored} chunks")

    print("4. Testing Context Explosion...")
    q1 = "Quels sont les jours fériés payés ?"
    print(f"\nQuery: {q1}")
    res1 = search_similar_chunks(q1, collection)
    print(f"Found {len(res1.chunks)} chunks")
    print(f"Best score: {res1.best_score:.2f}")
    print(f"Page range: {res1.page_range}")
    
    print("\n5. Testing general query...")
    q2 = "Quelles sont les obligations de l'employé ?"
    res2 = search_similar_chunks(q2, collection)
    print(f"Found {len(res2.chunks)} chunks")
    print(f"Best score: {res2.best_score:.2f}")
    print(f"Page range: {res2.page_range}")

if __name__ == "__main__":
    run_test()
