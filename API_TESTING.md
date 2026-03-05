# Bitespeed Identity Reconciliation - API Testing Guide

Complete guide for testing the `/identify` endpoint with detailed examples and expected responses.

## Quick Start

### 1. Start the Application

**Using Docker Compose (Recommended):**
```bash
docker-compose up --build
```
This starts both PostgreSQL and the API service.

**Using Node.js directly:**
```bash
npm install
npm run migrate
npm run dev
```

### 2. Test the Health Endpoint

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-03-05T12:00:00.000Z"
}
```

## API Testing Scenarios

### Test Case 1: New Customer Registration

**Scenario:** A new customer places their first order with email and phone number.

**Request:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lorraine@hillvalley.edu",
    "phoneNumber": "123456"
  }'
```

**Expected Response:**
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

**Database State After:**
- New contact created with id=1, linkPrecedence="primary"

---

### Test Case 2: Same Customer, Different Email (Phone Match)

**Scenario:** Same customer comes back with a different email but same phone number.

**Request (after Test Case 1):**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mcfly@hillvalley.edu",
    "phoneNumber": "123456"
  }'
```

**Expected Response:**
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

**Database State After:**
- New contact created with id=2, linkedId=1, linkPrecedence="secondary"
- All linked contacts are consolidated under primary contact 1

---

### Test Case 3: Only Email Match

**Request:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lorraine@hillvalley.edu",
    "phoneNumber": null
  }'
```

**Expected Response:** (Same as Test Case 2)
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

---

### Test Case 4: Only Phone Match

**Request:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": null,
    "phoneNumber": "123456"
  }'
```

**Expected Response:** (Same as Test Case 2)
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

---

### Test Case 5: Merging Two Primary Contacts

**Scenario:** Two independent customers' records are found to be the same person.

**Setup - Create two separate customers:**

Customer 1:
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "george@hillvalley.edu",
    "phoneNumber": "919191"
  }'
```
Creates: id=11, primary

Customer 2:
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "biffsucks@hillvalley.edu",
    "phoneNumber": "717171"
  }'
```
Creates: id=27, primary (created later than id=11)

**Merge Request:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "george@hillvalley.edu",
    "phoneNumber": "717171"
  }'
```

**Expected Response:**
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

**Database State After:**
- id=11 remains primary
- id=27 becomes secondary, linkedId=11 (the newer primary is converted to secondary under the older one)

---

### Test Case 6: Validation Error - No Email or Phone

**Request:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": ["\"email\" or \"phoneNumber\" must be provided"]
}
```

---

### Test Case 7: Validation Error - Invalid Email Format

**Request:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid-email",
    "phoneNumber": "123456"
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": ["\"email\" must be a valid email"]
}
```

---

### Test Case 8: Duplicate Request - No New Data

**Scenario:** Exact same request sent twice - should not create duplicate secondary.

**First Request:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "phoneNumber": "5551234567"
  }'
```

**Second Request (Identical):**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "phoneNumber": "5551234567"
  }'
```

**Expected Response (Both Requests):**
```json
{
  "contact": {
    "primaryContactId": 101,
    "emails": ["user@example.com"],
    "phoneNumbers": ["5551234567"],
    "secondaryContactIds": []
  }
}
```

**Note:** No duplicate secondary contact is created because the data already exists in the linked group.

---

## Testing with Postman

1. **Import Collection:**
   - Create a new Postman environment with variable: `{{baseUrl}}` = `http://localhost:3000`

2. **Create Requests:**
   - Method: POST
   - URL: `{{baseUrl}}/identify`
   - Headers: `Content-Type: application/json`
   - Body (raw JSON): Copy examples from above

3. **Test Results:**
   - Monitor the Tests tab to verify response status codes
   - Check response body matches expected format

## Testing with VS Code REST Client

Install the "REST Client" extension, then create `test.http`:

```http
@baseUrl = http://localhost:3000

### Test 1: New Customer
POST {{baseUrl}}/identify
Content-Type: application/json

{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "123456"
}

###

### Test 2: Same Customer, New Email
POST {{baseUrl}}/identify
Content-Type: application/json

{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}

###

### Test 3: Only Email
POST {{baseUrl}}/identify
Content-Type: application/json

{
  "email": "lorraine@hillvalley.edu"
}

###

### Test 4: Only Phone
POST {{baseUrl}}/identify
Content-Type: application/json

{
  "phoneNumber": "123456"
}

###

### Test 5: Validation Error
POST {{baseUrl}}/identify
Content-Type: application/json

{}

###
```

Click "Send Request" on each request.

## Testing with JavaScript/Node.js

```javascript
const fetch = require('node-fetch');

async function testIdentify() {
  const response = await fetch('http://localhost:3000/identify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'lorraine@hillvalley.edu',
      phoneNumber: '123456',
    }),
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
}

testIdentify();
```

## Running Automated Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test src/services/contactService.test.ts

# Run with coverage report
npm test -- --coverage

# Watch mode for development
npm test -- --watch
```

## Database Inspection

To inspect the database directly:

```bash
# If using Docker
docker-compose exec postgres psql -U postgres -d bitespeed_db

# If using local PostgreSQL
psql -U postgres -d bitespeed_db
```

Useful SQL queries:

```sql
-- View all contacts
SELECT * FROM contact ORDER BY "createdAt";

-- View primary contacts only
SELECT * FROM contact WHERE "linkPrecedence" = 'primary';

-- View contacts linked to a specific primary
SELECT * FROM contact WHERE "linkedId" = 1 OR id = 1 ORDER BY "createdAt";

-- Count total contacts
SELECT COUNT(*) FROM contact;

-- View contacts by email
SELECT * FROM contact WHERE email = 'lorraine@hillvalley.edu';

-- View contacts by phone
SELECT * FROM contact WHERE "phoneNumber" = '123456';

-- Delete all contacts (reset database)
DELETE FROM contact;
```

## Performance Testing

For load testing, use `artillery` or `k6`:

```bash
npm install -g artillery

# Create load-test.yml
cat > load-test.yml << 'EOF'
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: "Identify endpoint"
    flow:
      - post:
          url: "/identify"
          json:
            email: "test@example.com"
            phoneNumber: "1234567890"
