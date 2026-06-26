"""
test_phase1.py — Validation complète du service AI (Phase 1).

Usage :
    python test_phase1.py                        # PDF de test auto
    python test_phase1.py MonDocument.pdf        # Ton propre PDF

Prérequis : service démarré avec
    uvicorn main:app --port 8000
"""
import sys
import time
import os
import requests
import tempfile

BASE_URL = "http://localhost:8000"

SEP = "=" * 65

def section(title): print(f"\n{SEP}\n  {title}\n{SEP}")
def ok(msg):   print(f"  ✅  {msg}")
def fail(msg): print(f"  ❌  {msg}")
def info(msg): print(f"  ℹ   {msg}")
def warn(msg): print(f"  ⚠   {msg}")


def wait_for_service(max_wait: int = 60) -> bool:
    """
    Attend que le service soit prêt avant de lancer les tests.
    Le modèle MiniLM prend ~15s à charger — on attend jusqu'à max_wait secondes.
    """
    print(f"\n  Connexion au service (attente max {max_wait}s)...", end="", flush=True)
    start = time.time()
    while time.time() - start < max_wait:
        try:
            r = requests.get(f"{BASE_URL}/health", timeout=3)
            if r.status_code == 200:
                print(" OK\n")
                return True
        except Exception:
            pass
        print(".", end="", flush=True)
        time.sleep(2)
    print("\n")
    fail(f"Service non disponible après {max_wait}s.")
    fail("Lance le service dans un autre terminal :")
    fail("  uvicorn main:app --port 8000")
    return False


def test_health() -> bool:
    section("Test 1 — État du service")
    r = requests.get(f"{BASE_URL}/health", timeout=5)
    d = r.json()
    ok("Service opérationnel")
    info(f"ChromaDB         : {d['chromadb']}")
    info(f"Modèle embeddings: {d['embeddings_model']}")
    info(f"Groq configuré   : {d['groq_configured']}")
    return True


def test_index(pdf_path: str) -> str | None:
    section("Test 2 — Indexation du document PDF")
    doc_id   = "demo_001"
    doc_name = os.path.basename(pdf_path)
    abs_path = os.path.abspath(pdf_path)

    info(f"Fichier : {doc_name}")
    info(f"Chemin  : {abs_path}")

    payload = {"file_path": abs_path, "doc_id": doc_id, "doc_name": doc_name}
    start = time.time()
    try:
        r = requests.post(f"{BASE_URL}/index", json=payload, timeout=60)
    except requests.exceptions.Timeout:
        fail("Timeout — PDF trop volumineux ?")
        return None

    elapsed = time.time() - start

    if r.status_code == 200:
        d = r.json()
        ok(f"Indexation réussie en {elapsed:.1f}s")
        info(f"Pages   : {d['nb_pages']}")
        info(f"Chunks  : {d['nb_chunks']}")
        if d.get("summary"):
            print(f"\n  📋 Résumé automatique :\n     {d['summary']}")
        if d.get("keywords"):
            print(f"\n  🏷  Mots-clés : {d['keywords']}")
        return doc_id
    elif r.status_code == 422:
        fail("PDF non extractible (probablement scanné)")
        return None
    else:
        fail(f"Erreur {r.status_code} : {r.json().get('detail', r.text)}")
        return None


def test_list():
    section("Test 3 — Documents indexés dans ChromaDB")
    d = requests.get(f"{BASE_URL}/documents", timeout=10).json()
    ok(f"{d['total']} document(s) indexé(s)")
    for doc in d["documents"]:
        info(f"  • {doc['doc_name']}  ({doc['nb_chunks']} chunks)")


def test_chat_demo():
    section("Test 4 — Démonstration Chatbot RAG")
   
    questions = [
        {
            "label": "Question précise avec contexte employé",
            "question": "Quelles sont les obligations générales d'un employé ?",
            "user_context": {
                "prenom": "Karim",
                "poste": "Développeur Java",
                "departement": "IT",
                "solde_restant": 18,
                "anciennete": "2 ans"
            }
        },
        {
            "label": "Question de synthèse",
            "question": "Quelles sont les règles disciplinaires principales ?",
            "user_context": None
        },
        {
            "label": "Question hors document — test seuil de confiance",
            "question": "Quel est le cours de la bourse aujourd'hui ?",
            "user_context": None
        },
    ]

    for i, q in enumerate(questions, 1):
        print(f"\n  {'─'*60}")
        print(f"  Question {i} — {q['label']}")
        print(f"  {'─'*60}")
        print(f"\n  Q : {q['question']}")

        if q.get("user_context"):
            ctx = q["user_context"]
            print(f"  Profil employé : {ctx['prenom']} · {ctx['poste']} · "
                  f"{ctx['solde_restant']} jours congés restants")

        payload = {
            "question": q["question"],
            "user_id": "demo_user",
            "user_context": q["user_context"]
        }

        start = time.time()
        try:
            r = requests.post(f"{BASE_URL}/chat", json=payload, timeout=30)
        except requests.exceptions.Timeout:
            fail("Timeout Groq — réessaie")
            continue

        elapsed = time.time() - start

        if r.status_code != 200:
            fail(f"Erreur HTTP {r.status_code}")
            continue

        d = r.json()
        answered = d.get("answered", False)
        score    = d.get("confidence_score", 0)

        print()
        if answered:
            ok(f"{elapsed:.1f}s · score={score:.2f} · {d.get('model_used')}")
            info(f"Source : {d.get('doc_source')} — Page {d.get('page_number')}")
            # Réponse complète sans troncature
            print(f"\n  R : {d['answer']}\n")
        else:
            ok(f"Hors contexte détecté correctement · score={score:.2f} · {elapsed:.1f}s")
            print(f"\n  R : {d['answer']}\n")


