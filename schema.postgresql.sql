-- ===================================================
-- School Next Pro — Neon PostgreSQL Schema Setup
-- Database: neondb (Neon PostgreSQL)
-- Dialect: PostgreSQL (PL/pgSQL)
-- ===================================================

-- 1. SCHOOLS TABLE (Accounts & Authentication)
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

-- 2. STUDENTS TABLE (Student Records per School)
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

-- 3. PAYMENTS TABLE (Monthly Fee Payment Records)
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

-- 4. FEE CONFIGURATIONS TABLE (Optional Custom Fees per School)
CREATE TABLE IF NOT EXISTS fee_configurations (
    id SERIAL PRIMARY KEY,
    school_code VARCHAR(50) NOT NULL UNIQUE,
    admission_fee NUMERIC(10, 2) DEFAULT 500.00,
    annual_fee NUMERIC(10, 2) DEFAULT 200.00,
    activity_fee NUMERIC(10, 2) DEFAULT 50.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fee_config_schools FOREIGN KEY (school_code) REFERENCES schools(school_code) ON DELETE CASCADE
);
