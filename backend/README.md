# Skill+ Backend — Database Setup

## Requirements
- PostgreSQL 17.10
- psql that comes with PostgreSQL

### Step 1 — Install PostgreSQL

### Step 2 — Create the database
Open your terminal and run:

psql -U postgres

Then inside psql:

CREATE DATABASE skillplus;
\q

### Step 3 — Run the schema file
This creates all the tables automatically:

psql -U postgres -d skillplus -f backend/schema.sql

## Database Tables
users : Stores user accounts for authentication 
students : Stores student profile information
opportunities : Stores available opportunities (pre-populated)

## Sample Data
The opportunities table comes pre-populated with 5 sample opportunities:
- Python Beginner Bootcamp (Beginner)
- Web Dev Hackathon (Intermediate)
- AI Research Internship (Advanced)
- Data Structures Workshop (Beginner)
- Software Engineering Internship (Advanced)

## Notes
- Member 2 (Authentication) depends on the users table
- Member 3 (Profile API) depends on the students table
- Member 4 (Analysis Logic) depends on the students table