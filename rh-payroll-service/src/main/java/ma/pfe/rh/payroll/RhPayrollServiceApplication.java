package ma.pfe.rh.payroll;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class RhPayrollServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(RhPayrollServiceApplication.class, args);
    }
}
