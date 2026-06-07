-- Upgrade demo user passwords from SHA-256 to bcrypt
-- Password: admin123 → $2b$10$AtttHqQOvtz4LketvQNvmOpNZ26tjM1lA03zTZZyO8Lpgk.2vTuxe

UPDATE perfiles
SET password_hash = '$2b$10$AtttHqQOvtz4LketvQNvmOpNZ26tjM1lA03zTZZyO8Lpgk.2vTuxe'
WHERE password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
