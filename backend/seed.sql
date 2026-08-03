
-- CONVENTIONS :
--   difficulty     : EXACTLY 'Beginner' | 'Intermediate' | 'Advanced'
--                    (must match the strings returned by classification.py)
--   suitable_major : exact major name, or 'Any' if it suits every major
--   suitable_year  : minimum recommended year of study, or NULL for any year
--   hours_per_week : integer, compared against students.available_time_per_week
--   deadline       : must be a FUTURE date, otherwise the demo looks dead
--
-- Run with: psql -U postgres -d skillplus -f backend/seed.sql

-- Requires the hours_per_week column (see schema.sql):
-- ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS hours_per_week INTEGER;

TRUNCATE TABLE opportunities RESTART IDENTITY;

INSERT INTO opportunities (
    title, category, suitable_major, suitable_year, difficulty,
    required_skills, skills_gained, deadline, estimated_time,
    hours_per_week, cv_benefit, link
) VALUES

-- ---------- BEGINNER ----------
('Python for Engineers Bootcamp', 'Bootcamp', 'Any', 1, 'Beginner',
 ARRAY[]::TEXT[], ARRAY['Python','Programming Basics'],
 '2026-10-15', '6 weeks', 6,
 'First programming credential — the entry point for every technical role.',
 'https://example.com/opportunities/python-bootcamp'),

('Intro to Web Development Workshop', 'Workshop', 'Any', 1, 'Beginner',
 ARRAY[]::TEXT[], ARRAY['HTML','CSS','JavaScript'],
 '2026-09-30', '4 weeks', 4,
 'Lets you build and show a personal portfolio site.',
 'https://example.com/opportunities/intro-web-dev'),

('Git and GitHub Fundamentals', 'Workshop', 'Any', 1, 'Beginner',
 ARRAY[]::TEXT[], ARRAY['Git','Version Control','Collaboration'],
 '2026-09-20', '2 weeks', 2,
 'Version control is expected in every internship application.',
 'https://example.com/opportunities/git-fundamentals'),

('Arduino Starter Lab', 'Workshop', 'Electrical Engineering', 1, 'Beginner',
 ARRAY[]::TEXT[], ARRAY['Arduino','C','Basic Circuits'],
 '2026-10-05', '5 weeks', 5,
 'First hands-on hardware project for an engineering portfolio.',
 'https://example.com/opportunities/arduino-lab'),

('Excel and Data Basics for Engineers', 'Workshop', 'Industrial Engineering', 1, 'Beginner',
 ARRAY[]::TEXT[], ARRAY['Excel','Data Analysis'],
 '2026-11-01', '3 weeks', 3,
 'Baseline analytical skill for operations and consulting roles.',
 'https://example.com/opportunities/excel-basics'),

('Coding Club Peer Mentoring','Mentorship', 'Any', 2, 'Beginner',
 ARRAY[]::TEXT[], ARRAY['Communication','Teaching','Teamwork'],
 '2026-09-25', 'One semester', 3,
 'Demonstrates leadership and communication alongside technical skills.',
 'https://example.com/opportunities/peer-mentoring'),

-- ---------- INTERMEDIATE ----------
('Beirut Web Development Hackathon', 'Hackathon', 'Any', 2, 'Intermediate',
 ARRAY['HTML','CSS','JavaScript'], ARRAY['React','Rapid Prototyping','Teamwork'],
 '2026-11-20', '48 hours', 10,
 'A shipped project plus a competitive result to talk about in interviews.',
 'https://example.com/opportunities/beirut-hackathon'),

('Backend Development Internship (Local Startup)', 'Internship',
 'Computer and Communications Engineering', 2, 'Intermediate',
 ARRAY['Python','SQL'], ARRAY['FastAPI','REST APIs','PostgreSQL'],
 '2026-12-01', '3 months', 15,
 'Real production backend experience — the strongest CV line at this level.',
 'https://example.com/opportunities/backend-internship'),

('Data Structures and Algorithms Workshop Series', 'Workshop', 'Computer Science', 2, 'Intermediate',
 ARRAY['Python'], ARRAY['Algorithms','Problem Solving','Complexity Analysis'],
 '2026-10-10', '8 weeks', 6,
 'Direct preparation for technical interviews.',
 'https://example.com/opportunities/dsa-series'),

('Embedded Systems Summer Project', 'Project', 'Electrical Engineering', 3, 'Intermediate',
 ARRAY['C','Basic Circuits'], ARRAY['Embedded C','PCB Design','Debugging'],
 '2027-01-15', '10 weeks', 12,
 'A complete hardware/software project supervised by faculty.',
 'https://example.com/opportunities/embedded-project'),

