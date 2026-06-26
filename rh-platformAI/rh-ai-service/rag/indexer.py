"""
indexer.py — Extraction et indexation des documents PDF.

Flux :
  PDF → PyMuPDF (extraction texte + numéro de page)
      → LangChain TextSplitter (découpage en chunks)
      → SentenceTransformer (vectorisation)
      → ChromaDB (stockage persistant)
      → Groq (génération résumé + mots-clés)
"""
import logging
import fitz  # PyMuPDF
from langchain.text_splitter import RecursiveCharacterTextSplitter
import chromadb
from chromadb import PersistentClient

from config import (
    CHROMA_PATH, CHROMA_COLLECTION,
    CHUNK_SIZE, CHUNK_OVERLAP,
    GROQ_API_KEY, GROQ_MODEL, GROQ_MAX_TOKENS
)

logger = logging.getLogger(__name__)


def get_chroma_collection(embeddings_model) -> chromadb.Collection:
    """Retourne la collection ChromaDB avec la fonction d'embedding."""
    from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
    
    client = PersistentClient(path=CHROMA_PATH)
    ef = SentenceTransformerEmbeddingFunction(
        model_name=embeddings_model.model_name_or_path
        if hasattr(embeddings_model, 'model_name_or_path')
        else "paraphrase-multilingual-MiniLM-L12-v2"
    )
    collection = client.get_or_create_collection(
        name=CHROMA_COLLECTION,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"}
    )
    return collection


def extract_text_by_page(pdf_path: str) -> list[dict]:
    """
    Extrait le texte d'un PDF page par page avec PyMuPDF.
    
    Retourne une liste de dicts : {page_number, text}
    """
    pages = []
    try:
        doc = fitz.open(pdf_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text().strip()
            if text:  # ignorer les pages vides
                pages.append({
                    "page_number": page_num + 1,  # pages commencent à 1
                    "text": text
                })
        doc.close()
        logger.info(f"PDF extrait : {len(pages)} pages non vides")
    except Exception as e:
        logger.error(f"Erreur extraction PDF {pdf_path}: {e}")
        raise
    return pages


import re
from langchain.text_splitter import RecursiveCharacterTextSplitter

def chunk_pages(pages: list[dict], doc_id: str, doc_name: str) -> list[dict]:
    """
    Découpage intelligent respectant la structure juridique (Article/Chapitre).
    
    Garantit qu'un article de loi complet reste dans un seul chunk, 
    préservant ainsi toutes les listes et conditions.
    Chaque chunk porte start_page et end_page pour une traçabilité précise.
    """
    from config import CHUNK_SIZE
    
    full_text = ""
    page_map = []
    
    # Combinaison de toutes les pages avec traçabilité
    for page in pages:
        start_idx = len(full_text)
        text = page["text"] + "\n\n"
        full_text += text + "\n\n"
        end_idx = len(full_text)
        page_map.append((start_idx, end_idx, page["page_number"]))
        
    def get_page(idx):
        """Retourne le numéro de page pour une position donnée."""
        for start, end, p_num in page_map:
            if start <= idx < end:
                return p_num
        return pages[-1]["page_number"] if pages else 1

    def get_end_page(start_pos, text_len):
        """Retourne le numéro de page de la fin du chunk."""
        end_pos = start_pos + text_len
        end_page = get_page(start_pos)  # default = start page
        for start, end, p_num in page_map:
            if start < end_pos and end > start_pos:
                end_page = p_num
        return end_page

    # Regex : On cherche les lignes qui commencent par ARTICLE, TITRE ou CHAPITRE
    # On évite le ToC en ignorant les lignes avec des suites de points "...."
    pattern = r'(?im)^\s*(TITRE\s+[IVX\d]+|CHAPITRE\s+[IVX\d]+|ARTICLE\s+\d+|ARTICLE\s+PREMIER)(?![^\n]*\.{5,}).*?(\n|$)'
    
    matches = list(re.finditer(pattern, full_text))
    logger.info(f"Analyse structurelle : {len(matches)} entités juridiques détectées.")

    raw_chunks = []
    if not matches:
        raw_chunks.append((0, full_text))
    else:
        # Intro
        if matches[0].start() > 0:
            intro = full_text[0:matches[0].start()].strip()
            if intro: raw_chunks.append((0, intro))
            
        # Articles/Chapitres
        for i in range(len(matches)):
            start = matches[i].start()
            end = matches[i+1].start() if i+1 < len(matches) else len(full_text)
            content = full_text[start:end].strip()
            if content:
                raw_chunks.append((start, content))

    chunks = []
    current_chapitre = "Général"
    
    # Splitter de secours hiérarchique : respecte les listes à puces
    fallback_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=200,
        separators=["\n\n", "\n- ", "\n* ", "\n• ", "\n", ". ", " ", ""]
    )

    for start_pos, text in raw_chunks:
        # Pages : début et fin
        s_page = get_page(start_pos)
        e_page = get_end_page(start_pos, len(text))
        
        # Extraction Métadonnées du header
        article_num = ""
        header_match = re.search(r'(?i)^\s*(TITRE\s+[IVX\d]+|CHAPITRE\s+[IVX\d]+|ARTICLE\s+(\d+|PREMIER))', text)
        if header_match:
            label = header_match.group(1).strip().upper()
            if "ARTICLE" in label:
                num_match = re.search(r'\d+|PREMIER', label)
                article_num = num_match.group(0) if num_match else ""
            else:
                current_chapitre = label

        # Décision de split
        if len(text) > CHUNK_SIZE:
            logger.info(f"Article trop grand ({len(text)} chars) -> Split de secours.")
            sub_texts = fallback_splitter.split_text(text)
            for i, sub in enumerate(sub_texts):
                # Calculer la page du sous-chunk en cherchant sa position dans le texte original
                sub_offset = text.find(sub[:50])  # trouver l'offset approximatif
                sub_start = start_pos + (sub_offset if sub_offset >= 0 else 0)
                sub_s_page = get_page(sub_start)
                sub_e_page = get_end_page(sub_start, len(sub))
                chunks.append({
                    "doc_id": doc_id,
                    "doc_name": doc_name,
                    "text": sub.strip(),
                    "start_page": sub_s_page,
                    "end_page": sub_e_page,
                    "page_number": sub_s_page,  # rétrocompat
                    "chunk_index": len(chunks),
                    "chapitre": current_chapitre,
                    "article_number": article_num,
                    "is_split": True
                })
        else:
            chunks.append({
                "doc_id": doc_id,
                "doc_name": doc_name,
                "text": text,
                "start_page": s_page,
                "end_page": e_page,
                "page_number": s_page,  # rétrocompat
                "chunk_index": len(chunks),
                "chapitre": current_chapitre,
                "article_number": article_num,
                "is_split": False
            })

    return chunks


