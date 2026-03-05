# Bitespeed - Identity Reconciliation Backend

A production-grade backend service for identifying and reconciling customer identities across multiple purchases using email and phone number information.

## ÌæØ Overview

Bitespeed helps e-commerce platforms like FluxKart.com identify and link different orders made by the same customer using different contact information. This service implements sophisticated identity matching and consolidation logic to provide a seamless customer experience.

## Ì≥ã Features

- **Identity Matching**: Links contacts based on shared email or phone numbers
- **Primary/Secondary Management**: Automatically designates the oldest contact as primary
- **Automatic Merging**: Intelligently merges multiple primary contacts
- **Consolidated Responses**: Returns complete identity information including all linked contacts
- **RESTful API**: Clean, intuitive `/identify` endpoint
- **Production-Ready**: Built with TypeScript, Express.js, and PostgreSQL
- **Comprehensive Validation**: Input validation using Joi schema
- **Security**: Helmet.js for HTTP security headers, CORS support
- **Type Safety**: Full TypeScript implementation with strict type checking

## Ìª†Ô∏è Tech Stack

- **Runtime**: Node.js (v18+)
- **Language**: TypeScript 5.3
- **Framework**: Express.js 4.18
- **Database**: PostgreSQL
- **Validation**: Joi 17.11
- **Security**: Helmet.js 7.1, CORS
- **Logging**: Winston 3.11
- **Testing**: Jest 29.7
- **Build**: TypeScript Compiler (tsc)

## Ì≥¶ Installation

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database
- npm or yarn package manager

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/bitespeed-identity-reconciliation.git
   cd bitespeed-identity-reconciliation
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your database credentials:
   ```env
   NODE_ENV=development
   PORT=3000
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=bitespeed_db
   LOG_LEVEL=info
   ```

4. **Initialize the database**
   ```bash
   npm run migrate
   ```
   
   This creates the `contact` table with proper indexes and constraints.

5. **Start the server**
   ```bash
   # Development (with hot reload)
   npm run dev
   
   # Production
   npm run build
   npm start
   ```

The server will start on `http://localhost:3000`

## Ì∫Ä API Documentation

### Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-03-05T12:00:00.000Z"
}
```

### Identify Endpoint
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

**Note**: At least one of `email` or `phoneNumber` must be provided.

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

## Ì≥ä Database Schema

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

### Indexes
- `idx_contact_email`: On email field (where deletedAt IS NULL)
- `idx_contact_phone`: On phoneNumber field (where deletedAt IS NULL)
- `idx_contact_linked_id`: On linkedId field

## Ì¥Ñ Business Logic

### Case 1: New Contact
When an incoming request has no matching email or phone number in the database:
- A new `primary` contact is created
- Response includes only this contact with empty `secondaryContactIds`

### Case 2: Existing Contact
When request matches existing contact(s) but provides new information:
- A new `secondary` contact is created
- Linked to the oldest (primary) contact
- All linked contacts are returned

### Case 3: Multiple Primary Contacts
When request matches two or more independent primary contacts:
- The newest primary is converted to secondary
- All its secondary contacts are re-linked to the oldest primary
- All contacts in the consolidated group are returned

## Ì≥ù Example Scenarios

### Scenario 1: Single Purchase
```json
Request:
{
  "email": "lorraine@example.com",
  "phoneNumber": "123456"
}

Response:
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@example.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

### Scenario 2: Same Customer, Different Email
```json
Existing: id=1, email=lorraine@example.com, phone=123456 (primary)

Request:
{
  "email": "mcfly@example.com",
  "phoneNumber": "123456"
}

Creates: id=23, email=mcfly@example.com, phone=123456 (secondary ‚Üí linkedId=1)

Response:
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@example.com", "mcfly@example.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

### Scenario 3: Merging Primary Contacts
```json
Existing:
- id=11, email=george@example.com, phone=919191 (primary, created 2023-04-11)
- id=27, email=biffsucks@example.com, phone=717171 (primary, created 2023-04-21)

Request:
{
  "email": "george@example.com",
  "phoneNumber": "717171"
}

Result:
- id=11 remains primary
- id=27 becomes secondary (linkedId=11, updated)
- New contact created for any missing data
- All linked contacts returned under primary=11
```

## Ì∑™ Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/services/contactService.test.ts

# Run with coverage
npm test -- --coverage
```

## ÌøóÔ∏è Project Structure