('UX/UI Design Sprint', 'Workshop', 'Any', 2, 'Intermediate',
 ARRAY[]::TEXT[], ARRAY['Figma','Prototyping','User Research'],
 '2026-11-10', '4 weeks', 8,
 'Design literacy that makes engineers far more effective on product teams.',
 'https://example.com/opportunities/ux-sprint'),

('Junior Data Analyst Internship', 'Internship', 'Industrial Engineering', 3, 'Intermediate',
 ARRAY['Excel','SQL'], ARRAY['Power BI','Data Visualization','Reporting'],
 '2026-12-15', '3 months', 12,
 'Analytics experience valued across consulting, finance and operations.',
 'https://example.com/opportunities/data-analyst-internship'),

-- ---------- ADVANCED ----------
('AI Research Assistantship', 'Research', 'Computer Science', 3, 'Advanced',
 ARRAY['Python','Machine Learning'], ARRAY['PyTorch','Research Methods','Technical Writing'],
 '2026-12-20', '6 months', 15,
 'Research experience and a potential publication — key for graduate applications.',
 'https://example.com/opportunities/ai-research'),

('Software Engineering Internship (Regional Tech Company)', 'Internship',
 'Computer and Communications Engineering', 3, 'Advanced',
 ARRAY['Python','Git','SQL'], ARRAY['System Design','CI/CD','Docker','Code Review'],
 '2027-01-31', '3 months', 20,
 'The flagship internship line on a graduating engineer''s CV.',
 'https://example.com/opportunities/swe-internship'),

('Cybersecurity Capture The Flag Competition', 'Competition',
 'Computer and Communications Engineering', 3, 'Advanced',
 ARRAY['Linux','Networking'], ARRAY['Penetration Testing','Cryptography','Incident Response'],
 '2026-11-28', '2 days', 10,
 'Competitive ranking that stands out for security roles.',
 'https://example.com/opportunities/ctf-competition'),

('Cloud Architecture Certification Track', 'Bootcamp', 'Any', 3, 'Advanced',
 ARRAY['Linux','Networking'], ARRAY['AWS','Cloud Architecture','Infrastructure as Code'],
 '2027-02-15', '10 weeks', 10,
 'An industry-recognised certification, not just coursework.',
 'https://example.com/opportunities/cloud-certification'),

('Robotics Team — Autonomous Systems Division', 'Competition', 'Mechanical Engineering', 3, 'Advanced',
 ARRAY['MATLAB','C++'], ARRAY['ROS','Control Systems','Sensor Fusion'],
 '2026-10-30', 'One academic year', 14,
 'Long-term team project with a demonstrable autonomous robot.',
 'https://example.com/opportunities/robotics-team'),

('Full-Stack Capstone Mentorship Program', 'Mentorship', 'Computer Science', 4, 'Advanced',
 ARRAY['JavaScript','SQL','Git'], ARRAY['System Architecture','Code Review','Deployment'],
 '2027-03-01', '4 months', 12,
 'Mentored end-to-end ownership of a production-grade application.',
 'https://example.com/opportunities/capstone-mentorship'),

('AutoCAD Fundamentals for Civil Engineers', 'Workshop', 'Civil Engineering', 1, 'Beginner',
 ARRAY[]::TEXT[], ARRAY['AutoCAD','Technical Drawing'],
 '2026-10-20', '4 weeks', 4,
 'Core drafting skill expected in every civil engineering role.',
 'https://example.com/opportunities/autocad-civil'),

('Structural Design Site Internship', 'Internship', 'Civil Engineering', 3, 'Intermediate',
 ARRAY['AutoCAD'], ARRAY['Structural Analysis','Site Supervision','Project Documentation'],
 '2026-12-10', '2 months', 12,
 'On-site experience linking design work to real construction.',
 'https://example.com/opportunities/structural-internship'),

('Process Safety Essentials Workshop', 'Workshop', 'Chemical Engineering', 1, 'Beginner',
 ARRAY[]::TEXT[], ARRAY['Process Safety','Lab Protocols'],
 '2026-10-25', '3 weeks', 3,
 'Safety certification is a prerequisite for most plant placements.',
 'https://example.com/opportunities/process-safety'),

('Water Treatment Plant Project', 'Project', 'Chemical Engineering', 3, 'Intermediate',
 ARRAY['MATLAB'], ARRAY['Process Simulation','Environmental Compliance','Report Writing'],
 '2027-01-20', '8 weeks', 10,
 'Applied process engineering with a full technical report.',
 'https://example.com/opportunities/water-treatment');