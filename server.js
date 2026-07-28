/**
 * School Next Pro — Backend API Server
 * Stack: Node.js + Express + Neon PostgreSQL
 *
 * Security hardening:
 *  - Credentials via env vars only (no hardcoded fallbacks)
 *  - SHA-256 password hashing (crypto — no extra deps)
 *  - CORS restricted to allowed origins via env var
 *  - Password field never returned in API responses
 *  - Parameterised queries throughout (no SQL injection risk)
 *  - Input validation on critical routes
 */

const express   = require('express');
const cors      = require('cors');
const { Pool }  = require('pg');
const crypto    = require('crypto');
require('dotenv').config();

// ─── Password hashing helper (SHA-256, no extra deps) ───────────────────────
function hashPassword(plain) {
    return crypto.createHash('sha256').update(plain).digest('hex');
}

// ─── Input sanitisation helper ───────────────────────────────────────────────
function sanitize(value, maxLen = 255) {
    if (typeof value !== 'string') return value;
    return value.trim().slice(0, maxLen);
}

// ─── App & Middleware ────────────────────────────────────────────────────────
const app = express();

// CORS — allow specific origins; falls back to localhost for dev
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5000', 'http://127.0.0.1:5000'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS policy: origin "${origin}" not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Serve frontend static files (index.html, style.css, upperP.js)
app.use(express.static(__dirname));

