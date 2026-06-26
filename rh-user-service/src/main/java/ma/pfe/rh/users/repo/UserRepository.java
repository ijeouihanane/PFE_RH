package ma.pfe.rh.users.repo;

import ma.pfe.rh.users.domain.Role;
import ma.pfe.rh.users.domain.TypeContrat;
import ma.pfe.rh.users.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    @Query("""
            SELECT u FROM User u
            WHERE u.actif = true
              AND (:departement IS NULL OR u.departement = :departement)
              AND (:poste IS NULL OR u.poste = :poste)
              AND (:typeContrat IS NULL OR u.typeContrat = :typeContrat)
              AND (:statut IS NULL OR u.statut = :statut)
            ORDER BY u.nom, u.prenom
            """)
    List<User> searchActive(
            @Param("departement") String departement,
            @Param("poste") String poste,
            @Param("typeContrat") TypeContrat typeContrat,
            @Param("statut") String statut
    );

    List<User> findByActifTrueAndManagerId(Long managerId);

    @Query("""
            SELECT u FROM User u
            WHERE u.actif = true
              AND u.password IS NULL
              AND u.role IN :roles
            ORDER BY u.createdAt DESC
            """)
    List<User> findPendingAccount(@Param("roles") List<Role> roles);

    @Query("""
            SELECT u FROM User u
            WHERE u.actif = true
              AND u.password IS NOT NULL
              AND u.role IN :roles
            ORDER BY u.nom, u.prenom
            """)
    List<User> findActiveAccounts(@Param("roles") List<Role> roles);

    List<User> findByActifFalseOrderByUpdatedAtDesc();

    List<User> findAllByOrderByCreatedAtDesc();
}
