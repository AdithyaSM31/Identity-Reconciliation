# Bitespeed Backend Task: Identity Reconciliation

This is a Node.js and TypeScript web service that exposes an `/identify` endpoint to consolidate customer contact information across multiple purchases.

## Tech Stack
- Node.js
- TypeScript
- Express
- Prisma ORM
- SQLite

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up the database:
   ```bash
   npx prisma db push
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Start the server:
   ```bash
   npm start
   ```
   Alternatively, you can run it in development mode:
   ```bash
   npm run dev
   ```

## API Endpoint

### `POST /identify`

**Request Body:**
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

**Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```
