package ma.pfe.rh.chat.dto;

public record AttachmentResponse(
        Long id,
        String fileName,
        String fileType,
        Long fileSize,
        String downloadUrl
) {
}
