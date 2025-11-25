# Server Setup and Launch Guide

This guide provides instructions on how to set up and run the backend server for the Keep application.

## Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v14 or higher recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)
- [MongoDB](https://www.mongodb.com/) (or a MongoDB Atlas connection string)

## Installation

1.  **Navigate to the server directory:**

    ```bash
    cd server
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

## Configuration

1.  **Environment Variables:**

    The application requires specific environment variables to function correctly.
    
    Create a `.env` file in the root of the `server` directory by copying the example file:

    ```bash
    cp .env.example .env
    ```

2.  **Update `.env`:**

    Open the `.env` file and update the values with your specific configuration:

    *   `PORT`: The port on which the server will run (default: `5001`).
    *   `MONGODB_URI`: Your MongoDB connection string.
    *   `JWT_SECRET`: A secret key used for signing JSON Web Tokens.

    **Example `.env`:**
    ```env
    PORT=5001
    MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/?appName=MyApp"
    JWT_SECRET="super_secret_key"
    ```

## Running the Server

### Development Mode

To run the server in development mode with hot-reloading (using `nodemon`):

```bash
npm run dev
```

The server will start, and you should see logs indicating it is running (e.g., `Server running on port 5001`).

### Production Mode

To run the server in a production-like environment (using `ts-node` directly):

```bash
npm start
```

## Project Structure

*   `src/server.ts`: Entry point of the application.
*   `src/routes/`: API route definitions.
*   `src/middleware/`: Express middleware (e.g., authentication).
*   `src/models/`: Mongoose data models.

## API Endpoints

(Add documentation for your specific API endpoints here as you build them)
