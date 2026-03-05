# Bitespeed Identity Reconciliation Backend

A production-grade backend service for identifying and reconciling customer identities across multiple purchases using email and phone number information.

## Overview

Bitespeed helps e-commerce platforms like FluxKart.com identify and link different orders made by the same customer using different contact information. This service implements sophisticated identity matching and consolidation logic to provide a seamless customer experience.

## Features

- Identity Matching: Links contacts based on shared email or phone numbers
- Primary/Secondary Management: Automatically designates the oldest contact as primary
- Automatic Merging: Intelligently merges multiple primary contacts
- Consolidated Responses: Returns complete identity information including all linked contacts
- RESTful API: Clean, intuitive /identify endpoint
- Production-Ready: Built with TypeScript, Express.js, and PostgreSQL
- Comprehensive Validation: Input validation using Joi schema
- Security: Helmet.js for HTTP security headers, CORS support
- Type Safety: Full TypeScript implementation with strict type checking

## Technology Stack

- Runtime: Node.js (v18+)
- Language: TypeScript 5.3
- Framework: Express.js 4.18
- Database: PostgreSQL 15+
- Validation: Joi 17.11
- Security: Helmet.js 7.1, CORS
- Logging: Winston 3.11
- Testing: Jest 29.7
- Build: TypeScript Compiler (tsc)

## Installation

### Prerequisites

- Node.js 18+ installed
- PostgreSQL 12+ database
- npm package manager

### Setup Steps

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/bitespeed-identity-reconciliation.git
   cd bitespeed-identity-reconciliation
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create environment variables file
   ```bash
   cp .env.example .env
   ```
   
   Edit .env with your database credentials:
   ```
   NODE_ENV=development
   PORT=3000
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=password
   DB_NAME=bitespeed_db
   LOG_LEVEL=info
   ```

4. Initialize the database
   ```bash
   npm run migrate
   ```
   
   This creates the contact table with proper indexes and constraints.

5. Start the server
   ```bash
   # Development (with hot reload)
   npm run dev
   
   # Production
   npm run build
   npm start
   ```

The server will start on http://localhost:3000

## API Documentation

### Health Check Endpoint

**Request:**
```
GET /health
```

**Response (200 OK):**
```json
{
  "status": "OK",
  "timestamp": "2026-03-05T12:00:00.000Z"
}
```

### Identify Endpoint

**Request:**
```
POST /identify
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "phoneNumber": "9876543210"
}
```

Note: At least one of email or phoneNumber must be provided.

