# Chatbot

Simple MERN chatbot.

## Local setup
1. Clone repo
   git clone <repo_url>
2. Backend
   cd server
   npm install
   cp .env.example .env  # fill values
   npm run dev
3. Frontend
   cd ../client
   npm install
   cp .env.example .env.local
   npm start

## Deployment
- Backend: Deploy `server/` as a Web Service on Render (Start command: `npm start`). Add env vars in Render dashboard.
- Frontend: Deploy `client/` on Vercel. Set Root Directory to `client/`. Add env vars (REACT_APP_API_URL).
