"""
retriever.py — Recherche de chunks similaires dans ChromaDB (Hybrid + Reranking).

Flux :
  Question → Recherche Sémantique (ChromaDB) + Recherche BM25 (Exact Match)
           → Fusion & Déduplication
           → Cross-Encoder Reranking (Top K)
           → Context Expansion sélective (articles scindés uniquement)
           → Retourne les chunks triés chronologiquement
"""
import logging
import re
import numpy as np
import chromadb

from config import (
    CONFIDENCE_THRESHOLD, MAX_CHUNKS,
    ENABLE_BM25, ENABLE_RERANKER, CROSS_ENCODER_MODEL,
    MAX_FINAL_CHUNKS, MAX_CONTEXT_CHUNKS, EXPANSION_SCORE_THRESHOLD
)

logger = logging.getLogger(__name__)

# --- Caches globaux ---
_bm25_cache = None
_bm25_doc_count = -1
_bm25_corpus = []
_bm25_metadatas = []
_bm25_ids = []

_cross_encoder = None

def get_cross_encoder():
    global _cross_encoder
    if _cross_encoder is None and ENABLE_RERANKER:
        try:
            from sentence_transformers import CrossEncoder
            logger.info(f"Chargement du CrossEncoder : {CROSS_ENCODER_MODEL}...")
            _cross_encoder = CrossEncoder(CROSS_ENCODER_MODEL)
        except Exception as e:
            logger.error(f"Erreur chargement CrossEncoder: {e}")
    return _cross_encoder

def get_bm25_index(collection: chromadb.Collection):
    global _bm25_cache, _bm25_doc_count, _bm25_corpus, _bm25_metadatas, _bm25_ids
    count = collection.count()
    if count == 0:
        return None, [], [], []
        
    if _bm25_cache is None or count != _bm25_doc_count:
        logger.info(f"Reconstruction de l'index BM25 en mémoire ({count} docs)...")
        all_docs = collection.get()
        _bm25_corpus = all_docs["documents"]
        _bm25_metadatas = all_docs["metadatas"]
        _bm25_ids = all_docs["ids"]
        
        # Tokenisation pour le français juridique (mots simples)
        tokenized_corpus = [re.findall(r'\w+', doc.lower()) for doc in _bm25_corpus]
        
        from rank_bm25 import BM25Okapi
        _bm25_cache = BM25Okapi(tokenized_corpus)
        _bm25_doc_count = count
        
    return _bm25_cache, _bm25_corpus, _bm25_metadatas, _bm25_ids


# Mots-clés qui indiquent une question demandant une liste complète
LIST_QUESTION_KEYWORDS = [
    "quels sont", "quelles sont", "liste",
    "tous les", "toutes les", "énumérer",
    "l'ensemble", "combien", "conditions pour",
    "quels sont les jours", "obligations"
]

def is_list_question(question: str) -> bool:
    q_lower = question.lower()
    return any(kw in q_lower for kw in LIST_QUESTION_KEYWORDS)


def format_page_range(pages: list[int]) -> str:
    """
    Formate une liste de pages en string lisible.
    Fusionne uniquement les pages consécutives.
    
    Exemples:
        [5] -> "Page 5"
        [5, 6] -> "Pages 5-6"
        [5, 8] -> "Pages 5, 8"
        [5, 6, 7] -> "Pages 5-7"
        [5, 6, 8, 10, 11] -> "Pages 5-6, 8, 10-11"
    """
    if not pages:
        return ""
    
    unique_pages = sorted(set(pages))
    
    if len(unique_pages) == 1:
        return f"Page {unique_pages[0]}"
    
    # Fusionner les pages consécutives en ranges
    ranges = []
    start = unique_pages[0]
    end = unique_pages[0]
    
    for p in unique_pages[1:]:
        if p == end + 1:
            end = p
        else:
            ranges.append((start, end))
            start = p
            end = p
    ranges.append((start, end))
    
    # Formatter
    parts = []
    for s, e in ranges:
        if s == e:
            parts.append(str(s))
        else:
            parts.append(f"{s}-{e}")
    
    return f"Pages {', '.join(parts)}"


