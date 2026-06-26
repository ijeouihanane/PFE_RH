package ma.pfe.rh.documents.domain;

public enum DocumentRequestType {
    ATTESTATION_TRAVAIL,
    ATTESTATION_SALAIRE,
    FICHE_PAIE,
    ATTESTATION_CNSS,
    AUTRE,

    // Conserves old database values while the UI exposes only the new SIRH list.
    DECLARATION_CNSS,
    ATTESTATION_STAGE,
    CERTIFICAT
}
