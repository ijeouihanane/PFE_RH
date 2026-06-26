package ma.pfe.rh.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class RhGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(RhGatewayApplication.class, args);
    }
}
