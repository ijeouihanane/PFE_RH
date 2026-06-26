"""
schemas.py — Modèles Pydantic pour les requêtes et réponses API.
Ces schémas définissent exactement ce que Java envoie et ce que Python retourne.
"""
from pydantic import BaseModel
from typing import Optional


# ── Contexte employé envoyé par Java ─────────────────────────────
class UserContext(BaseModel):
    """
    Contexte de l'employé connecté, envoyé par le Document Service Java.
    Permet au chatbot de personnaliser ses réponses.
    """
    prenom: str = ""
    poste: str = ""
    departement: str = ""
    solde_restant: int = 0
    anciennete: str = ""


# ── Requête chat ──────────────────────────────────────────────────
class ChatRequest(BaseModel):
    """Requête envoyée par le Document Service Java pour poser une question."""
    question: str
    user_id: str = "anonymous"
    user_context: Optional[UserContext] = None


# ── Réponse chat ──────────────────────────────────────────────────
class ChatResponse(BaseModel):
    """Réponse retournée au Document Service Java."""
    model_config = {"protected_namespaces": ()}

    answer: str
    doc_source: Optional[str] = None
    page_number: Optional[int] = None
    page_range: Optional[str] = None  # ex: "Pages 5-6, 8"
    confidence_score: float = 0.0
    answered: bool = True
    model_used: str = "groq/llama3-8b"


# ── Requête indexation ────────────────────────────────────────────
class IndexRequest(BaseModel):
    """
    Requête d'indexation envoyée par le Document Service Java
    après l'upload d'un PDF.
    """
    file_path: str          # chemin local du fichier PDF
    doc_id: str             # identifiant MySQL du document
    doc_name: str           # nom du fichier (ex: Reglement_Interieur.pdf)


# ── Réponse indexation ────────────────────────────────────────────
class IndexResponse(BaseModel):
    """Réponse retournée au Document Service Java après indexation."""
    status: str             # "success" ou "error"
    doc_id: str
    doc_name: str
    nb_pages: int = 0
    nb_chunks: int = 0
    summary: str = ""
    keywords: str = ""
    message: str = ""


# ── Requête onboarding ────────────────────────────────────────────
class OnboardingRequest(BaseModel):
    """
    Requête de génération de parcours d'onboarding.
    Envoyée par le User Service Java à la création d'un compte.
    """
    prenom: str
    poste: str
    departement: str


# ── Étape onboarding ──────────────────────────────────────────────
class OnboardingStep(BaseModel):
    """Une étape du parcours d'intégration."""
    titre: str
    description: str
    ordre: int


# ── Réponse onboarding ────────────────────────────────────────────
class OnboardingResponse(BaseModel):
    """Liste des étapes générées par l'AI."""
    etapes: list[OnboardingStep]
    message: str = ""


# ── Réponse suppression ───────────────────────────────────────────
class DeleteResponse(BaseModel):
    """Confirmation de suppression des vecteurs d'un document."""
    status: str
    doc_id: str
    chunks_deleted: int = 0


# ── Réponse health ────────────────────────────────────────────────
class HealthResponse(BaseModel):
    """État du service — appelé par Java pour vérifier que Python est up."""
    status: str
    chromadb: str
    embeddings_model: str
    groq_configured: bool
    version: str = "1.0.0"