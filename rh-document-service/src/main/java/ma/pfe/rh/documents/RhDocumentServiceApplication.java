package ma.pfe.rh.documents;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class RhDocumentServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(RhDocumentServiceApplication.class, args);
    }
}
