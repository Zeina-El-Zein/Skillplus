-- Run this file to set up the database locally
-- Command: psql -U postgres -d skillplus -f backend/schema.sql

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash
ON password_reset_tokens(token_hash);

CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id),
    major VARCHAR(100),
    year_of_study INTEGER,
    courses_taken TEXT[],
    current_skills TEXT[],
    interests TEXT[],
    career_goal VARCHAR(255),
    available_time_per_week INTEGER,
    preferred_opportunity_type VARCHAR(100),
    level VARCHAR(50),
    profile_picture_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS institutions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
    institution_name VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    description TEXT,
    logo_url VARCHAR(500)

);

CREATE TABLE IF NOT EXISTS opportunities (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    suitable_major VARCHAR(100),
    suitable_year INTEGER,
    difficulty VARCHAR(50),
    required_skills TEXT[],
    skills_gained TEXT[],
    deadline DATE,
    estimated_time VARCHAR(100),
    cv_benefit TEXT,
    link VARCHAR(255),
    hours_per_week INTEGER,
    institution_id INTEGER REFERENCES institutions(id),
    source VARCHAR(20) DEFAULT 'seed'
);

CREATE TABLE IF NOT EXISTS roadmaps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    content JSONB NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'fallback',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_tasks (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo', 'in_progress', 'done')),
    priority VARCHAR(10) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('high', 'medium', 'low')),
    opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL
        CHECK (source IN ('opportunity', 'roadmap')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    CONSTRAINT unique_student_opportunity UNIQUE (student_id, opportunity_id)
);