def store_chunks_in_chromadb(chunks: list[dict], collection: chromadb.Collection) -> int:
    """Indexe les chunks dans ChromaDB avec métadonnées enrichies."""
    if not chunks:
        return 0
    
    ids = []
    texts = []
    metadatas = []
    
    for chunk in chunks:
        chunk_id = f"doc_{chunk['doc_id']}_chunk_{chunk['chunk_index']}"
        ids.append(chunk_id)
        texts.append(chunk["text"])
        
        # Inclusion de toutes les métadonnées enrichies
        meta = {
            "doc_id": chunk["doc_id"],
            "doc_name": chunk["doc_name"],
            "page_number": chunk["page_number"],
            "start_page": chunk.get("start_page", chunk["page_number"]),
            "end_page": chunk.get("end_page", chunk["page_number"]),
            "chunk_index": chunk["chunk_index"],
            "chapitre": chunk.get("chapitre", "Général"),
            "article_number": chunk.get("article_number", ""),
            "is_split": chunk.get("is_split", False)
        }
        metadatas.append(meta)
    
    # Stockage par batches
    batch_size = 50
    for i in range(0, len(ids), batch_size):
        end = min(i + batch_size, len(ids))
        collection.add(
            ids=ids[i:end],
            documents=texts[i:end],
            metadatas=metadatas[i:end]
        )
    
    logger.info(f"Indexation terminée : {len(ids)} chunks stockés.")
    return len(ids)


def generate_summary_and_keywords(
    first_chunks: list[dict],
    doc_name: str
) -> tuple[str, str]:
    """
    Génère un résumé et des mots-clés via Groq.
    
    Utilise les 3 premiers chunks (introduction du document).
    Retourne (summary, keywords) sous forme de strings.
    """
    if not GROQ_API_KEY:
        return "", ""
    
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        
        # Prend les 3 premiers chunks pour le contexte
        context = "\n\n".join([c["text"] for c in first_chunks[:3]])
        
        prompt = f"""Tu es un assistant RH. Analyse ce document RH intitulé "{doc_name}".

Contenu du début du document :
{context}

Réponds EXACTEMENT dans ce format (sans rien d'autre) :
RÉSUMÉ: [2 à 3 phrases décrivant le contenu principal du document]
MOTS-CLÉS: [5 mots-clés séparés par des virgules]"""
        
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.1
        )
        
        content = response.choices[0].message.content.strip()
        
        # Parsing de la réponse
        summary = ""
        keywords = ""
        
        for line in content.split("\n"):
            if line.startswith("RÉSUMÉ:"):
                summary = line.replace("RÉSUMÉ:", "").strip()
            elif line.startswith("MOTS-CLÉS:"):
                keywords = line.replace("MOTS-CLÉS:", "").strip()
        
        logger.info(f"Résumé généré pour {doc_name}")
        return summary, keywords
        
    except Exception as e:
        logger.warning(f"Génération résumé échouée (non bloquant): {e}")
        return "", ""


def delete_document_vectors(doc_id: str, collection: chromadb.Collection) -> int:
    """
    Supprime tous les vecteurs d'un document depuis ChromaDB.
    
    Retourne le nombre de chunks supprimés.
    """
    try:
        # Récupère tous les IDs du document
        results = collection.get(
            where={"doc_id": doc_id},
            include=["metadatas"]
        )
        
        if not results["ids"]:
            logger.info(f"Aucun chunk trouvé pour doc_id={doc_id}")
            return 0
        
        ids_to_delete = results["ids"]
        collection.delete(ids=ids_to_delete)
        
        logger.info(f"Supprimé {len(ids_to_delete)} chunks pour doc_id={doc_id}")
        return len(ids_to_delete)
        
    except Exception as e:
        logger.error(f"Erreur suppression vecteurs doc_id={doc_id}: {e}")
        raise