// ─── Neon PostgreSQL Connection Pool ────────────────────────────────────────
if (!process.env.DATABASE_URL) {
    console.error('❌ FATAL: DATABASE_URL environment variable is not set. ' +
                  'Copy .env.example to .env and fill in your Neon credentials.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,               // max pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

// ─── DB Initialisation ───────────────────────────────────────────────────────
async function initDatabase() {
    try {
        console.log('🔄 Connecting to Neon PostgreSQL and initializing tables...');

        // 1. SCHOOLS TABLE
        await pool.query(`
            CREATE TABLE IF NOT EXISTS schools (
                id          SERIAL PRIMARY KEY,
                school_code VARCHAR(50)  NOT NULL UNIQUE,
                school_name VARCHAR(255) NOT NULL,
                school_email VARCHAR(255) NOT NULL,
                owner_number VARCHAR(20)  NOT NULL,
                password    VARCHAR(255) NOT NULL,
                logo_data   TEXT         NULL,
                created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_school_code ON schools(school_code);
        `);

        // 2. STUDENTS TABLE
        await pool.query(`
            CREATE TABLE IF NOT EXISTS students (
                id               SERIAL PRIMARY KEY,
                school_code      VARCHAR(50)  NOT NULL,
                student_id       VARCHAR(50)  NOT NULL,
                name             VARCHAR(255) NOT NULL,
                father_name      VARCHAR(255) NOT NULL,
                mother_name      VARCHAR(255) NOT NULL,
                address          TEXT         NOT NULL,
                mobile           VARCHAR(20)  NOT NULL,
                class            VARCHAR(50)  NOT NULL,
                section          VARCHAR(10)  NOT NULL,
                bus_number       VARCHAR(50)  DEFAULT '',
                bus_distance     VARCHAR(50)  DEFAULT '',
                photo_data       TEXT         NULL,
                admission_fee    NUMERIC(10,2) DEFAULT 0.00,
                annual_fee       NUMERIC(10,2) DEFAULT 0.00,
                tuition_fee      NUMERIC(10,2) DEFAULT 0.00,
                activity_fee     NUMERIC(10,2) DEFAULT 0.00,
                bus_fee          NUMERIC(10,2) DEFAULT 0.00,
                monthly_fee      NUMERIC(10,2) DEFAULT 0.00,
                total_at_admission  NUMERIC(10,2) DEFAULT 0.00,
                paid_at_admission   NUMERIC(10,2) DEFAULT 0.00,
                remaining_due    NUMERIC(10,2) DEFAULT 0.00,
                annual_fee_active   BOOLEAN      DEFAULT TRUE,
                annual_fee_paid_date TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
                admission_month  VARCHAR(20)  NOT NULL,
                admission_year   INT          NOT NULL,
                created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_students_school_student UNIQUE (school_code, student_id),
                CONSTRAINT fk_students_schools
                    FOREIGN KEY (school_code) REFERENCES schools(school_code) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_students_school_code ON students(school_code);
        `);

        // 3. PAYMENTS TABLE
        await pool.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id           SERIAL PRIMARY KEY,
                school_code  VARCHAR(50)   NOT NULL,
                student_id   VARCHAR(50)   NOT NULL,
                month        VARCHAR(20)   NOT NULL,
                year         INT           NOT NULL,
                total_fee    NUMERIC(10,2) NOT NULL,
                paid_amount  NUMERIC(10,2) NOT NULL,
                due_amount   NUMERIC(10,2) NOT NULL,
                payment_date TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_payments_students
                    FOREIGN KEY (school_code, student_id)
                    REFERENCES students(school_code, student_id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_payments_school_student ON payments(school_code, student_id);
        `);

        // 4. FEE CONFIGURATIONS TABLE
        await pool.query(`
            CREATE TABLE IF NOT EXISTS fee_configurations (
                id           SERIAL PRIMARY KEY,
                school_code  VARCHAR(50)   NOT NULL UNIQUE,
                admission_fee NUMERIC(10,2) DEFAULT 500.00,
                annual_fee   NUMERIC(10,2)  DEFAULT 200.00,
                activity_fee NUMERIC(10,2)  DEFAULT 50.00,
                updated_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_fee_config_schools
                    FOREIGN KEY (school_code) REFERENCES schools(school_code) ON DELETE CASCADE
            );
        `);

        console.log('✅ Connected to Neon PostgreSQL & all tables verified successfully!');
    } catch (err) {
        console.error('❌ Database Initialization Error:', err.message);
    }
}

// ─── Helper: Ensure School Record Exists (prevents FK violations) ────────────
async function ensureSchoolExists(schoolCode) {
    if (!schoolCode) return;
    try {
        const existing = await pool.query(
            'SELECT school_code FROM schools WHERE school_code = $1',
            [schoolCode]
        );
        if (existing.rows.length === 0) {
            await pool.query(
                `INSERT INTO schools (school_code, school_name, school_email, owner_number, password)
                 VALUES ($1, $2, $3, $4, $5) ON CONFLICT (school_code) DO NOTHING`,
                [schoolCode, `School ${schoolCode}`, `${schoolCode.toLowerCase()}@schoolnext.com`,
                 '0000000000', hashPassword('123456')]
            );
        }
    } catch (err) {
        console.error('Error in ensureSchoolExists:', err.message);
    }
}

// ─── Helper: Strip sensitive fields from school object ───────────────────────
function safeSchool(row) {
    return {
        code:        row.school_code,
        name:        row.school_name,
        email:       row.school_email,
        ownerNumber: row.owner_number,
        logo:        row.logo_data || ''
        // password is intentionally omitted
    };
}

// ════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════════════════

// POST /api/auth/register — Register or update a school
app.post('/api/auth/register', async (req, res) => {
    const { logo, name, code, email, ownerNumber, password } = req.body;

    // Input validation
    if (!code || !name || !email || !ownerNumber || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const cleanCode = sanitize(code, 50).toUpperCase();
    const cleanName = sanitize(name, 255);
    const cleanEmail = sanitize(email, 255);
    const cleanPhone = sanitize(ownerNumber, 20);
    const hashedPwd  = hashPassword(password);

    try {
        const existing = await pool.query(
            'SELECT school_code FROM schools WHERE UPPER(school_code) = UPPER($1)',
            [cleanCode]
        );

        if (existing.rows.length > 0) {
            await pool.query(
                `UPDATE schools
                 SET school_name = $1, school_email = $2, owner_number = $3,
                     password = $4, logo_data = COALESCE($5, logo_data)
                 WHERE UPPER(school_code) = UPPER($6)`,
                [cleanName, cleanEmail, cleanPhone, hashedPwd, logo || null, cleanCode]
            );
            return res.json({ success: true, message: 'School details updated successfully!' });
        }

        await pool.query(
            `INSERT INTO schools (school_code, school_name, school_email, owner_number, password, logo_data)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [cleanCode, cleanName, cleanEmail, cleanPhone, hashedPwd, logo || null]
        );

        res.json({ success: true, message: 'School registered successfully!' });
    } catch (err) {
        console.error('❌ Registration Error:', err.message);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// POST /api/auth/login — Login a school
app.post('/api/auth/login', async (req, res) => {
    const { code, password } = req.body;

    if (!code || !password) {
        return res.status(400).json({ success: false, message: 'School Code and Password are required.' });
    }

    const cleanCode = sanitize(code, 50).toUpperCase();
    const hashedPwd = hashPassword(password);

    try {
        const result = await pool.query(
            'SELECT * FROM schools WHERE UPPER(school_code) = UPPER($1)',
            [cleanCode]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'School Code not found.' });
        }

        const school = result.rows[0];

        // Support both legacy plaintext passwords and new hashed passwords
        const isHashMatch  = school.password === hashedPwd;
        const isLegacyMatch = school.password === password; // handles accounts created before hashing

        if (!isHashMatch && !isLegacyMatch) {
            return res.status(401).json({ success: false, message: 'Incorrect password.' });
        }

        // If legacy plaintext match, upgrade the stored password to hashed version
        if (isLegacyMatch && !isHashMatch) {
            await pool.query(
                'UPDATE schools SET password = $1 WHERE school_code = $2',
                [hashedPwd, school.school_code]
            );
        }

        // Return school info WITHOUT password
        res.json({ success: true, school: safeSchool(school) });
    } catch (err) {
        console.error('❌ Login Error:', err.message);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// PUT /api/auth/school/update — Update school details (logo, email, phone, password)
app.put('/api/auth/school/update', async (req, res) => {
    const { code, name, email, ownerNumber, password, logo } = req.body;

    if (!code) {
        return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const cleanCode = sanitize(code, 50).toUpperCase();
    const hashedPwd = password ? hashPassword(password) : null;

    try {
        const result = await pool.query(
            `UPDATE schools
             SET school_name = $1, school_email = $2, owner_number = $3,
                 password = COALESCE($4, password),
                 logo_data = COALESCE($5, logo_data)
             WHERE school_code = $6`,
            [
                sanitize(name, 255),
                sanitize(email, 255),
                sanitize(ownerNumber, 20),
                hashedPwd,
                logo || null,
                cleanCode
            ]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'School not found.' });
        }

        res.json({ success: true, message: 'School profile updated successfully!' });
    } catch (err) {
        console.error('❌ School Update Error:', err.message);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// STUDENT ROUTES
// ════════════════════════════════════════════════════════════════════════════

// GET /api/students/:schoolCode — Fetch all students for a school
app.get('/api/students/:schoolCode', async (req, res) => {
    const { schoolCode } = req.params;
    if (!schoolCode) {
        return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    try {
        await ensureSchoolExists(schoolCode);

        const [studentsResult, paymentsResult] = await Promise.all([
            pool.query('SELECT * FROM students WHERE school_code = $1', [schoolCode]),
            pool.query('SELECT * FROM payments WHERE school_code = $1', [schoolCode])
        ]);

        const studentsMap = {};
        studentsResult.rows.forEach(s => {
            const stdPayments = paymentsResult.rows
                .filter(p => p.student_id === s.student_id)
                .map(p => ({
                    month:    p.month,
                    year:     p.year,
                    totalFee: Number(p.total_fee),
                    paid:     Number(p.paid_amount),
                    due:      Number(p.due_amount),
                    date:     p.payment_date
                }));

            studentsMap[s.student_id] = {
                id:              s.student_id,
                name:            s.name,
                photo:           s.photo_data,
                fatherName:      s.father_name,
                motherName:      s.mother_name,
                address:         s.address,
                mobile:          s.mobile,
                class:           s.class,
                section:         s.section,
                busNumber:       s.bus_number,
                busDistance:     s.bus_distance,
                admissionFee:    Number(s.admission_fee),
                annualFee:       Number(s.annual_fee),
                tuitionFee:      Number(s.tuition_fee),
                activityFee:     Number(s.activity_fee),
                busFee:          Number(s.bus_fee),
                monthlyFee:      Number(s.monthly_fee),
                totalAtAdmission: Number(s.total_at_admission),
                paidAtAdmission: Number(s.paid_at_admission),
                remainingDue:    Number(s.remaining_due),
                annualFeeActive: Boolean(s.annual_fee_active),
                annualFeePaidDate: s.annual_fee_paid_date,
                admissionMonth:  s.admission_month,
                admissionYear:   s.admission_year,
                payments:        stdPayments,
                totalDue:        Number(s.remaining_due) +
                                  stdPayments.reduce((sum, p) => sum + p.due, 0)
            };
        });

        res.json({ success: true, students: studentsMap });
    } catch (err) {
        console.error('❌ Error fetching students:', err.message);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// POST /api/students — Add a new student
app.post('/api/students', async (req, res) => {
    const { schoolCode, student } = req.body;

    if (!schoolCode || !student || !student.id) {
        return res.status(400).json({ success: false, message: 'Missing schoolCode or student data.' });
    }

    try {
        await ensureSchoolExists(schoolCode);

        const existing = await pool.query(
            'SELECT id FROM students WHERE school_code = $1 AND student_id = $2',
            [schoolCode, student.id]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Student ID "${student.id}" is already registered.`
            });
        }

        await pool.query(
            `INSERT INTO students (
                school_code, student_id, name, father_name, mother_name, address, mobile,
                class, section, bus_number, bus_distance, photo_data,
                admission_fee, annual_fee, tuition_fee, activity_fee, bus_fee,
                monthly_fee, total_at_admission, paid_at_admission, remaining_due,
                admission_month, admission_year
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,
                $8,$9,$10,$11,$12,
                $13,$14,$15,$16,$17,
                $18,$19,$20,$21,
                $22,$23
            )`,
            [
                schoolCode, student.id,
                sanitize(student.name), sanitize(student.fatherName), sanitize(student.motherName),
                sanitize(student.address, 1000), sanitize(student.mobile, 20),
                sanitize(student.class, 50), sanitize(student.section, 10),
                student.busNumber || '', student.busDistance || '',
                student.photo || null,
                student.admissionFee  || 0, student.annualFee   || 0,
                student.tuitionFee    || 0, student.activityFee  || 0,
                student.busFee        || 0, student.monthlyFee   || 0,
                student.totalAtAdmission || 0, student.paidAtAdmission || 0,
                student.remainingDue     || 0,
                student.admissionMonth  || 'January',
                student.admissionYear   || new Date().getFullYear()
            ]
        );

        // Initial payment record
        if (student.payments && student.payments.length > 0) {
            const p = student.payments[0];
            await pool.query(
                `INSERT INTO payments (school_code, student_id, month, year, total_fee, paid_amount, due_amount)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [schoolCode, student.id, p.month, p.year || new Date().getFullYear(),
                 p.totalFee || 0, p.paid || 0, p.due || 0]
            );
        }

        res.json({ success: true, message: 'Student registered successfully!' });
    } catch (err) {
        console.error('❌ Error saving student:', err.message);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// POST /api/payments — Save monthly payment records
app.post('/api/payments', async (req, res) => {
    const { schoolCode, studentId, payments, remainingDue } = req.body;

    if (!schoolCode || !studentId) {
        return res.status(400).json({ success: false, message: 'schoolCode and studentId are required.' });
    }

    try {
        await ensureSchoolExists(schoolCode);

        // Update remaining due on the student record
        await pool.query(
            'UPDATE students SET remaining_due = $1 WHERE school_code = $2 AND student_id = $3',
            [remainingDue || 0, schoolCode, studentId]
        );

        // Replace all payment records for this student
        await pool.query(
            'DELETE FROM payments WHERE school_code = $1 AND student_id = $2',
            [schoolCode, studentId]
        );

        if (Array.isArray(payments) && payments.length > 0) {
            for (const p of payments) {
                await pool.query(
                    `INSERT INTO payments (school_code, student_id, month, year, total_fee, paid_amount, due_amount)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    [schoolCode, studentId, p.month, p.year, p.totalFee, p.paid, p.due]
                );
            }
        }

        res.json({ success: true, message: 'Payment recorded successfully!' });
    } catch (err) {
        console.error('❌ Error saving payment:', err.message);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// PUT /api/students/:schoolCode/:studentId — Update student details
app.put('/api/students/:schoolCode/:studentId', async (req, res) => {
    const { schoolCode, studentId } = req.params;
    const s = req.body;

    try {
        const result = await pool.query(
            `UPDATE students SET
                name = $1, father_name = $2, mother_name = $3, mobile = $4, address = $5,
                class = $6, section = $7, bus_number = $8, bus_distance = $9, bus_fee = $10,
                monthly_fee = $11, photo_data = COALESCE($12, photo_data)
             WHERE school_code = $13 AND student_id = $14`,
            [
                sanitize(s.name), sanitize(s.fatherName), sanitize(s.motherName),
                sanitize(s.mobile, 20), sanitize(s.address, 1000),
                sanitize(s.class, 50), sanitize(s.section, 10),
                s.busNumber || '', s.busDistance || '',
                s.busFee || 0, s.monthlyFee || 0,
                s.photo || null,
                schoolCode, studentId
            ]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        res.json({ success: true, message: 'Student updated successfully!' });
    } catch (err) {
        console.error('❌ Error updating student:', err.message);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// DELETE /api/students/:schoolCode/:studentId — Delete a student
app.delete('/api/students/:schoolCode/:studentId', async (req, res) => {
    const { schoolCode, studentId } = req.params;
    try {
        await pool.query(
            'DELETE FROM students WHERE school_code = $1 AND student_id = $2',
            [schoolCode, studentId]
        );
        res.json({ success: true, message: 'Student deleted successfully!' });
    } catch (err) {
        console.error('❌ Error deleting student:', err.message);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// ─── 404 fallback for unmatched API routes ───────────────────────────────────
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ─── Export for Vercel serverless + conditional local listen ─────────────────
module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, async () => {
        console.log(`🚀 School Next Pro API running on http://localhost:${PORT}`);
        await initDatabase();
    });
} else {
    // When imported by Vercel, run DB init once without blocking the export
    initDatabase().catch(err =>
        console.error('DB init error in serverless context:', err.message)
    );
}
