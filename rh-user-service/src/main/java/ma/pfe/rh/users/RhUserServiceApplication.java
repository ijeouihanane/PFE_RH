package ma.pfe.rh.users;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class RhUserServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(RhUserServiceApplication.class, args);
    }
}
