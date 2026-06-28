# RH Platform

Plateforme RH en architecture microservices avec un backend Spring Boot, une passerelle API, un service de decouverte Eureka, un frontend Angular et un service IA FastAPI.

## Prerequis

- JDK 21
- Apache Maven 3.9.x
- Node.js 22.x
- npm 10.x
- Python 3.11
- Apache Kafka accessible sur `localhost:9092`

## Versions utilisees

### Backend

- Java : 21
- Spring Boot : 3.5.3
- Spring Cloud : 2025.0.2
- Maven : 3.9.15
- JJWT : 0.12.6

### Frontend

- Node.js : 22.22.2
- npm : 10.9.7
- Angular Core : 17.3.12
- Angular CLI : 17.3.17
- TypeScript : 5.4.5
- RxJS : 7.8.2
- Chart.js : 4.4.6
- Quill : 1.3.7
- ngx-quill : 24.0.5
- lucide-angular : 1.18.0

### Service IA

- Python : 3.11.9
- FastAPI : 0.111.0
- Uvicorn : 0.30.1
- LangChain : 0.2.6
- ChromaDB : 0.5.3
- sentence-transformers : 3.0.1
- Groq : 0.15.0

## Structure du projet

```text
rh-platform/
  rh-discovery/              Service Eureka
  rh-gateway/                API Gateway
  rh-user-service/           Gestion des utilisateurs, authentification et evaluations
  rh-leave-service/          Gestion des conges
  rh-document-service/       Gestion des documents et contrats
  rh-timesheet-service/      Gestion des feuilles de temps et projets
  rh-payroll-service/        Gestion de la paie et des notes de frais
  rh-notification-service/   Notifications
  rh-chat-service/           Messagerie temps reel
  rh-frontend/               Application Angular
  rh-platformAI/rh-ai-service/ Service IA FastAPI
```

## Ports

| Composant | Port |
| --- | ---: |
| Discovery / Eureka | 8761 |
| User service | 8081 |
| Leave service | 8082 |
| Document service | 8083 |
| Timesheet service | 8084 |
| Payroll service | 8085 |
| Notification service | 8086 |
| Chat service | 8087 |
| Gateway | 8090 |
| Frontend Angular | 4200 |
| Service IA | 8000 |

## Installation frontend

Depuis le dossier `rh-frontend` :

```bash
npm install
```

## Installation du service IA

Depuis le dossier `rh-platformAI/rh-ai-service` :

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## Lancement du projet

Lancer d'abord Kafka, puis lancer les services dans cet ordre.

### 1. Discovery

```bash
cd rh-discovery
mvn spring-boot:run
```

### 2. Microservices backend

Ouvrir un terminal par service :

```bash
cd rh-user-service
mvn spring-boot:run
```

```bash
cd rh-leave-service
mvn spring-boot:run
```

```bash
cd rh-document-service
mvn spring-boot:run
```

```bash
cd rh-timesheet-service
mvn spring-boot:run
```

```bash
cd rh-payroll-service
mvn spring-boot:run
```

```bash
cd rh-notification-service
mvn spring-boot:run
```

```bash
cd rh-chat-service
mvn spring-boot:run
```

### 3. Gateway

```bash
cd rh-gateway
mvn spring-boot:run
```

### 4. Frontend

```bash
cd rh-frontend
npm start
```

L'application frontend est disponible sur :

```text
http://localhost:4200
```

L'API Gateway est disponible sur :

```text
http://localhost:8090
```

### 5. Service IA

Depuis le dossier `rh-platformAI/rh-ai-service` :

```bash
venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

## Tests

Pour tester un service Spring Boot :

```bash
mvn test
```

Pour tester le frontend :

```bash
cd rh-frontend
npm test
```

## Remarques

- Chaque service Spring Boot se lance independamment avec Maven.
- Le Gateway expose les routes principales vers les microservices.
- Eureka permet l'enregistrement et la decouverte des services.
- Le frontend communique principalement avec le Gateway.
