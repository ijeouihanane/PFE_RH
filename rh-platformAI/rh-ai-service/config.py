"""
config.py — Configuration centralisée du service AI
Toutes les variables d'environnement sont chargées ici.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── Clés API ──────────────────────────────────────────────────────
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
HF_API_TOKEN: str = os.getenv("HF_API_TOKEN", "")

# ── ChromaDB ──────────────────────────────────────────────────────
CHROMA_PATH: str = os.getenv("CHROMA_PATH", "./chroma_db")
CHROMA_COLLECTION: str = "rh_documents"

# ── Modèle embeddings ─────────────────────────────────────────────
EMBEDDINGS_MODEL: str = os.getenv(
    "EMBEDDINGS_MODEL",
    "paraphrase-multilingual-MiniLM-L12-v2"
)

# ── Paramètres RAG Juridique ──────────────────────────────────────
CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.30")) # Baissé car le reranker fera le tri final
MAX_CHUNKS: int = int(os.getenv("MAX_CHUNKS", "10")) # Plus de chunks pour le pool hybride
CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "6000")) # Taille max très haute pour ne pas couper les articles
CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "0")) # On gère l'overlap sémantiquement par article
ENABLE_BM25: bool = os.getenv("ENABLE_BM25", "true").lower() == "true"
ENABLE_RERANKER: bool = os.getenv("ENABLE_RERANKER", "true").lower() == "true"
CROSS_ENCODER_MODEL: str = os.getenv("CROSS_ENCODER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
MAX_FINAL_CHUNKS: int = int(os.getenv("MAX_FINAL_CHUNKS", "5"))       # Top K après reranking
MAX_CONTEXT_CHUNKS: int = int(os.getenv("MAX_CONTEXT_CHUNKS", "10"))  # Hard cap après expansion
EXPANSION_SCORE_THRESHOLD: float = float(os.getenv("EXPANSION_SCORE_THRESHOLD", "2.0"))  # Score min pour expansion


# ── Groq ──────────────────────────────────────────────────────────
GROQ_MODEL: str = "llama-3.3-70b-versatile"
GROQ_MAX_TOKENS: int = 600
GROQ_TEMPERATURE: float = 0.1

# ── HuggingFace fallback ──────────────────────────────────────────
HF_MODEL_URL: str = (
    "https://api-inference.huggingface.co/models/"
    "mistralai/Mistral-7B-Instruct-v0.3"
)

# ── Validation au démarrage ───────────────────────────────────────
def validate_config() -> list[str]:
    """Retourne la liste des problèmes de configuration."""
    warnings = []
    if not GROQ_API_KEY:
        warnings.append("GROQ_API_KEY manquante — le chatbot utilisera le fallback HuggingFace")
    if not HF_API_TOKEN:
        warnings.append("HF_API_TOKEN manquante — pas de fallback disponible si Groq down")
    return warnings
