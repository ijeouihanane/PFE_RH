package ma.pfe.rh.documents.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

/**
 * Réponse du service Python pour le chatbot RAG.
 * Les noms snake_case correspondent au format Python (lus via @JsonAlias),
 * et sont sérialisés en camelCase pour le frontend Angular.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiChatResponse {

    private String answer;

    @JsonAlias("doc_source")
    private String docSource;

    @JsonAlias("page_number")
    private Integer pageNumber;

    @JsonAlias("page_range")
    private String pageRange;

    @JsonAlias("confidence_score")
    private Double confidenceScore;

    private Boolean answered;

    @JsonAlias("model_used")
    private String modelUsed;
}
