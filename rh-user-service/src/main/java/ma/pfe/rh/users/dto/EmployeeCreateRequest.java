package ma.pfe.rh.users.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import ma.pfe.rh.users.domain.Role;
import ma.pfe.rh.users.domain.TypeContrat;

import java.time.LocalDate;

@Data
public class EmployeeCreateRequest {

    @NotBlank
    private String nom;

    @NotBlank
    private String prenom;

    @Email
    @NotBlank
    private String email;

    private String cin;
    private String telephone;
    private LocalDate dateNaissance;
    private String etatCivil;
    private String adresse;
    private String ville;
    private String nationalite;

    private String matricule;

    @NotNull
    private TypeContrat typeContrat;

    private String poste;

    private String departement;

    private LocalDate dateEmbauche;

    private String statut;

    private String nomBanque;
    private String rib;
    private String cnss;

    @NotNull
    private Role role;

    private Long managerId;
}
