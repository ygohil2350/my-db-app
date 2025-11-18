# 🏗️ DB Architect - Full Stack Database Builder

**DB Architect** is a visual database management tool that allows users to design schemas, manage data, and visualize SQL joins instantly. It runs on a modern full-stack architecture using **React (Vite)**, **FastAPI (Python)**, and **PostgreSQL**, fully orchestrated with **Docker Compose**.

## Preview App

![Frontend Preview](https://drive.google.com/file/d/1NxnDkWkqn1IJWuNKk1hz5L6PvJ-sk8QD/view?usp=drive_link)
![Backend Preview](https://drive.google.com/file/d/1l-hEVjsMjVTNoL0woo_p8yKTNeCoxtpG/view?usp=drive_link)

## 🚀 Features

### 🎨 **Visual Schema Design**

- **Create Tables:** Define table names and primary keys via UI.
- **Add Columns:** Support for specialized data types with dynamic inputs:
  - `INTEGER` (Number input)
  - `VARCHAR` (Text input)
  - `BOOLEAN` (Select Dropdown)
  - `DATE` (Native Date Picker)
  - `JSONB` (Multiline JSON Editor)
- **Foreign Keys:** Visually link tables to define relationships.
- **Primary Keys:** Auto-incrementing Serial PK support.

### 💾 **Data Management**

- **CRUD Operations:** Insert and Update rows via a dynamic modal.
- **Smart Validation:**
  - **Date Handling:** Automatically converts `DD/MM/YYYY` inputs to Postgres-compatible `YYYY-MM-DD`.
  - **JSON Handling:** Automatically serializes Python dictionaries/lists into valid SQL JSON format (double quotes).

### 🔗 **Query Builder**

- **Visual Joins:** Select two tables and join keys to see results instantly.
- **SQL Logger:** Real-time sidebar log showing the exact raw SQL queries being executed (`CREATE`, `ALTER`, `INSERT`, `JOIN`).

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite 6, Material UI (MUI).
- **Backend:** Python 3.9+, FastAPI, SQLAlchemy, Pydantic.
- **Database:** PostgreSQL 15.
- **Containerization:** Docker & Docker Compose.

---

## 📂 Project Structure

```text
my-db-app/
├── docker-compose.yml       # Orchestrates DB, Backend, and Frontend
├── backend/
│   ├── Dockerfile           # Python environment (includes psycopg2-binary)
│   ├── main.py              # FastAPI endpoints, SQL generation & Formatting logic
│   └── requirements.txt     # Python dependencies
└── frontend/
    ├── Dockerfile           # Node.js 22 environment (Required for Vite 6+)
    ├── vite.config.ts       # Vite server config (Host enabled)
    └── src/
        ├── App.tsx          # Main UI Component & State Logic
        └── hooks/
            └── useApi.ts    # Custom Hook for API calls
```

---

## ⚡ Quick Start (Docker)

The easiest way to run the app is using Docker Compose. This spins up the database, API, and frontend simultaneously in an isolated environment.

**Prerequisites:**

- Docker Desktop installed.

**Steps:**

1. **Clone/Download** the repository.
2. Open your terminal in the root folder (`my-db-app`).
3. Run the build command:
   ```bash
   docker compose up --build
   ```
4. **Access the App:**
   - **Frontend:** [http://localhost:5173](http://localhost:5173)
   - **Backend Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

_Note: Both Frontend and Backend are configured with Docker volumes, so changes to your code will hot-reload instantly._

---

## 🔧 Manual Setup (Local Development)

If you prefer running services individually on your machine without Docker Compose:

### 1. Start the Database

You need a Postgres instance running. You can use Docker for just the DB:

```bash
docker run --name builder_db -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=builder_db -p 5432:5432 -d postgres:15
```

### 2. Start the Backend

```bash
cd backend
# Install dependencies
pip install -r requirements.txt

# Run Server (Override DB URL to localhost)
DATABASE_URL="postgresql://user:password@localhost:5432/builder_db" uvicorn main:app --reload
```

### 3. Start the Frontend

**Note:** Requires Node.js 22+ (for Vite 6).

```bash
cd frontend
pnpm install
pnpm run dev
```

## 📝 License

This project is open source and available for educational purposes.
