package ma.pfe.rh.users.dto;

import lombok.Builder;
import lombok.Value;
import ma.pfe.rh.users.domain.Role;
import ma.pfe.rh.users.domain.TypeContrat;
import ma.pfe.rh.users.domain.User;

import java.time.Instant;
import java.time.LocalDate;

@Value
@Builder
public class UserResponse {
    Long id;
    String nom;
    String prenom;
    String email;
    String photoUrl;
    String cin;
    String telephone;
    LocalDate dateNaissance;
    String etatCivil;
    String adresse;
    String ville;
    String nationalite;
    String matricule;
    TypeContrat typeContrat;
    String poste;
    String departement;
    LocalDate dateEmbauche;
    String statut;
    String cvUrl;
    String nomBanque;
    String rib;
    String cnss;
    Role role;
    Long managerId;
    boolean actif;
    boolean firstLogin;
    Instant createdAt;
    Instant updatedAt;
    Instant lastLogin;

    public static UserResponse from(User u) {
        return UserResponse.builder()
                .id(u.getId())
                .nom(u.getNom())
                .prenom(u.getPrenom())
                .email(u.getEmail())
                .photoUrl(u.getPhotoUrl())
                .cin(u.getCin())
                .telephone(u.getTelephone())
                .dateNaissance(u.getDateNaissance())
                .etatCivil(u.getEtatCivil())
                .adresse(u.getAdresse())
                .ville(u.getVille())
                .nationalite(u.getNationalite())
                .matricule(u.getMatricule())
                .typeContrat(u.getTypeContrat())
                .poste(u.getPoste())
                .departement(u.getDepartement())
                .dateEmbauche(u.getDateEmbauche())
                .statut(u.getStatut())
                .cvUrl(u.getCvUrl())
                .nomBanque(u.getNomBanque())
                .rib(u.getRib())
                .cnss(u.getCnss())
                .role(u.getRole())
                .managerId(u.getManagerId())
                .actif(u.isActif())
                .firstLogin(u.isFirstLogin())
                .createdAt(u.getCreatedAt())
                .updatedAt(u.getUpdatedAt())
                .lastLogin(u.getLastLogin())
                .build();
    }
}
