package ma.pfe.rh.chat.integration;

public record UserSummary(
        Long id,
        String nom,
        String prenom,
        String email,
        String role,
        String photoUrl
) {
    public String fullName() {
        String full = ((prenom == null ? "" : prenom) + " " + (nom == null ? "" : nom)).trim();
        return full.isBlank() ? email : full;
    }
}
