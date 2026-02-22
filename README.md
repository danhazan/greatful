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