```
bitespeed-identity-reconciliation/
‚îú‚îÄ‚îÄ src/
‚îÇ   ‚îú‚îÄ‚îÄ database/
‚îÇ   ‚îÇ   ‚îú‚îÄ‚îÄ connection.ts      # PostgreSQL connection pool
‚îÇ   ‚îÇ   ‚îî‚îÄ‚îÄ migrations.ts      # Database initialization
‚îÇ   ‚îú‚îÄ‚îÄ middleware/
‚îÇ   ‚îÇ   ‚îî‚îÄ‚îÄ validation.ts      # Request validation middleware
‚îÇ   ‚îú‚îÄ‚îÄ routes/
‚îÇ   ‚îÇ   ‚îî‚îÄ‚îÄ identify.ts        # Identify endpoint routes
‚îÇ   ‚îú‚îÄ‚îÄ services/
‚îÇ   ‚îÇ   ‚îî‚îÄ‚îÄ contactService.ts  # Core business logic
‚îÇ   ‚îú‚îÄ‚îÄ types/
‚îÇ   ‚îÇ   ‚îî‚îÄ‚îÄ contact.ts         # TypeScript interfaces
‚îÇ   ‚îî‚îÄ‚îÄ index.ts               # Express app entry point
‚îú‚îÄ‚îÄ dist/                      # Compiled JavaScript
‚îú‚îÄ‚îÄ .env.example               # Environment variables template
‚îú‚îÄ‚îÄ tsconfig.json              # TypeScript configuration
‚îú‚îÄ‚îÄ package.json               # Project dependencies
‚îî‚îÄ‚îÄ README.md                  # This file
```

## Ì¥í Security Features

- **Helmet.js**: Secures HTTP headers against common vulnerabilities
- **CORS**: Configured for safe cross-origin requests
- **Input Validation**: Joi schema validation on all requests
- **SQL Injection Prevention**: Parameterized queries using pg library
- **Type Safety**: TypeScript strict mode prevents type-related bugs
- **Error Handling**: Proper error messages without exposing internal details

## Ì≥à Performance Optimizations

- **Database Indexes**: Fast lookups on email and phone fields
- **Connection Pooling**: Efficient PostgreSQL connection management
- **Minimal Queries**: Optimized database queries with proper filtering
- **Query Caching**: Reuse of prepared statements through pg
- **Soft Deletes**: Support for deletedAt field without data loss

## Ì∫¢ Deployment

### Using Render.com (Free Tier)

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Bitespeed identity reconciliation"
   git push origin main
   ```

2. **Create Render PostgreSQL database**
   - Go to https://render.com
   - Create new PostgreSQL database
   - Note the database URL

3. **Create Render Web Service**
   - Connect GitHub repository
   - Set environment variables from .env
   - Set build command: `npm install && npm run build`
   - Set start command: `npm start`
   - Deploy!

4. **Initialize database on Render**
   - In Render shell: `npm run migrate`

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
docker build -t bitespeed-api .
docker run -p 3000:3000 --env-file .env bitespeed-api
```

## Ì∞õ Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Ensure PostgreSQL is running and credentials in `.env` are correct.

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution**: Change PORT in `.env` or kill process using port 3000.

### Migration Fails
```
Error: relation "contact" already exists
```
**Solution**: Safe to ignore if table exists. The migration has idempotent `CREATE TABLE IF NOT EXISTS`.

## Ì≥ö API Testing

### Using cURL

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test identify endpoint
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","phoneNumber":"9876543210"}'
```

### Using Postman

1. Import the API endpoint: `POST http://localhost:3000/identify`
2. Set Content-Type header to `application/json`
3. Test with sample JSON bodies

### Using VS Code REST Client

Create `test.http`:
```http
@baseUrl = http://localhost:3000

### Health Check
GET {{baseUrl}}/health

### Identify Request
POST {{baseUrl}}/identify
Content-Type: application/json

{
  "email": "user@example.com",
  "phoneNumber": "9876543210"
}
```

## Ì¥ù Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## Ì≥Ñ License

This project is licensed under the MIT License - see LICENSE file for details.

## Ì±®‚ÄçÌ≤ª Author

**Naveen G Patil**
- Email: naveengpatil26@gmail.com
- LinkedIn: linkedin.com/in/naveengpatil
- GitHub: github.com/naveengpatil

## Ìπè Acknowledgments

- Bitespeed for the challenge
- FluxKart.com for the use case
- Express.js community for excellent framework
- PostgreSQL for reliable database

---

**Live Demo**: [Add your Render.com URL here]

**Repository**: [Add your GitHub URL here]

For questions or support, please reach out via email or LinkedIn.
