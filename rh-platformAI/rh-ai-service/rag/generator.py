"""
generator.py — Génération de réponses via LLM avec fallback.

Stratégie fallback :
  1. Groq API (llama3-8b) — gratuit, < 2s
  2. HuggingFace Inference API (Mistral 7B) — gratuit, ~10s
  3. Affichage des chunks bruts — toujours disponible

Le contexte employé (solde congés, poste, département) est injecté
dans le prompt pour personnaliser les réponses.
"""
import logging
import requests

from config import (
    GROQ_API_KEY, GROQ_MODEL, GROQ_MAX_TOKENS, GROQ_TEMPERATURE,
    HF_API_TOKEN, HF_MODEL_URL
)
from rag.retriever import RetrievalResult

logger = logging.getLogger(__name__)


def build_prompt(
    question: str,
    context: str,
    user_context: dict = None
) -> str:
    employee_info = ""
    if user_context and user_context.get("prenom"):
        employee_info = f"""
PROFIL DE L'EMPLOYÉ (À utiliser pour personnaliser la réponse si pertinent) :
- Prénom : {user_context.get('prenom', '')}
- Poste : {user_context.get('poste', '')}
- Département : {user_context.get('departement', '')}
- Congés restants : {user_context.get('solde_restant', 0)} jours
- Ancienneté : {user_context.get('anciennete', '')}
"""

    prompt = f"""Tu es un assistant RH JURIDIQUE expert, rigoureux et infaillible pour une entreprise marocaine. Ton rôle est d'analyser des textes de loi ou des règlements intérieurs et de répondre aux employés.

RÈGLES DE FER (TOLÉRANCE ZÉRO POUR L'ERREUR) :
1. VÉRITÉ ABSOLUE : Ta réponse doit être une EXTRACTION EXACTE des documents ci-dessous. N'invente, ne déduis, et ne présume RIEN.
2. EXHAUSTIVITÉ TOTALE : Si la question demande une liste (ex: "jours fériés", "obligations", "conditions"), tu DOIS lister TOUS les points mentionnés dans le texte. Ne fais JAMAIS de résumé partiel. Copie mentalement chaque puce du texte source.
3. CITATION DE SOURCE : Intègre la source naturellement dans ta réponse (ex: "Conformément à l'Article 35 du Règlement Intérieur, ...").
4. ABSENCE D'INFO : Si la réponse n'est pas TOTALEMENT contenue dans les extraits, réponds EXACTEMENT : "Cette information n'est pas précisée dans les documents RH à ma disposition. Veuillez contacter les Ressources Humaines."
5. FORMATAGE : Utilise des listes à puces pour chaque énumération. Sois clair et direct.
{employee_info}
--- DÉBUT DES DOCUMENTS JURIDIQUES/RH ---
{context}
--- FIN DES DOCUMENTS JURIDIQUES/RH ---

QUESTION DE L'EMPLOYÉ : {question}

RÉPONSE (Extraction exhaustive, étape par étape, basée UNIQUEMENT sur les textes) :"""

    return prompt


def generate_with_groq(prompt: str) -> tuple[str, str]:
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY non configurée")

    from groq import Groq
    client = Groq(api_key=GROQ_API_KEY)

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=GROQ_MAX_TOKENS,
        temperature=GROQ_TEMPERATURE
    )

    answer = response.choices[0].message.content.strip()
    return answer, f"groq/{GROQ_MODEL}"

def generate_with_huggingface(prompt: str) -> tuple[str, str]:
    """
    Génère une réponse via HuggingFace Inference API.
    Fallback si Groq est indisponible.
    Retourne (réponse, model_used) ou lève une exception.
    """
    if not HF_API_TOKEN:
        raise ValueError("HF_API_TOKEN non configurée")
    
    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 400,
            "temperature": 0.1,
            "return_full_text": False
        }
    }
    
    response = requests.post(
        HF_MODEL_URL,
        headers=headers,
        json=payload,
        timeout=30
    )
    response.raise_for_status()
    
    result = response.json()
    if isinstance(result, list) and result:
        answer = result[0].get("generated_text", "").strip()
        return answer, "huggingface/mistral-7b"
    
    raise ValueError("Réponse HuggingFace invalide")


