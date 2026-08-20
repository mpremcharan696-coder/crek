# 🚀 Crek (Pilotly AI) — Full Stack Monorepo

Integrated AI-powered Instagram engagement automation platform.

## 📂 Project Structure

```
D:\crek\
├── backend/    # FastAPI + Async SQLAlchemy + ARQ + Qwen & Gemini AI Engine
└── frontend/   # Vite + React + Tailwind/CSS Dashboard Interface
```

## 🛠️ Quick Start

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
