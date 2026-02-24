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

The service is deployed and accessible at:
`https://identity-reconciliation-10fab38034a3.herokuapp.com/identify`

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

## Deploying to Heroku

Heroku has an ephemeral filesystem, which means the local SQLite database (`dev.db`) will be wiped out every time the server restarts. To deploy to Heroku, you **must** switch to a persistent database like PostgreSQL.

### Step 1: Update Prisma Schema for PostgreSQL
In `prisma/schema.prisma`, change the `datasource` block to use PostgreSQL:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Step 2: Commit and Push
Commit this change and push it to your GitHub repository:
```bash
git add .
git commit -m "Switch to PostgreSQL for Heroku deployment"
git push origin main
```

### Step 3: Create Heroku App & Add Database
1. Go to your [Heroku Dashboard](https://dashboard.heroku.com/) and create a new app.
2. Go to the **Resources** tab of your new app.
3. In the Add-ons search bar, type **Heroku Postgres** and provision the free/hobby tier. This will automatically add a `DATABASE_URL` environment variable to your app.

### Step 4: Deploy
1. Go to the **Deploy** tab in Heroku.
2. Choose **GitHub** as the deployment method and connect your repository (`AdithyaSM31/Identity-Reconciliation`).
3. Click **Deploy Branch** (make sure it's the `main` branch).

*Note: The project includes a `Procfile` with a `release` phase that will automatically run `npx prisma db push` to set up your database schema on Heroku before the app starts.*
