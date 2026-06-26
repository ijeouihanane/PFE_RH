"""
main.py — Point d'entrée du service Python AI.

Ce service est appelé EXCLUSIVEMENT par les microservices Java.
Il expose une API REST sur le port 8000.

Démarrage : uvicorn main:app --reload --port 8000
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import (
    CHROMA_PATH, EMBEDDINGS_MODEL, GROQ_API_KEY,
    validate_config
)
from models.schemas import (
    ChatRequest, ChatResponse,
    IndexRequest, IndexResponse,
    OnboardingRequest, OnboardingResponse, OnboardingStep,
    DeleteResponse, HealthResponse
)
from rag.indexer import (
    get_chroma_collection,
    extract_text_by_page,
    chunk_pages,
    store_chunks_in_chromadb,
    generate_summary_and_keywords,
    delete_document_vectors
)
from rag.retriever import search_similar_chunks
from rag.generator import generate_response, generate_onboarding_steps

# ── Logging ───────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s"
)
logger = logging.getLogger(__name__)

# ── Globals chargés au démarrage ──────────────────────────────────
embeddings_model = None
chroma_collection = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Chargement des modèles AU DÉMARRAGE (une seule fois).
    Le modèle MiniLM est téléchargé depuis HuggingFace au 1er lancement (~120MB).
    Les lancements suivants utilisent le cache local.
    """
    global embeddings_model, chroma_collection
    
    logger.info("=== Démarrage du service AI RH ===")
    
    # Validation configuration
    warnings = validate_config()
    for w in warnings:
        logger.warning(f"CONFIG: {w}")
    
    # Chargement modèle embeddings
    logger.info(f"Chargement modèle embeddings : {EMBEDDINGS_MODEL}")
    logger.info("(Premier lancement : téléchargement ~120MB depuis HuggingFace)")
    
    try:
        from sentence_transformers import SentenceTransformer
        embeddings_model = SentenceTransformer(EMBEDDINGS_MODEL)
        logger.info("Modèle embeddings chargé avec succès")
    except Exception as e:
        logger.error(f"Erreur chargement modèle : {e}")
        raise
    
    # Initialisation ChromaDB
    logger.info(f"Connexion ChromaDB : {CHROMA_PATH}")
    os.makedirs(CHROMA_PATH, exist_ok=True)
    
    try:
        chroma_collection = get_chroma_collection(embeddings_model)
        doc_count = chroma_collection.count()
        logger.info(f"ChromaDB prêt — {doc_count} chunks existants")
    except Exception as e:
        logger.error(f"Erreur ChromaDB : {e}")
        raise
    
    logger.info("=== Service AI prêt à recevoir des requêtes ===")
    
    yield  # Application active
    
    logger.info("=== Arrêt du service AI ===")