**Response (200 OK):**
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["user@example.com", "alternate@example.com"],
    "phoneNumbers": ["9876543210", "9876543211"],
    "secondaryContactIds": [2, 3]
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": ["Either email or phoneNumber must be provided"]
}
```

## Database Schema

### Contact Table

The contact table stores customer contact information and relationships:

```sql
CREATE TABLE contact (
  id SERIAL PRIMARY KEY,
  phoneNumber VARCHAR(20),
  email VARCHAR(255),
  linkedId INTEGER,
  linkPrecedence VARCHAR(10) NOT NULL DEFAULT 'primary',
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deletedAt TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_linked_id FOREIGN KEY (linkedId) REFERENCES contact(id)
);
```

### Column Descriptions

- id: Unique identifier for the contact record
- email: Customer email address (nullable)
- phoneNumber: Customer phone number (nullable)
- linkedId: Reference to primary contact (foreign key)
- linkPrecedence: Indicates if contact is 'primary' or 'secondary'
- createdAt: Timestamp of contact creation
- updatedAt: Timestamp of last update
- deletedAt: Timestamp of deletion (soft delete support)

### Indexes

- idx_contact_email: On email field (where deletedAt IS NULL)
- idx_contact_phone: On phoneNumber field (where deletedAt IS NULL)
- idx_contact_linked_id: On linkedId field

## Business Logic

### Case 1: New Contact

When an incoming request has no matching email or phone number in the database:
- A new contact is created with linkPrecedence set to 'primary'
- This contact is treated as a new customer
- Response includes only this contact with empty secondaryContactIds array

### Case 2: Existing Contact with New Information

When a request matches an existing contact but provides new email or phone information:
- A new contact is created with linkPrecedence set to 'secondary'
- The new contact is linked to the existing primary contact via linkedId
- All linked contacts are consolidated and returned
- Primary contact information appears first in emails and phoneNumbers arrays

### Case 3: Multiple Primary Contacts

When a request matches two or more independent primary contacts:
- The oldest primary contact remains primary
- The newer primary contacts are converted to secondary
- All secondary contacts are re-linked to point to the oldest primary
- All contacts in the consolidated group are returned under the oldest primary

## Usage Examples

### Example 1: New Customer

Request:
```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "123456"
}
```

Response:
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

### Example 2: Same Customer, Different Email

Given existing contact: id=1, email=lorraine@hillvalley.edu, phone=123456 (primary)

Request:
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

Response:
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

### Example 3: Merging Two Primary Contacts

Given existing contacts:
- id=11, email=george@hillvalley.edu, phone=919191 (primary, created 2023-04-11)
- id=27, email=biffsucks@hillvalley.edu, phone=717171 (primary, created 2023-04-21)

Request:
```json
{
  "email": "george@hillvalley.edu",
  "phoneNumber": "717171"
}
```

Response:
```json
{
  "contact": {
    "primaryContactId": 11,
    "emails": ["george@hillvalley.edu", "biffsucks@hillvalley.edu"],
    "phoneNumbers": ["919191", "717171"],
    "secondaryContactIds": [27]
  }
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/services/contactService.test.ts

# Run with coverage report
npm test -- --coverage
```

### Manual API Testing

Using cURL:
```bash
# Health check
curl http://localhost:3000/health

# Identify request
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","phoneNumber":"9876543210"}'
```

Using Postman:
1. Create new POST request to http://localhost:3000/identify
2. Set Content-Type header to application/json
3. Add JSON body with email and/or phoneNumber
4. Send request and verify response

## Project Structure

```
bitespeed-identity-reconciliation/
├── src/
│   ├── database/
│   │   ├── connection.ts         PostgreSQL connection pool
│   │   └── migrations.ts         Database schema initialization
│   ├── middleware/
│   │   └── validation.ts         Request validation middleware
│   ├── routes/
│   │   ├── identify.ts           Identify endpoint handler
│   │   └── identify.test.ts      Integration tests
│   ├── services/
│   │   ├── contactService.ts     Core business logic
│   │   └── contactService.test.ts Unit tests
│   ├── types/
│   │   └── contact.ts            TypeScript interfaces
│   ├── utils/
│   │   └── logger.ts             Logger configuration
│   └── index.ts                  Express app entry point
├── dist/                         Compiled JavaScript
├── .env                          Environment configuration
├── .env.example                  Environment template
├── .gitignore                    Git ignore rules
├── tsconfig.json                 TypeScript configuration
├── jest.config.js                Test configuration
├── package.json                  Project dependencies
├── Dockerfile                    Docker image configuration
├── docker-compose.yml            Docker Compose configuration
└── README.md                     This file
```

## Security

### Implementation Details

- Helmet.js: Secures HTTP headers against common vulnerabilities
- CORS: Configured for safe cross-origin requests
- Input Validation: Joi schema validation on all requests
- SQL Injection Prevention: Parameterized queries using pg library
- Type Safety: TypeScript strict mode prevents type-related bugs
- Error Handling: Proper error messages without exposing internal details

## Performance

### Optimizations

- Database Indexes: Fast lookups on email and phoneNumber fields
- Connection Pooling: Efficient PostgreSQL connection management
- Prepared Statements: Reuse of compiled SQL queries
- Soft Deletes: Support for deletedAt field without data loss
- Optimized Queries: Minimal database calls per request

### Performance Metrics

- Email lookup: Less than 1ms with index
- Phone lookup: Less than 1ms with index
- Contact consolidation: O(m) where m is number of linked contacts
- Response time: 5-50ms typical

## Deployment

### Render.com Deployment

1. Push code to GitHub
   ```bash
   git add .
   git commit -m "feat: Initial implementation"
   git push origin main
   ```

2. Create PostgreSQL database on Render.com
   - Go to https://render.com
   - Create new PostgreSQL database
   - Note the database connection URL

3. Create Web Service on Render.com
   - Connect GitHub repository
   - Set environment variables
   - Build command: npm install && npm run build
   - Start command: npm start

4. Initialize database
   - Run: npm run migrate

### Docker Deployment

Build and run with Docker:
```bash
docker build -t bitespeed-api .
docker run -p 3000:3000 --env-file .env bitespeed-api
```

Or use Docker Compose:
```bash
docker-compose up --build
```

## Troubleshooting

### Database Connection Error

Error message: "Error: connect ECONNREFUSED 127.0.0.1:5432"

Solution: 
- Verify PostgreSQL is running
- Check database credentials in .env file
- Ensure DB_HOST, DB_PORT, DB_USER, DB_PASSWORD are correct

### Port Already in Use

Error message: "Error: listen EADDRINUSE: address already in use :::3000"

Solution:
- Change PORT in .env file to an available port
- Or kill the process using port 3000

### Database Table Does Not Exist

Error message: "Error: relation "contact" does not exist"

Solution:
- Run: npm run migrate
- Verify migration completed successfully

### Build Errors

If TypeScript compilation fails:
- Verify Node.js version: node --version (should be 18+)
- Reinstall dependencies: npm install
- Check for TypeScript errors: npm run build

## Submission Checklist

Required for submission:

1. Code published to GitHub public repository
2. Small commits with insightful messages
3. /identify endpoint exposed and working
4. Application hosted online
5. Live endpoint URL added to README
6. Submission completed via provided form

## Available Commands

Development:
```bash
npm run dev       Start development server with hot reload
npm run build     Compile TypeScript to JavaScript
npm start         Run production build
npm test          Run test suite
npm run migrate   Initialize database schema
```

Database:
```bash
psql -U postgres -d bitespeed_db     Connect to database
SELECT * FROM contact;               View all contacts
DELETE FROM contact;                 Clear all contacts
```

## Contributing

1. Fork the repository
2. Create feature branch: git checkout -b feature/name
3. Commit changes: git commit -m 'Description'
4. Push to branch: git push origin feature/name
5. Open Pull Request

## License

This project is licensed under the MIT License.

## Author

Naveen G Patil
Email: naveengpatil26@gmail.com
LinkedIn: linkedin.com/in/naveengpatil

## Live Endpoint

Hosted at: [Add your Render.com URL here after deployment]

## Repository

GitHub: [Add your GitHub URL here]

---

For complete documentation, testing guide, and deployment instructions, refer to the accompanying documentation files.
