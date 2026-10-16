# Library Management System

A web based library catalogue and circulation app built with React, Express, and MongoDB. Students can browse the catalogue, search and filter books, manage favourites, request books, and submit return requests. Library administrators can manage the catalogue, review borrowing and return requests, review book contributions, add students, and look up student accounts.

## Features

- Browse books and filter/search by title, author, description, or department.
- Student registration and sign-in, with a personal shelf for favourites, borrow requests, borrowed books, and return requests.
- Admin sign-in and dashboard for borrow/return request review, student lookup, account creation, and catalogue management.
- Student book contribution submissions with optional cover images; admins can approve or reject them.
- Session authentication using signed JWTs in HTTP-only cookies.
- Automatic expiry of borrow requests that remain pending for 24 hours.
- MongoDB Atlas Search autocomplete when configured, with a regular MongoDB title-search fallback.

## Tech stack

- **Frontend:** React 18, React Router, Axios, Fuse.js
- **Backend:** Node.js, Express, Mongoose, MongoDB
- **Authentication and uploads:** JSON Web Tokens, bcrypt, Multer

## Requirements

- Node.js and npm
- MongoDB running locally or a MongoDB Atlas connection string

## Setup

1. Extract the project ZIP and open a terminal in the `Library Management System` project directory.
2. Install the frontend and backend dependencies:

   ```bash
   npm run install:all
   ```

3. Create `server/.env` with the settings below. Use a long, random value for `SECRET_KEY` and keep this file private.

   ```dotenv
   MONGODB_URI=mongodb://127.0.0.1:27017
   MONGODB_DATABASE=Library_Management
   SECRET_KEY=replace-with-a-long-random-secret
   PORT=4000
   # Optional: comma-separated frontend origins when the frontend is hosted elsewhere
   CLIENT_ORIGIN=http://localhost:3000
   # Set true when frontend and API are on different sites and HTTPS is enabled
   CROSS_SITE_COOKIES=false
   ```

   `MONGODB_URI` may instead be a MongoDB Atlas URI. If the URI contains special characters in its password, URL-encode them.

4. Start MongoDB and seed sample catalogue data plus initial accounts if desired:

   ```bash
   npm run seed
   ```

   The seed script inserts sample books only when the Books collection is empty. It also creates initial student/admin accounts when those email addresses do not already exist. The seed script prints the account credentials in the terminal; change those passwords before using a shared or deployed environment. Do not publish seeded credentials.

## Run locally

Start the backend and frontend in separate terminals from the project directory:

```bash
npm run server
```

```bash
npm start
```

The React development server is normally available at `http://localhost:3000`; the API listens at `http://localhost:4000`. Check `http://localhost:4000/api/health` for backend/database status.

For a production-style local run, build the React app and have Express serve it:

```bash
npm run serve
```

The backend serves the `build` directory when it exists. Set `REACT_APP_API_URL` at frontend build time if the API is hosted at a different origin, for example:

```bash
REACT_APP_API_URL=https://api.example.com npm run build
```

When frontend and API are on different sites, configure `CLIENT_ORIGIN` and `CROSS_SITE_COOKIES=true`, and use HTTPS so secure cookies can be sent.

## Useful commands

| Command | Description |
| --- | --- |
| `npm run install:all` | Install frontend and backend dependencies |
| `npm start` | Start the React development server |
| `npm run server` | Start the Express API |
| `npm run seed` | Add sample books and initial accounts to MongoDB |
| `npm run build` | Create an optimized frontend build in `build/` |
| `npm run serve` | Build frontend, then start Express to serve it and the API |

## Project layout

```text
.
├── public/                 # Static frontend assets
├── src/                    # React app, pages, and admin screens
├── server/
│   ├── app.js               # Express app and API routes
│   ├── db/                  # MongoDB connection
│   ├── middleware/          # Authentication and upload middleware
│   ├── model/               # Mongoose models
│   ├── router/              # Authentication and circulation routes
│   ├── uploads/             # Uploaded book cover images
│   └── seed.js              # Sample data and initial accounts
├── package.json             # Frontend scripts and dependencies
└── server/package.json      # Backend scripts and dependencies
```

## Configuration reference

| Variable | Purpose | Default |
| --- | --- | --- |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017` |
| `MONGODB_DATABASE` | Database name | `Library_Management` |
| `SECRET_KEY` | Signs authentication tokens; required | None |
| `PORT` | Express listening port | `4000` |
| `CLIENT_ORIGIN` | Additional allowed frontend origin(s), comma-separated | None |
| `CROSS_SITE_COOKIES` | Enables secure cross-site auth cookies when set to `true` | `false` |
| `REACT_APP_API_URL` | Frontend API origin override; set during frontend build | Local browser host on port `4000` in development; same origin in production |

## Notes

- Student and admin endpoints use different authentication cookies and roles.
- Book cover uploads are stored under `server/uploads/` and are served from `/uploads`.
- The backend creates database indexes through the Mongoose models. The `/api/search` endpoint uses Atlas Search if a `default` autocomplete index is available on the Books collection; otherwise it falls back to a basic title match.
- The backend package does not define an automated test suite.
