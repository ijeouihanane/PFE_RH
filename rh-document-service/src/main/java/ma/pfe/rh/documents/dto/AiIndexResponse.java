package ma.pfe.rh.documents.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * Réponse du service Python après indexation d'un PDF.
 * Les noms snake_case correspondent au format Python.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiIndexResponse {

    private String status;

    @JsonProperty("nb_pages")
    private Integer nbPages;

    @JsonProperty("nb_chunks")
    private Integer nbChunks;

    private String summary;

    private String keywords;

    private String message;
}