def generate_raw_chunks_response(retrieval: RetrievalResult) -> tuple[str, str]:
    """
    Fallback ultime : affiche les chunks bruts sans synthèse LLM.
    Toujours disponible, même sans internet.
    """
    parts = ["Voici les extraits pertinents trouvés dans les documents RH :\n"]
    
    for i, (chunk, meta) in enumerate(zip(retrieval.chunks, retrieval.metadatas)):
        doc = meta.get("doc_name", "Document")
        page = meta.get("page_number", "?")
        parts.append(f"📄 {doc} — Page {page} :\n{chunk[:300]}...\n")
    
    return "\n".join(parts), "fallback/raw_chunks"


def generate_response(
    question: str,
    retrieval: RetrievalResult,
    user_context: dict = None
) -> tuple[str, str]:
    """
    Génère la réponse finale avec stratégie de fallback.
    
    Retourne (answer, model_used).
    
    Cascade :
      1. Groq API
      2. HuggingFace Inference API  
      3. Chunks bruts (toujours disponible)
    """
    
    # Cas : pas de contexte pertinent trouvé
    if not retrieval.is_relevant:
        return (
            "Je n'ai pas trouvé d'information sur ce sujet dans les documents RH disponibles. "
            "Je vous recommande de contacter directement le département RH pour obtenir une réponse précise.",
            "system/no_context"
        )
    
    context = retrieval.build_context()
    prompt = build_prompt(question, context, user_context)
    
    # Tentative 1 : Groq
    try:
        answer, model = generate_with_groq(prompt)
        logger.info(f"Réponse générée via Groq ({len(answer)} chars)")
        return answer, model
    except Exception as e:
        logger.warning(f"Groq échoué : {e} — passage au fallback HuggingFace")
    
    # Tentative 2 : HuggingFace
    try:
        answer, model = generate_with_huggingface(prompt)
        logger.info(f"Réponse générée via HuggingFace ({len(answer)} chars)")
        return answer, model
    except Exception as e:
        logger.warning(f"HuggingFace échoué : {e} — affichage chunks bruts")
    
    # Tentative 3 : Chunks bruts
    answer, model = generate_raw_chunks_response(retrieval)
    logger.info("Réponse en mode dégradé (chunks bruts)")
    return answer, model


def generate_onboarding_steps(
    prenom: str,
    poste: str,
    departement: str,
    available_docs: list[str]
) -> list[dict]:
    """
    Génère un parcours d'onboarding personnalisé via Groq.
    
    Appelé UNE SEULE FOIS à la création du compte employé.
    Résultat stocké en base MySQL par le User Service Java.
    """
    if not GROQ_API_KEY:
        return _default_onboarding_steps()
    
    docs_list = ", ".join(available_docs) if available_docs else "règlement intérieur, politique congés"
    
    prompt = f"""Tu es un responsable RH bienveillant dans une PME marocaine.
Génère un parcours d'intégration pour {prenom}, nouveau(elle) {poste} au département {departement}.

Documents RH disponibles dans la base : {docs_list}

Génère EXACTEMENT 5 étapes en JSON valide, sans commentaire ni markdown :
{{"etapes": [
  {{"titre": "...", "description": "...", "ordre": 1}},
  {{"titre": "...", "description": "...", "ordre": 2}},
  {{"titre": "...", "description": "...", "ordre": 3}},
  {{"titre": "...", "description": "...", "ordre": 4}},
  {{"titre": "...", "description": "...", "ordre": 5}}
]}}"""
    
    try:
        from groq import Groq
        import json
        
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0.3
        )
        
        content = response.choices[0].message.content.strip()
        
        # Nettoyage si markdown présent
        content = content.replace("```json", "").replace("```", "").strip()
        
        data = json.loads(content)
        return data.get("etapes", _default_onboarding_steps())
        
    except Exception as e:
        logger.warning(f"Génération onboarding échouée : {e} — étapes par défaut")
        return _default_onboarding_steps()


def _default_onboarding_steps() -> list[dict]:
    """Étapes par défaut si Groq est indisponible."""
    return [
        {"titre": "Lire le règlement intérieur", "description": "Prenez connaissance des règles de l'entreprise.", "ordre": 1},
        {"titre": "Consulter la politique de congés", "description": "Comprenez vos droits et les procédures de demande.", "ordre": 2},
        {"titre": "Découvrir vos avantages sociaux", "description": "Mutuelle, tickets restaurant, transport.", "ordre": 3},
        {"titre": "Rencontrer votre Manager", "description": "Planifiez un premier échange avec votre responsable.", "ordre": 4},
        {"titre": "Prendre en main la plateforme", "description": "Explorez votre espace self-service RH.", "ordre": 5},
    ]
