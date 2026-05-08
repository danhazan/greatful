# Grateful 💜 - Social Gratitude Platform

A modern social platform for sharing daily gratitudes and building positive connections through emoji reactions, sharing, and community engagement.

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+

### Backend Setup (FastAPI)

1. **Navigate to backend directory:**
   ```bash
   cd apps/api
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up database:**
   ```bash
   # Create PostgreSQL database
   createdb grateful
   
   # Run migrations
   alembic upgrade head
   ```

5. **Start backend server:**
   ```bash
   uvicorn main:app --reload
   ```
   Backend will run on http://localhost:8000

### Frontend Setup (Next.js)

1. **Navigate to frontend directory:**
   ```bash
   cd apps/web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```
   Frontend will run on http://localhost:3000

### Local Database Connection

*   **Host:** `localhost`
*   **Port:** `5432`
*   **Username:** `postgres`
*   **Password:** `iamgreatful`
*   **Database Name:** `grateful`

## 🎉 Getting Started

Visit http://localhost:3000 to start using the Grateful app!


## 🏛️ Architectural Invariants

### Post Data Hydration Model (SSR → CSR)
To ensure optimal SEO while supporting personalized authenticated state, the platform follows a strict hydration invariant:
- **SSR (Server-Side Rendering)**: Performed anonymously (guest-scoped). It generates a `bootstrapPost` (placeholder) for fast first paint and search engine indexing. It **never** contains user-specific data like `currentUserReaction`.
- **CSR (Client-Side Rendering)**: Immediately upon hydration, the frontend performs an authoritative, authenticated fetch via `apiClient`. This fetch **completely replaces** the bootstrap state.
- **AUTHORITATIVE RULE**: Authenticated CSR data is the sole source of truth. SSR data is a visual placeholder only.
- **RACE CONDITION GUARD**: Components must skip the bootstrap state and perform an authenticated fetch if a user is logged in, ensuring private or personalized data is never blocked by stale anonymous SSR cache.

### Canonical Normalization Invariant
- **ONE PIPELINE**: ALL post-shaped payloads MUST pass through `normalizePostFromApi` in `apps/web/src/utils/normalizePost.ts`.
- **IMMUTABILITY**: Normalization must be non-mutating. Direct modification of API response objects is prohibited.
- **CONSISTENCY**: This ensures absolute URLs, ID string coercion, and privacy default rules are applied identically across Feed, Profile, and Single Post views.

### Authentication Architecture
- **Anonymous SSR**: Uses `fetchPublicPost` with aggressive revalidation (60s).
- **Authenticated CSR**: Uses `apiClient` with Bearer tokens and `skipCache: true` during hydration to ensure fresh personalized state.
- **Optional Auth**: Backend endpoints use `get_optional_user_id` to provide a unified contract for both guests and logged-in users.

### Technical Features
- **Backend**: FastAPI with async SQLAlchemy, comprehensive testing
- **Frontend**: Next.js with TypeScript, Tailwind CSS, responsive design
- **Database**: PostgreSQL with proper constraints and indexes
- **Testing**: Unit and integration tests for both frontend and backend
- **Purple Theme**: Consistent purple heart emoji (💜) branding

## 🧪 Testing

### Backend Tests
```bash
cd apps/api
source venv/bin/activate
pytest
```

### Frontend Tests
```bash
cd apps/web
npm test
```

## 🤝 Contributing

This project follows the MVP-focused development approach with testable, incremental features. Each task builds upon the previous stable foundation.

## 📄 License

MIT License - see LICENSE file for details.