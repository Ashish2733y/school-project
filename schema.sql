-- ===================================================
-- School Next Pro — Microsoft SQL Server Schema Setup
-- Database: school_next_pro
-- Dialect: Transact-SQL (T-SQL)
-- ===================================================

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = N'school_next_pro')
BEGIN
    CREATE DATABASE school_next_pro;
END;
GO

USE school_next_pro;
GO

-- 1. SCHOOLS TABLE (Accounts & Authentication)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[schools]') AND type in (N'U'))
BEGIN
    CREATE TABLE schools (
        id INT IDENTITY(1,1) PRIMARY KEY,
        school_code VARCHAR(50) NOT NULL UNIQUE,
        school_name VARCHAR(255) NOT NULL,
        school_email VARCHAR(255) NOT NULL,
        owner_number VARCHAR(20) NOT NULL,
        password VARCHAR(255) NOT NULL,
        logo_data VARCHAR(MAX) NULL,
        created_at DATETIME2 DEFAULT GETDATE()
    );

    CREATE INDEX idx_school_code ON schools(school_code);
END;
GO

-- 2. STUDENTS TABLE (Student Records per School)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[students]') AND type in (N'U'))
BEGIN
    CREATE TABLE students (
        id INT IDENTITY(1,1) PRIMARY KEY,
        school_code VARCHAR(50) NOT NULL,
        student_id VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        father_name VARCHAR(255) NOT NULL,
        mother_name VARCHAR(255) NOT NULL,
        address VARCHAR(MAX) NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        class VARCHAR(50) NOT NULL,
        section VARCHAR(10) NOT NULL,
        bus_number VARCHAR(50) DEFAULT '',
        bus_distance VARCHAR(50) DEFAULT '',
        photo_data VARCHAR(MAX) NULL,
        admission_fee DECIMAL(10, 2) DEFAULT 0.00,
        annual_fee DECIMAL(10, 2) DEFAULT 0.00,
        tuition_fee DECIMAL(10, 2) DEFAULT 0.00,
        activity_fee DECIMAL(10, 2) DEFAULT 0.00,
        bus_fee DECIMAL(10, 2) DEFAULT 0.00,
        monthly_fee DECIMAL(10, 2) DEFAULT 0.00,
        total_at_admission DECIMAL(10, 2) DEFAULT 0.00,
        paid_at_admission DECIMAL(10, 2) DEFAULT 0.00,
        remaining_due DECIMAL(10, 2) DEFAULT 0.00,
        annual_fee_active BIT DEFAULT 1,
        annual_fee_paid_date DATETIME2 DEFAULT GETDATE(),
        admission_month VARCHAR(20) NOT NULL,
        admission_year INT NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT UQ_students_school_student UNIQUE (school_code, student_id),
        CONSTRAINT FK_students_schools FOREIGN KEY (school_code) REFERENCES schools(school_code) ON DELETE CASCADE
    );
END;
GO

-- 3. PAYMENTS TABLE (Monthly Fee Payment Records)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[payments]') AND type in (N'U'))
BEGIN
    CREATE TABLE payments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        school_code VARCHAR(50) NOT NULL,
        student_id VARCHAR(50) NOT NULL,
        month VARCHAR(20) NOT NULL,
        year INT NOT NULL,
        total_fee DECIMAL(10, 2) NOT NULL,
        paid_amount DECIMAL(10, 2) NOT NULL,
        due_amount DECIMAL(10, 2) NOT NULL,
        payment_date DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_payments_students FOREIGN KEY (school_code, student_id) REFERENCES students(school_code, student_id) ON DELETE CASCADE
    );
END;
GO

-- 4. FEE CONFIGURATIONS TABLE (Optional Custom Fees per School)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fee_configurations]') AND type in (N'U'))
BEGIN
    CREATE TABLE fee_configurations (
        id INT IDENTITY(1,1) PRIMARY KEY,
        school_code VARCHAR(50) NOT NULL UNIQUE,
        admission_fee DECIMAL(10, 2) DEFAULT 500.00,
        annual_fee DECIMAL(10, 2) DEFAULT 200.00,
        activity_fee DECIMAL(10, 2) DEFAULT 50.00,
        updated_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_fee_config_schools FOREIGN KEY (school_code) REFERENCES schools(school_code) ON DELETE CASCADE
    );
END;
GO