class RetrievalResult:
    """Résultat d'une recherche dans ChromaDB."""
    
    def __init__(
        self,
        chunks: list[str],
        metadatas: list[dict],
        scores: list[float],
        is_relevant: bool
    ):
        self.chunks = chunks          
        self.metadatas = metadatas    
        self.scores = scores          
        self.is_relevant = is_relevant  
    
    @property
    def best_score(self) -> float:
        return self.scores[0] if self.scores else 0.0
    
    @property
    def best_doc_name(self) -> str:
        return self.metadatas[0].get("doc_name", "") if self.metadatas else ""
    
    @property
    def best_page(self) -> int:
        return self.metadatas[0].get("start_page", self.metadatas[0].get("page_number", 0)) if self.metadatas else 0
    
    @property
    def page_range(self) -> str:
        """Calcule le page range à partir de toutes les pages des chunks finaux."""
        if not self.metadatas:
            return ""
        all_pages = []
        for meta in self.metadatas:
            s = meta.get("start_page", meta.get("page_number", 0))
            e = meta.get("end_page", s)
            for p in range(s, e + 1):
                all_pages.append(p)
        return format_page_range(all_pages)
    
    def build_context(self) -> str:
        """Construit le contexte texte à envoyer au LLM avec métadonnées enrichies."""
        parts = []
        for i, (chunk, meta) in enumerate(zip(self.chunks, self.metadatas)):
            doc = meta.get("doc_name", "Document inconnu")
            s_page = meta.get("start_page", meta.get("page_number", "?"))
            e_page = meta.get("end_page", s_page)
            chapitre = meta.get("chapitre", "")
            article = meta.get("article_number", "")
            
            # Formatter la page
            if s_page == e_page:
                page_str = f"Page {s_page}"
            else:
                page_str = f"Pages {s_page}-{e_page}"
            
            ref_str = f"[{doc} — {page_str}"
            if chapitre and chapitre != "Général":
                ref_str += f", {chapitre}"
            if article:
                ref_str += f", Article {article}"
            ref_str += "]"
            
            parts.append(f"{ref_str}\n{chunk}")
        return "\n\n".join(parts)


