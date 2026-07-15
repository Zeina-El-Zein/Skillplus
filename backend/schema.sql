-- Skill+ Database Schema
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    link VARCHAR(255)
);
