package ma.pfe.rh.users.dto;

import lombok.Data;
import ma.pfe.rh.users.domain.Role;
import ma.pfe.rh.users.domain.TypeContrat;

import java.time.LocalDate;

@Data
public class EmployeeUpdateRequest {

    private String nom;
    private String prenom;
    private String cin;
    private String telephone;
    private LocalDate dateNaissance;
    private String etatCivil;
    private String adresse;
    private String ville;
    private String nationalite;
    private String matricule;
    private TypeContrat typeContrat;
    private String poste;
    private String departement;
    private LocalDate dateEmbauche;
    private String statut;
    private String nomBanque;
    private String rib;
    private String cnss;
    private Role role;
    private Long managerId;
}