def test_onboarding():
    """
    Simule la création d'un compte employé.
    Le système génère automatiquement un parcours d'intégration personnalisé
    qui sera affiché dans Angular et coché par l'employé étape par étape.
    """
    section("Test 5 — Génération parcours d'onboarding")
    print("\n  Simulation : le RH crée le compte de Sara Moukrim.")
    print("  Le système génère automatiquement son parcours d'intégration.\n")

    payload = {"prenom": "Sara", "poste": "Développeuse Angular", "departement": "IT"}

    start = time.time()
    r = requests.post(f"{BASE_URL}/generate-onboarding", json=payload, timeout=30)
    elapsed = time.time() - start

    if r.status_code != 200:
        fail(f"Erreur : {r.text}")
        return

    d = r.json()
    etapes = d.get("etapes", [])

    # Dédoublonnage — protection contre les doublons de Groq
    seen, etapes_propres = set(), []
    for e in etapes:
        titre = e.get("titre", "").strip()
        if titre and titre not in seen:
            seen.add(titre)
            etapes_propres.append(e)

    # Réassigner les ordres proprement
    for i, e in enumerate(etapes_propres, 1):
        e["ordre"] = i

    ok(f"Parcours généré en {elapsed:.1f}s — {len(etapes_propres)} étapes")
    print(f"\n  Parcours d'intégration — {payload['prenom']} ({payload['poste']}) :\n")

    for e in etapes_propres:
        print(f"  ⬜  {e['ordre']}. {e['titre']}")
        if e.get("description"):
            print(f"       └ {e['description']}")

    print(f"  dans l'interface Angular. L'employé les coche au fur et à mesure.")


def test_delete(doc_id: str):
    section("Test 6 — Suppression du document (nettoyage)")
    r = requests.delete(f"{BASE_URL}/documents/{doc_id}", timeout=10)
    if r.status_code == 200:
        d = r.json()
        ok(f"{d['chunks_deleted']} vecteurs supprimés de ChromaDB")
        info("Base vectorielle vidée — prête pour les vrais documents RH")
    else:
        fail(f"Erreur : {r.text}")


def create_test_pdf() -> str:
    """
    Crée un PDF de démonstration.
    Utilise tempfile.gettempdir() au lieu de /tmp/ — compatible Windows et Linux.
    """
    pdf_path = os.path.join(tempfile.gettempdir(), "rh_demo_document.pdf")

    try:
        import fitz
        doc = fitz.open()

        page1 = doc.new_page()
        page1.insert_text((50, 50), """POLITIQUE RH — TECHCORP MAROC

ARTICLE 1 — Obligations générales
Tout employé s'engage à exercer ses fonctions avec sérieux,
professionnalisme et loyauté envers l'entreprise.
Il doit respecter les règles de confidentialité et ne pas
divulguer d'informations sensibles à des tiers.

ARTICLE 2 — Congés annuels
Tout employé ayant accompli une année de présence bénéficie
de 26 jours ouvrables de congé annuel payé.
Les demandes doivent être soumises 15 jours à l'avance.
Le Manager dispose de 3 jours pour valider ou refuser.

ARTICLE 3 — Congés exceptionnels
Mariage : 4 jours — Naissance : 3 jours
Décès conjoint : 5 jours — Décès parent : 3 jours""", fontsize=11)

        page2 = doc.new_page()
        page2.insert_text((50, 50), """ARTICLE 4 — Discipline
Tout manquement peut entraîner une sanction : avertissement,
mise à pied ou licenciement selon la gravité des faits.
Les sanctions sont prononcées après entretien préalable.

ARTICLE 5 — Télétravail
Éligible après 6 mois d'ancienneté — 2 jours maximum par semaine.
Accord préalable du Manager obligatoire.
Le matériel est fourni par l'entreprise.

ARTICLE 6 — Avantages sociaux
Mutuelle santé : 60% à la charge de l'entreprise.
Tickets restaurant : 50 DH par jour travaillé.
Indemnité transport : 200 DH par mois.""", fontsize=11)

        doc.save(pdf_path)
        doc.close()
        info(f"PDF de démonstration créé : {pdf_path}")
        return pdf_path

    except ImportError:
        fail("PyMuPDF non installé — lance : pip install pymupdf")
        sys.exit(1)
    except Exception as e:
        fail(f"Erreur création PDF : {e}")
        sys.exit(1)


# ── MAIN ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"\n{SEP}")
    print("  VALIDATION SERVICE AI — Plateforme RH Intelligente")
    print("  Phase 1 : RAG · Chatbot · Onboarding")
    print(SEP)

    # PDF à utiliser
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        if not os.path.exists(pdf_path):
            fail(f"Fichier introuvable : {pdf_path}")
            sys.exit(1)
        info(f"PDF : {pdf_path}")
    else:
        warn("Aucun PDF fourni — génération d'un document de démonstration")
        pdf_path = create_test_pdf()

    # Attendre service prêt (gère le délai de chargement MiniLM ~15s)
    if not wait_for_service(max_wait=60):
        sys.exit(1)

    test_health()
    time.sleep(1)

    doc_id = test_index(pdf_path)
    time.sleep(2)

    if doc_id:
        test_list()
        time.sleep(1)
        test_chat_demo()
        time.sleep(1)
        test_onboarding()
        time.sleep(1)
        test_delete(doc_id)
    
    print(f"{SEP}\n")