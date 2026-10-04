# BlogSphere 3.0 — Full-Stack Publishing Platform

A polished full-stack blogging platform built with Node.js, Express, MongoDB/Mongoose and a modern vanilla-JS editorial UI.

## Included
- Authentication with secure session cookies and bcrypt
- Author profiles with follower/following system
- Create, edit, publish and save drafts
- Rich-text editor with image uploads
- Cover images and inline images
- Categories and up to five tags per article
- Search, latest, popular and most-discussed feeds
- Featured stories and trending discovery sections
- Likes, bookmarks and nested comments
- Author dashboard with publishing/engagement statistics
- Public author profiles
- Light/dark theme
- Responsive mobile-first layout
- Security middleware: Helmet, rate limiting, same-origin checks, HTML sanitization
- MongoDB session storage for production deployments
- Docker + GitHub Actions configuration

## Setup

1. Copy `.env.example` to `.env`.
2. Set a valid MongoDB URI and a strong `SESSION_SECRET`.
3. Optionally set `ADMIN_EMAILS`.
4. Install packages:
   `npm install`
5. Start development:
   `npm run dev`
6. Open `http://localhost:5000`.

## Important
The project package contains only environment templates. Do not put real database credentials or session secrets in Git.
