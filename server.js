const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve frontend static files (index.html, style.css, upperP.js)
app.use(express.static(__dirname));

// Neon PostgreSQL Connection Pool
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_uQzEAY9Ff5LX@ep-cold-bar-az3n7tg0-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

// Automatic Database & Table Initialization Routine
async function initDatabase() {
    try {
        console.log('🔄 Connecting to Neon PostgreSQL and initializing tables...');

        // 1. SCHOOLS TABLE
        await pool.query(`
            CREATE TABLE IF NOT EXISTS schools (
                id SERIAL PRIMARY KEY,
                school_code VARCHAR(50) NOT NULL UNIQUE,
                school_name VARCHAR(255) NOT NULL,
                school_email VARCHAR(255) NOT NULL,
                owner_number VARCHAR(20) NOT NULL,
                password VARCHAR(255) NOT NULL,
                logo_data TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_school_code ON schools(school_code);
        `);

        // 2. STUDENTS TABLE
        await pool.query(`
            CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                school_code VARCHAR(50) NOT NULL,
                student_id VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                father_name VARCHAR(255) NOT NULL,
                mother_name VARCHAR(255) NOT NULL,
                address TEXT NOT NULL,
                mobile VARCHAR(20) NOT NULL,
                class VARCHAR(50) NOT NULL,
                section VARCHAR(10) NOT NULL,
                bus_number VARCHAR(50) DEFAULT '',
                bus_distance VARCHAR(50) DEFAULT '',
                photo_data TEXT NULL,
                admission_fee NUMERIC(10, 2) DEFAULT 0.00,
                annual_fee NUMERIC(10, 2) DEFAULT 0.00,
                tuition_fee NUMERIC(10, 2) DEFAULT 0.00,
                activity_fee NUMERIC(10, 2) DEFAULT 0.00,
                bus_fee NUMERIC(10, 2) DEFAULT 0.00,
                monthly_fee NUMERIC(10, 2) DEFAULT 0.00,
                total_at_admission NUMERIC(10, 2) DEFAULT 0.00,
                paid_at_admission NUMERIC(10, 2) DEFAULT 0.00,
                remaining_due NUMERIC(10, 2) DEFAULT 0.00,
                annual_fee_active BOOLEAN DEFAULT TRUE,
                annual_fee_paid_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                admission_month VARCHAR(20) NOT NULL,
                admission_year INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_students_school_student UNIQUE (school_code, student_id),
                CONSTRAINT fk_students_schools FOREIGN KEY (school_code) REFERENCES schools(school_code) ON DELETE CASCADE
            );
        `);

        // 3. PAYMENTS TABLE
        await pool.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                school_code VARCHAR(50) NOT NULL,
                student_id VARCHAR(50) NOT NULL,
                month VARCHAR(20) NOT NULL,
                year INT NOT NULL,
                total_fee NUMERIC(10, 2) NOT NULL,
                paid_amount NUMERIC(10, 2) NOT NULL,
                due_amount NUMERIC(10, 2) NOT NULL,
                payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_payments_students FOREIGN KEY (school_code, student_id) REFERENCES students(school_code, student_id) ON DELETE CASCADE
            );
        `);

        // 4. FEE CONFIGURATIONS TABLE
        await pool.query(`
            CREATE TABLE IF NOT EXISTS fee_configurations (
                id SERIAL PRIMARY KEY,
                school_code VARCHAR(50) NOT NULL UNIQUE,
                admission_fee NUMERIC(10, 2) DEFAULT 500.00,
                annual_fee NUMERIC(10, 2) DEFAULT 200.00,
                activity_fee NUMERIC(10, 2) DEFAULT 50.00,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_fee_config_schools FOREIGN KEY (school_code) REFERENCES schools(school_code) ON DELETE CASCADE
            );
        `);

        console.log('✅ Connected to Neon PostgreSQL Database & all tables created/verified successfully!');
    } catch (err) {
        console.error('❌ Database Initialization Error:', err.message);
    }
}

// Helper: Ensure School Record exists before creating students to prevent FK violation
async function ensureSchoolExists(schoolCode) {
    if (!schoolCode) return;
    try {
        const existing = await pool.query('SELECT school_code FROM schools WHERE school_code = $1', [schoolCode]);
        if (existing.rows.length === 0) {
            await pool.query(
                `INSERT INTO schools (school_code, school_name, school_email, owner_number, password)
                 VALUES ($1, $2, $3, $4, $5) ON CONFLICT (school_code) DO NOTHING`,
                [schoolCode, `School ${schoolCode}`, `${schoolCode.toLowerCase()}@schoolnext.com`, '0000000000', '123456']
            );
            console.log(`ℹ️ Auto-created default school record in Neon DB for code: "${schoolCode}"`);
        }
    } catch (err) {
        console.error('Error in ensureSchoolExists:', err.message);
    }
}

// ===================================================
// AUTH ROUTES (Schools Table)
// ===================================================

// Register School
app.post('/api/auth/register', async (req, res) => {
    const { logo, name, code, email, ownerNumber, password } = req.body;
    try {
        const existing = await pool.query(
            'SELECT school_code FROM schools WHERE UPPER(school_code) = UPPER($1)',
            [code]
        );

        if (existing.rows.length > 0) {
            // Update existing school details
            await pool.query(
                `UPDATE schools SET school_name = $1, school_email = $2, owner_number = $3, password = $4, logo_data = COALESCE($5, logo_data)
                 WHERE UPPER(school_code) = UPPER($6)`,
                [name, email, ownerNumber, password, logo || null, code]
            );
            console.log(`✅ School "${name}" (${code}) details updated in Neon DB!`);
            return res.json({ success: true, message: 'School details updated in Neon DB!' });
        }

        await pool.query(
            `INSERT INTO schools (school_code, school_name, school_email, owner_number, password, logo_data)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [code.toUpperCase(), name, email, ownerNumber, password, logo || null]
        );

        console.log(`✅ School "${name}" (${code}) registered in Neon DB!`);
        res.json({ success: true, message: 'School registered successfully in Neon DB!' });
    } catch (err) {
        console.error('❌ Registration Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Login School
app.post('/api/auth/login', async (req, res) => {
    const { code, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM schools WHERE UPPER(school_code) = UPPER($1)',
            [code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'School Code not found.' });
        }

        const school = result.rows[0];
        if (school.password !== password) {
            return res.status(401).json({ success: false, message: 'Incorrect password.' });
        }

        res.json({
            success: true,
            school: {
                code: school.school_code,
                name: school.school_name,
                email: school.school_email,
                ownerNumber: school.owner_number,
                password: school.password,
                logo: school.logo_data
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update School Details (After Login)
app.put('/api/auth/school/update', async (req, res) => {
    const { code, name, email, ownerNumber, password, logo } = req.body;
    try {
        const result = await pool.query(
            `UPDATE schools 
             SET school_name = $1, school_email = $2, owner_number = $3, password = $4, logo_data = COALESCE($5, logo_data)
             WHERE school_code = $6`,
            [name, email, ownerNumber, password, logo || null, code]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'School not found.' });
        }

        console.log(`✅ School "${name}" (${code}) profile updated in Neon DB!`);
        res.json({ success: true, message: 'School profile updated successfully!' });
    } catch (err) {
        console.error('❌ School Update Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===================================================
// STUDENT ROUTES (Students & Payments Tables)
// ===================================================

// Get all students for a school
app.get('/api/students/:schoolCode', async (req, res) => {
    const { schoolCode } = req.params;
    try {
        await ensureSchoolExists(schoolCode);

        const studentsResult = await pool.query(
            'SELECT * FROM students WHERE school_code = $1',
            [schoolCode]
        );
        const paymentsResult = await pool.query(
            'SELECT * FROM payments WHERE school_code = $1',
            [schoolCode]
        );

        const studentsMap = {};
        studentsResult.rows.forEach(s => {
            const stdPayments = paymentsResult.rows
                .filter(p => p.student_id === s.student_id)
                .map(p => ({
                    month: p.month,
                    year: p.year,
                    totalFee: Number(p.total_fee),
                    paid: Number(p.paid_amount),
                    due: Number(p.due_amount),
                    date: p.payment_date
                }));

            studentsMap[s.student_id] = {
                id: s.student_id,
                name: s.name,
                photo: s.photo_data,
                fatherName: s.father_name,
                motherName: s.mother_name,
                address: s.address,
                mobile: s.mobile,
                class: s.class,
                section: s.section,
                busNumber: s.bus_number,
                busDistance: s.bus_distance,
                admissionFee: Number(s.admission_fee),
                annualFee: Number(s.annual_fee),
                tuitionFee: Number(s.tuition_fee),
                activityFee: Number(s.activity_fee),
                busFee: Number(s.bus_fee),
                monthlyFee: Number(s.monthly_fee),
                totalAtAdmission: Number(s.total_at_admission),
                paidAtAdmission: Number(s.paid_at_admission),
                remainingDue: Number(s.remaining_due),
                annualFeeActive: Boolean(s.annual_fee_active),
                annualFeePaidDate: s.annual_fee_paid_date,
                admissionMonth: s.admission_month,
                admissionYear: s.admission_year,
                payments: stdPayments,
                totalDue: Number(s.remaining_due) + stdPayments.reduce((sum, p) => sum + p.due, 0)
            };
        });

        res.json({ success: true, students: studentsMap });
    } catch (err) {
        console.error('❌ Error fetching students:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Add new student
app.post('/api/students', async (req, res) => {
    const { schoolCode, student } = req.body;
    try {
        if (!schoolCode || !student || !student.id) {
            return res.status(400).json({ success: false, message: 'Missing schoolCode or student object.' });
        }

        // Auto-ensure parent school entry exists to prevent FK violation
        await ensureSchoolExists(schoolCode);

        const existing = await pool.query(
            'SELECT id FROM students WHERE school_code = $1 AND student_id = $2',
            [schoolCode, student.id]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: `Student ID "${student.id}" is already registered.` });
        }

        await pool.query(
            `INSERT INTO students (
                school_code, student_id, name, father_name, mother_name, address, mobile,
                class, section, bus_number, bus_distance, photo_data, admission_fee, annual_fee,
                tuition_fee, activity_fee, bus_fee, monthly_fee, total_at_admission, paid_at_admission,
                remaining_due, admission_month, admission_year
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19, $20,
                $21, $22, $23
            )`,
            [
                schoolCode, student.id, student.name, student.fatherName, student.motherName,
                student.address, student.mobile, student.class, student.section,
                student.busNumber || '', student.busDistance || '', student.photo || null,
                student.admissionFee || 0, student.annualFee || 0, student.tuitionFee || 0, student.activityFee || 0,
                student.busFee || 0, student.monthlyFee || 0, student.totalAtAdmission || 0, student.paidAtAdmission || 0,
                student.remainingDue || 0, student.admissionMonth || 'January', student.admissionYear || new Date().getFullYear()
            ]
        );

        // Initial payment record
        if (student.payments && student.payments.length > 0) {
            const p = student.payments[0];
            await pool.query(
                `INSERT INTO payments (school_code, student_id, month, year, total_fee, paid_amount, due_amount)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [schoolCode, student.id, p.month, p.year || new Date().getFullYear(), p.totalFee || 0, p.paid || 0, p.due || 0]
            );
        }

        console.log(`✅ Student "${student.name}" (ID: ${student.id}) saved to Neon DB for school "${schoolCode}"!`);
        res.json({ success: true, message: 'Student registered in Neon PostgreSQL DB!' });
    } catch (err) {
        console.error('❌ Error saving student to Neon DB:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Save Monthly Payment
app.post('/api/payments', async (req, res) => {
    const { schoolCode, studentId, payments, remainingDue } = req.body;
    try {
        await ensureSchoolExists(schoolCode);

        await pool.query(
            'UPDATE students SET remaining_due = $1 WHERE school_code = $2 AND student_id = $3',
            [remainingDue, schoolCode, studentId]
        );

        await pool.query(
            'DELETE FROM payments WHERE school_code = $1 AND student_id = $2',
            [schoolCode, studentId]
        );

        for (const p of payments) {
            await pool.query(
                `INSERT INTO payments (school_code, student_id, month, year, total_fee, paid_amount, due_amount)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [schoolCode, studentId, p.month, p.year, p.totalFee, p.paid, p.due]
            );
        }

        res.json({ success: true, message: 'Payment recorded in Neon PostgreSQL DB!' });
    } catch (err) {
        console.error('❌ Error saving payment:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Student
app.put('/api/students/:schoolCode/:studentId', async (req, res) => {
    const { schoolCode, studentId } = req.params;
    const s = req.body;
    try {
        await pool.query(
            `UPDATE students SET
                name = $1, father_name = $2, mother_name = $3, mobile = $4, address = $5,
                class = $6, section = $7, bus_number = $8, bus_distance = $9, bus_fee = $10,
                monthly_fee = $11, photo_data = COALESCE($12, photo_data)
            WHERE school_code = $13 AND student_id = $14`,
            [
                s.name, s.fatherName, s.motherName, s.mobile, s.address,
                s.class, s.section, s.busNumber, s.busDistance, s.busFee,
                s.monthlyFee, s.photo || null, schoolCode, studentId
            ]
        );

        res.json({ success: true, message: 'Student updated in Neon PostgreSQL DB!' });
    } catch (err) {
        console.error('❌ Error updating student:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete Student
app.delete('/api/students/:schoolCode/:studentId', async (req, res) => {
    const { schoolCode, studentId } = req.params;
    try {
        await pool.query(
            'DELETE FROM students WHERE school_code = $1 AND student_id = $2',
            [schoolCode, studentId]
        );

        res.json({ success: true, message: 'Student deleted from Neon PostgreSQL DB!' });
    } catch (err) {
        console.error('❌ Error deleting student:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`🚀 School Next Pro Neon PostgreSQL API Server running on port ${PORT}`);
    await initDatabase();
});