# ── Application FastAPI ───────────────────────────────────────────
app = FastAPI(
    title="RH Platform — AI Service",
    description="Service RAG pour l'assistant RH intelligent",
    version="1.0.0",
    lifespan=lifespan
)
# 👉 AJOUT ICI
@app.get("/")
def root():
    return {"message": "AI Service is running"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production : restreindre aux services Java
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════
# ENDPOINT : GET /health
# ══════════════════════════════════════════════════════════════════
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Vérifie l'état du service.
    Appelé par Java au démarrage pour confirmer que Python est opérationnel.
    """
    chroma_status = "ok" if chroma_collection is not None else "error"
    model_status = "loaded" if embeddings_model is not None else "not loaded"
    
    return HealthResponse(
        status="ok",
        chromadb=chroma_status,
        embeddings_model=model_status,
        groq_configured=bool(GROQ_API_KEY),
        version="1.0.0"
    )


# ══════════════════════════════════════════════════════════════════
# ENDPOINT : POST /index
# ══════════════════════════════════════════════════════════════════
@app.post("/index", response_model=IndexResponse)
async def index_document(request: IndexRequest):
    """
    Indexe un document PDF dans ChromaDB.
    
    Appelé par le Document Service Java après l'upload d'un PDF.
    
    Corps attendu (JSON) :
    {
        "file_path": "/chemin/vers/fichier.pdf",
        "doc_id": "42",
        "doc_name": "Reglement_Interieur.pdf"
    }
    """
    logger.info(f"Indexation demandée : {request.doc_name} (id={request.doc_id})")
    
    # Vérification existence du fichier
    if not os.path.exists(request.file_path):
        raise HTTPException(
            status_code=404,
            detail=f"Fichier non trouvé : {request.file_path}"
        )
    
    try:
        # 1. Extraction texte PDF
        pages = extract_text_by_page(request.file_path)
        if not pages:
            raise HTTPException(
                status_code=422,
                detail="PDF vide ou non extractible (PDF scanné non supporté)"
            )
        
        # 2. Découpage en chunks
        chunks = chunk_pages(pages, request.doc_id, request.doc_name)
        
        # 3. Stockage dans ChromaDB
        nb_stored = store_chunks_in_chromadb(chunks, chroma_collection)
        
        # 4. Génération résumé + mots-clés (désactivé pour économiser l'API Groq)
        summary, keywords = "", ""
        
        logger.info(
            f"Indexation terminée : {request.doc_name} — "
            f"{len(pages)} pages, {nb_stored} chunks"
        )
        
        return IndexResponse(
            status="success",
            doc_id=request.doc_id,
            doc_name=request.doc_name,
            nb_pages=len(pages),
            nb_chunks=nb_stored,
            summary=summary,
            keywords=keywords,
            message=f"Document indexé avec succès ({nb_stored} chunks)"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur indexation {request.doc_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════
# ENDPOINT : POST /chat
# ══════════════════════════════════════════════════════════════════
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Répond à une question via RAG.
    
    Appelé par le Document Service Java quand un employé pose une question.
    
    Corps attendu (JSON) :
    {
        "question": "Combien de jours de congé annuel ?",
        "user_id": "42",
        "user_context": {
            "prenom": "Karim",
            "poste": "Développeur Java",
            "departement": "IT",
            "solde_restant": 18,
            "anciennete": "2 ans"
        }
    }
    """
    logger.info(f"Question reçue (user={request.user_id}): {request.question[:80]}...")
    
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="La question ne peut pas être vide")
    
    try:
        # 1. Recherche des chunks similaires
        retrieval = search_similar_chunks(request.question, chroma_collection)
        
        # 2. Génération de la réponse
        user_ctx = request.user_context.model_dump() if request.user_context else None
        answer, model_used = generate_response(
            request.question,
            retrieval,
            user_ctx
        )
        
        return ChatResponse(
            answer=answer,
            doc_source=retrieval.best_doc_name if retrieval.is_relevant else None,
            page_number=retrieval.best_page if retrieval.is_relevant else None,
            page_range=retrieval.page_range if retrieval.is_relevant else None,
            confidence_score=round(retrieval.best_score, 3),
            answered=retrieval.is_relevant,
            model_used=model_used
        )
        
    except Exception as e:
        logger.error(f"Erreur chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════
# ENDPOINT : POST /generate-onboarding
# ══════════════════════════════════════════════════════════════════
@app.post("/generate-onboarding", response_model=OnboardingResponse)
async def generate_onboarding(request: OnboardingRequest):
    """
    Génère un parcours d'onboarding personnalisé.
    
    Appelé UNE SEULE FOIS par le User Service Java à la création d'un compte.
    Le résultat est stocké dans la table onboarding_steps MySQL.
    
    Corps attendu (JSON) :
    {
        "prenom": "Sara",
        "poste": "Développeuse Angular",
        "departement": "IT"
    }
    """
    logger.info(f"Génération onboarding pour {request.prenom} ({request.poste})")
    
    # Liste des documents disponibles dans ChromaDB
    try:
        results = chroma_collection.get(include=["metadatas"])
        doc_names = list(set(
            m.get("doc_name", "") 
            for m in results["metadatas"] 
            if m.get("doc_name")
        ))
    except Exception:
        doc_names = []
    
    steps_data = generate_onboarding_steps(
        request.prenom,
        request.poste,
        request.departement,
        doc_names
    )
    
    steps = [OnboardingStep(**step) for step in steps_data]
    
    return OnboardingResponse(
        etapes=steps,
        message=f"Parcours d'onboarding généré pour {request.prenom}"
    )


# ══════════════════════════════════════════════════════════════════
# ENDPOINT : DELETE /documents/{doc_id}
# ══════════════════════════════════════════════════════════════════
@app.delete("/documents/{doc_id}", response_model=DeleteResponse)
async def delete_document(doc_id: str):
    """
    Supprime tous les vecteurs d'un document depuis ChromaDB.
    
    Appelé par le Document Service Java quand le RH supprime un document.
    Doit être appelé AVANT de supprimer le fichier physique.
    """
    logger.info(f"Suppression vecteurs demandée : doc_id={doc_id}")
    
    try:
        nb_deleted = delete_document_vectors(doc_id, chroma_collection)
        
        return DeleteResponse(
            status="success",
            doc_id=doc_id,
            chunks_deleted=nb_deleted
        )
    except Exception as e:
        logger.error(f"Erreur suppression doc_id={doc_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════
# ENDPOINT : GET /documents
# ══════════════════════════════════════════════════════════════════
@app.get("/documents")
async def list_documents():
    """
    Liste les documents indexés dans ChromaDB avec leur nombre de chunks.
    
    Utile pour le dashboard RH et pour vérifier l'état de l'index.
    """
    try:
        results = chroma_collection.get(include=["metadatas"])
        
        # Agrégation par document
        doc_map = {}
        for meta in results["metadatas"]:
            doc_id = meta.get("doc_id", "?")
            doc_name = meta.get("doc_name", "Inconnu")
            if doc_id not in doc_map:
                doc_map[doc_id] = {"doc_id": doc_id, "doc_name": doc_name, "nb_chunks": 0}
            doc_map[doc_id]["nb_chunks"] += 1
        
        documents = list(doc_map.values())
        return {"documents": documents, "total": len(documents)}
        
    except Exception as e:
        logger.error(f"Erreur liste documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Démarrage direct (pour test sans uvicorn CLI) ─────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
