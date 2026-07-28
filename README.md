# School Next Pro 🎓
### Student Fee Management System

A full-stack web application for managing school student admissions, fee structures, monthly payments, and printable receipts.

---

## ✨ Features

- 🏫 Multi-school support with school code login
- 👨‍🎓 Student admission with photo upload
- 💰 Comprehensive fee structure (Admission, Annual, Activity, Tuition, Bus)
- 📅 Multi-month payment processing
- 📊 Fee dashboard with due tracking
- 🧾 Printable + PDF fee receipts
- 🔒 SHA-256 password hashing
- ☁️ Neon PostgreSQL cloud database
- 🎨 5 dynamic UI themes with particle animations
- 📱 Responsive design

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, Vanilla CSS, Vanilla JavaScript |
| Backend | Node.js + Express.js |
| Database | Neon PostgreSQL (cloud) |
| Hosting | Vercel |

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js 18+
- A [Neon](https://neon.tech) PostgreSQL database

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/school-project.git
cd school-project

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and add your DATABASE_URL from Neon dashboard

# 4. Start the development server
npm run dev
# OR for production:
npm start
```

Open **http://localhost:5000** in your browser.

The server auto-creates all required database tables on first run.

---

## ⚙️ Environment Variables

Create a `.env` file (never commit it):

```env
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
ALLOWED_ORIGINS=http://localhost:5000,https://your-app.vercel.app
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | Your Neon PostgreSQL connection string |
| `PORT` | No | Server port (default: 5000) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS allowed origins |

---

## ☁️ Deploying to Vercel

### Step 1 — Push to GitHub
```bash
git add .
git commit -m "Production-ready: security hardening & Vercel config"
git push origin main
```

### Step 2 — Import on Vercel
1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repository
3. Vercel will auto-detect `vercel.json` — no framework settings needed

### Step 3 — Add Environment Variables on Vercel
In your Vercel project → **Settings** → **Environment Variables**, add:

| Name | Value |
|------|-------|
| `DATABASE_URL` | Your Neon connection string |
| `ALLOWED_ORIGINS` | `https://your-app-name.vercel.app` |

### Step 4 — Deploy
Click **Deploy**. Your app will be live at `https://your-app-name.vercel.app`.

> **Note**: After deployment, update the `canonical` URL in `index.html` and the `og:url` meta tag with your actual Vercel domain.

---

## 🗄️ Database Schema

The server automatically creates these tables on startup:

- **schools** — School accounts (code, name, email, hashed password, logo)
- **students** — Student records with fee details
- **payments** — Monthly payment history
- **fee_configurations** — Per-school fee settings

See [`schema.postgresql.sql`](./schema.postgresql.sql) for the full schema.

---

## 🔒 Security Notes

- Passwords are hashed with SHA-256 before storage
- Legacy plaintext passwords are automatically upgraded on first login
- Database credentials must only be stored in `.env` (never in source code)
- CORS is restricted to `ALLOWED_ORIGINS`
- All SQL queries use parameterized statements (no SQL injection risk)

---

## 📄 License

MIT — feel free to use and modify for your school.
