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

## 🎉 Demo

Visit http://localhost:3000/demo to test the emoji reaction system without authentication!

## ✨ Features Implemented

### Emoji Reaction System ✅
- 8 positive emoji reactions: 😍 🔥 🙏 💪 👏 😂 🤔 ⭐
- One reaction per user per post (can change)
- Reaction viewer showing all users and their reactions
- Keyboard shortcuts (1-8 keys) for quick reactions
- Visual hierarchy based on post types (Daily 3x, Photo 2x, Spontaneous compact)
- Real-time updates without page refresh

### Heart Counter System ✅
- Heart/like functionality with real-time updates
- Server-authoritative data ensures accuracy
- Immediate UI feedback without page refresh
- Comprehensive test coverage

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

## 📁 Project Structure

```
apps/
├── api/                    # FastAPI backend
│   ├── app/
│   │   ├── models/         # SQLAlchemy models
│   │   ├── services/       # Business logic
│   │   ├── api/v1/         # API endpoints
│   │   └── core/           # Database and security
│   └── tests/              # Backend tests
└── web/                    # Next.js frontend
    ├── src/
    │   ├── components/     # React components
    │   ├── app/            # Next.js app router
    │   └── tests/          # Frontend tests
    └── package.json

alembic/                    # Database migrations
```

## 🎯 Current Status

✅ **TASK 1 Complete: Emoji Reaction System Foundation**
- Database models and migrations
- Backend API endpoints with authentication
- Frontend components (EmojiPicker, ReactionViewer, PostCard)
- Comprehensive testing suite
- Demo page for testing

✅ **Heart Counter Real-time Updates - COMPLETED**
- Real-time heart counter updates without page refresh
- Server-authoritative data ensures accuracy
- Comprehensive test coverage (6/6 tests passing)
- Same real-time approach applied to reaction counters

✅ **Missing Emoji Support - COMPLETED**
- Backend now supports all 10 frontend emoji picker options
- Added 'joy' (😂) and 'thinking' (🤔) emojis
- 16/16 emoji reaction tests passing

## ⚠️ Known Issues

- **Emoji Reactions 6 & 7**: Click handlers not working for emojis 6 (😂) and 7 (🤔)
- **User Profile Posts**: Profile pages show "No posts yet" despite having posts
- **CreatePostModal**: Footer alignment issues in modal
- **Backend Tests**: Profile API tests have isolation issues when run together

*For detailed issue tracking, see [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)*

## 🔜 Next Steps

- **TASK 2**: Reaction Viewer and Enhanced Interactions
- **TASK 3**: Share System with URL Generation
- **TASK 4**: Mention System with User Search
- **TASK 5**: Share System with Mention Integration
- **TASK 6**: Enhanced Notification System
- **TASK 7**: Follow System Implementation
- **TASK 8**: Enhanced Feed Algorithm

## 🤝 Contributing

This project follows the MVP-focused development approach with testable, incremental features. Each task builds upon the previous stable foundation.

## 📄 License

MIT License - see LICENSE file for details.