def search_similar_chunks(
    question: str,
    collection: chromadb.Collection,
    n_results: int = None
) -> RetrievalResult:
    """
    Cherche les chunks pertinents via Hybrid Search + Reranking.
    """
    if n_results is None:
        n_results = MAX_CHUNKS
    
    count = collection.count()
    if count == 0:
        logger.warning("ChromaDB vide — aucun document indexé")
        return RetrievalResult([], [], [], False)
        
    # Pool de recherche initial (plus large pour le reranking)
    pool_n = min(n_results * 2, count) if is_list_question(question) else min(n_results, count)
    
    pool_chunks = []
    pool_metas = []
    pool_ids = set()
    pool_sources = {}  # id -> "SEMANTIC", "BM25", "SEMANTIC+BM25"
    
    # 1. Semantic Search (ChromaDB)
    chroma_results = collection.query(
        query_texts=[question],
        n_results=min(pool_n, count),
        include=["documents", "metadatas", "distances"]
    )
    
    if chroma_results["ids"][0]:
        for i, doc_id in enumerate(chroma_results["ids"][0]):
            pool_ids.add(doc_id)
            pool_chunks.append(chroma_results["documents"][0][i])
            pool_metas.append(chroma_results["metadatas"][0][i])
            pool_sources[doc_id] = "SEMANTIC"
            
    # 2. BM25 Search (Keyword Exact Match)
    if ENABLE_BM25:
        bm25, corpus, metadatas, ids = get_bm25_index(collection)
        if bm25:
            tokenized_query = re.findall(r'\w+', question.lower())
            scores = bm25.get_scores(tokenized_query)
            top_indices = np.argsort(scores)[::-1][:pool_n]
            
            added_bm25 = 0
            for idx in top_indices:
                if scores[idx] > 0 and ids[idx] not in pool_ids:
                    pool_ids.add(ids[idx])
                    pool_chunks.append(corpus[idx])
                    pool_metas.append(metadatas[idx])
                    pool_sources[ids[idx]] = "BM25"
                    added_bm25 += 1
                elif scores[idx] > 0 and ids[idx] in pool_ids:
                    pool_sources[ids[idx]] = "SEMANTIC+BM25"
            logger.info(f"BM25 a ajouté {added_bm25} chunks au pool hybride.")

    if not pool_chunks:
        return RetrievalResult([], [], [], False)

    # Limiter le pool de reranking à 20 chunks max
    MAX_RERANK_POOL = 20
    if len(pool_chunks) > MAX_RERANK_POOL:
        pool_chunks = pool_chunks[:MAX_RERANK_POOL]
        pool_metas = pool_metas[:MAX_RERANK_POOL]

    # 3. Cross-Encoder Reranking
    final_chunks = pool_chunks
    final_metas = pool_metas
    final_scores = [1.0] * len(pool_chunks)
    is_relevant = True
    
    if ENABLE_RERANKER:
        cross_encoder = get_cross_encoder()
        if cross_encoder:
            pairs = [[question, chunk] for chunk in pool_chunks]
            rerank_scores = cross_encoder.predict(pairs)
            
            # Combiner et trier par score de pertinence
            scored_results = list(zip(pool_chunks, pool_metas, rerank_scores))
            scored_results.sort(key=lambda x: x[2], reverse=True)
            
            # Ne garder que le Top K (MAX_FINAL_CHUNKS)
            scored_results = scored_results[:MAX_FINAL_CHUNKS]
            
            final_chunks = [x[0] for x in scored_results]
            final_metas = [x[1] for x in scored_results]
            final_scores = [float(x[2]) for x in scored_results]
            
            best_score = final_scores[0] if final_scores else -10.0
            is_relevant = best_score > 0.0
            
            # Logging des scores pour calibration empirique
            all_scores = [float(s) for s in rerank_scores]
            logger.info(
                f"Reranking terminé. Best: {best_score:.2f} | "
                f"Min: {min(all_scores):.2f} | Max: {max(all_scores):.2f} | "
                f"Avg: {sum(all_scores)/len(all_scores):.2f} | "
                f"Top {MAX_FINAL_CHUNKS} sélectionnés sur {len(all_scores)}"
            )
        else:
            final_chunks = final_chunks[:MAX_FINAL_CHUNKS]
            final_metas = final_metas[:MAX_FINAL_CHUNKS]
    else:
        final_chunks = final_chunks[:MAX_FINAL_CHUNKS]
        final_metas = final_metas[:MAX_FINAL_CHUNKS]

    if not is_relevant:
        logger.info(f"RAG : pertinence trop basse après reranking.")
        return RetrievalResult([], [], [], False)

    # 4. Context Expansion SÉLECTIVE (uniquement articles scindés avec score élevé)
    expanded_chunks = []
    expanded_metas = []
    expanded_scores = []
    expanded_ids = set()
    
    # D'abord, ajouter tous les chunks du top K
    for chunk, meta, score in zip(final_chunks, final_metas, final_scores):
        v_short_id = f"{meta.get('doc_id')}_{meta.get('chunk_index')}"
        if v_short_id not in expanded_ids:
            expanded_ids.add(v_short_id)
            expanded_chunks.append(chunk)
            expanded_metas.append(meta)
            expanded_scores.append(score)
    
    # Expansion : uniquement pour les chunks scindés avec score > threshold
    for chunk, meta, score in zip(final_chunks, final_metas, final_scores):
        if score < EXPANSION_SCORE_THRESHOLD:
            continue  # Pas assez pertinent pour expanser
        if not meta.get("is_split", False):
            continue  # Article pas scindé, pas besoin d'expansion
        
        art_num = meta.get("article_number", "")
        if not art_num or not art_num.strip():
            continue
            
        # Ne pas dépasser le hard cap
        if len(expanded_chunks) >= MAX_CONTEXT_CHUNKS:
            break
            
        logger.info(f"Expansion sélective : Article {art_num} (score={score:.2f}, is_split=True)")
        try:
            res = collection.get(where={"$and": [{"article_number": art_num}, {"doc_id": meta.get("doc_id")}]})
            
            for v_id, v_chunk, v_meta in zip(res["ids"], res["documents"], res["metadatas"]):
                v_short_id = f"{v_meta.get('doc_id')}_{v_meta.get('chunk_index')}"
                
                # Réduction STRICTEMENT identique (byte-for-byte / hash identique)
                # On ne supprime jamais l'expansion utile, seulement les vrais doublons techniques.
                if v_short_id not in expanded_ids and v_chunk not in expanded_chunks:
                    expanded_ids.add(v_short_id)
                    expanded_chunks.append(v_chunk)
                    expanded_metas.append(v_meta)
                    expanded_scores.append(score * 0.8)  # score réduit pour les voisins
                    
                    if len(expanded_chunks) >= MAX_CONTEXT_CHUNKS:
                        break
        except Exception as e:
            logger.warning(f"Erreur expansion article {art_num}: {e}")

    # 5. Hard cap final
    if len(expanded_chunks) > MAX_CONTEXT_CHUNKS:
        expanded_chunks = expanded_chunks[:MAX_CONTEXT_CHUNKS]
        expanded_metas = expanded_metas[:MAX_CONTEXT_CHUNKS]
        expanded_scores = expanded_scores[:MAX_CONTEXT_CHUNKS]

    # 6. Tri chronologique final pour le LLM
    final_combined = list(zip(expanded_chunks, expanded_metas, expanded_scores))
    final_combined.sort(key=lambda x: (x[1].get('page_number', 0), x[1].get('chunk_index', 0)))
    
    sorted_chunks = [x[0] for x in final_combined]
    sorted_metas = [x[1] for x in final_combined]
    sorted_scores = [x[2] for x in final_combined]
    
    # 7. Logging détaillé de chaque chunk final
    estimated_tokens = sum(len(c) for c in sorted_chunks) // 4
    logger.info(f"RAG final : {len(sorted_chunks)} chunks | ~{estimated_tokens} tokens estimés")
    for i, (chunk, meta, score) in enumerate(zip(sorted_chunks, sorted_metas, sorted_scores)):
        art = meta.get('article_number', '?')
        s_page = meta.get('start_page', meta.get('page_number', '?'))
        e_page = meta.get('end_page', s_page)
        page_str = f"{s_page}" if s_page == e_page else f"{s_page}-{e_page}"
        source = pool_sources.get(f"doc_{meta.get('doc_id')}_chunk_{meta.get('chunk_index')}", "EXPANDED")
        is_split = "SPLIT" if meta.get('is_split', False) else "FULL"
        logger.info(f"  [Final #{i+1}] Art.{art} | Page {page_str} | Score: {score:.2f} | {source} | {is_split}")
    
    return RetrievalResult(sorted_chunks, sorted_metas, sorted_scores, True)
