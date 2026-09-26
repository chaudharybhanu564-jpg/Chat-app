# ChatApp — Real-time WhatsApp-style starter

## Requirements
- Node.js 18+
- MongoDB running locally, or a MongoDB Atlas connection string

## Run
1. Open a terminal in this folder.
2. Run `npm install`
3. Copy `.env.example` to `.env` and change `JWT_SECRET` (and `MONGODB_URI` if needed).
4. Run `npm start`
5. Open `http://localhost:3000`

## Test real-time chat
Create two accounts using two browser windows (or normal + incognito), then select each other and send messages.

## Included
- Signup/login with bcrypt + JWT
- MongoDB users and message history
- Socket.IO real-time messaging
- Online/offline presence
- User search
- Responsive WhatsApp-style interface

For production, add HTTPS, stronger validation/rate limiting, secure cookies, image/file uploads, read receipts, password reset, moderation, and deployment secrets.
