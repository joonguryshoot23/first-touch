const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.sqlite'));

// WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ===== Users =====
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    password TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ===== Coach Applications =====
db.exec(`
  CREATE TABLE IF NOT EXISTS coaches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    skills TEXT NOT NULL,
    region TEXT NOT NULL,
    bio TEXT,
    certificate_path TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// ===== Venue Applications =====
db.exec(`
  CREATE TABLE IF NOT EXISTS venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    region TEXT NOT NULL,
    venue_type TEXT NOT NULL,
    capacity INTEGER,
    equipment TEXT,
    available_hours TEXT,
    hourly_rate INTEGER,
    photo_path TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// ===== Bookings =====
db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    coach_id INTEGER NOT NULL,
    venue_id INTEGER,
    plan_type TEXT NOT NULL,
    lesson_date TEXT NOT NULL,
    lesson_time TEXT NOT NULL,
    lesson_price INTEGER NOT NULL,
    venue_price INTEGER NOT NULL,
    total_price INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    admin_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (coach_id) REFERENCES coaches(id),
    FOREIGN KEY (venue_id) REFERENCES venues(id)
  )
`);

// ===== Notifications =====
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    booking_id INTEGER,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
  )
`);

// ===== 인덱스 (검색 성능 최적화) =====
db.exec(`CREATE INDEX IF NOT EXISTS idx_coaches_user_id ON coaches(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_coaches_status ON coaches(status)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_venues_user_id ON venues(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_venues_status ON venues(status)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_student_id ON bookings(student_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_coach_id ON bookings(coach_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_lesson_date ON bookings(lesson_date)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read)`);

module.exports = db;
