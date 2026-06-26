package ma.pfe.rh.users.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class ProfileSelfUpdateRequest {

    private String nom;
    private String prenom;
    private String cin;
    private String telephone;
    private LocalDate dateNaissance;
    private String etatCivil;
    private String adresse;
    private String ville;
    private String nationalite;
    private String nomBanque;
    private String rib;
    private String cnss;
}
