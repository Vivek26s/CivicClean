import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'smart_city_waste.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK (role IN ('citizen', 'admin', 'worker')),
      zone TEXT NOT NULL DEFAULT 'Central Ward',
      availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'busy', 'off_duty')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL CHECK (category IN (
        'Overflowing Dustbin',
        'Garbage on Road',
        'Garbage Near Park',
        'Garbage on Empty Plot',
        'Other'
      )),
      description TEXT NOT NULL,
      image TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      address TEXT NOT NULL,
      ward TEXT NOT NULL DEFAULT 'Central Ward',
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN (
        'Pending',
        'Assigned',
        'In Progress',
        'Resolved',
        'Rejected'
      )),
      worker_status TEXT DEFAULT NULL CHECK (worker_status IS NULL OR worker_status IN (
        'Accepted',
        'On the Way',
        'In Progress',
        'Completed'
      )),
      priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
      assigned_worker_id INTEGER,
      admin_notes TEXT NOT NULL DEFAULT '',
      completion_image TEXT,
      completion_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_worker_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      report_id TEXT,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'alert')),
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
    CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
    CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
    CREATE INDEX IF NOT EXISTS idx_reports_worker ON reports(assigned_worker_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);

  seedInitialData();
}

function seedInitialData(): void {
  const reportCount = db.prepare('SELECT COUNT(*) as count FROM reports').get() as { count: number };
  if (reportCount.count > 0) return;

  // Seed non-loginable realistic municipal profiles (locked hash sentinel 'LOCKED' — cannot be used to log in
  // until an admin explicitly sets credentials, while real citizens register freely and admin claims via bootstrap).
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (name, email, password_hash, phone, role, zone, availability, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  const c1 = insertUser.run('Aarav Sharma', 'aarav.sharma@civic.local', 'LOCKED', '+91 98101 22410', 'citizen', 'Sector 4', 'available', '-12 days');
  const c2 = insertUser.run('Meera Nair', 'meera.nair@civic.local', 'LOCKED', '+91 98204 55190', 'citizen', 'Green Park Ward', 'available', '-9 days');
  const c3 = insertUser.run('Rohan Verma', 'rohan.verma@civic.local', 'LOCKED', '+91 98711 43018', 'citizen', 'Civic Center', 'available', '-6 days');

  const w1 = insertUser.run('Rajesh Kumar', 'rajesh.sanitation@civic.local', 'LOCKED', '+91 98112 77001', 'worker', 'Central & Bus Terminal', 'busy', '-30 days');
  const w2 = insertUser.run('Sunita Devi', 'sunita.sanitation@civic.local', 'LOCKED', '+91 98112 77002', 'worker', 'Green Park & Lakes', 'available', '-28 days');
  const w3 = insertUser.run('Vikram Singh', 'vikram.sanitation@civic.local', 'LOCKED', '+91 98112 77003', 'worker', 'East Residential Ward', 'busy', '-25 days');
  const w4 = insertUser.run('Priya Patel', 'priya.sanitation@civic.local', 'LOCKED', '+91 98112 77004', 'worker', 'Market Square & Old Town', 'available', '-20 days');

  const citizen1Id = Number(c1.lastInsertRowid) || 1;
  const citizen2Id = Number(c2.lastInsertRowid) || 2;
  const citizen3Id = Number(c3.lastInsertRowid) || 3;
  const worker1Id = Number(w1.lastInsertRowid) || 4;
  const worker2Id = Number(w2.lastInsertRowid) || 5;
  const worker3Id = Number(w3.lastInsertRowid) || 6;
  const worker4Id = Number(w4.lastInsertRowid) || 7;

  const IMG_BIN = '/src/assets/images/sample_overflowing_dustbin_1795665107390.jpg';
  const IMG_ROAD = '/src/assets/images/sample_roadside_garbage_1795665108667.jpg';
  const IMG_PARK = '/src/assets/images/sample_park_litter_1795665108937.jpg';
  const IMG_CLEAN = '/src/assets/images/sample_cleaned_street_1795665110836.jpg';

  const insertReport = db.prepare(`
    INSERT INTO reports (
      report_id, user_id, category, description, image,
      latitude, longitude, address, ward, status, worker_status,
      priority, assigned_worker_id, admin_notes,
      completion_image, completion_notes,
      created_at, updated_at, resolved_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      datetime('now', ?), datetime('now', ?), ?
    )
  `);

  const nowIso = new Date().toISOString();

  insertReport.run(
    'SMC-2026-1042', citizen1Id, 'Overflowing Dustbin',
    'Municipal steel dustbin beside Bus Stop 38 has been overflowing since morning. Cardboard boxes and garbage bags are spilling onto the pedestrian sidewalk.',
    IMG_BIN, 28.6315, 77.2167, 'Connaught Outer Circle, Bus Bay 38', 'Central Ward',
    'Pending', null, 'High', null,
    'Flagged for immediate morning shift dispatch.', null, '',
    '-2 hours', '-2 hours', null
  );

  insertReport.run(
    'SMC-2026-1041', citizen2Id, 'Garbage on Road',
    'Household waste bags and torn cartons dumped along the residential curb near Elm & 4th Avenue, partially obstructing street drainage.',
    IMG_ROAD, 28.6189, 77.2295, '42 Residential Lane, East Sector 4', 'East Residential Ward',
    'In Progress', 'In Progress', 'High', worker3Id,
    'Assigned compact waste truck #04 for curb sweep and pickup.', null, '',
    '-5 hours', '-1 hours', null
  );

  insertReport.run(
    'SMC-2026-1039', citizen3Id, 'Garbage Near Park',
    'Scattered plastic bottles, coffee cups, and snack wrappers left around the south walking trail benches at Nehru Community Park.',
    IMG_PARK, 28.5931, 77.2194, 'South Trail Bench #7, Nehru Community Park', 'Green Park Ward',
    'Assigned', 'Accepted', 'Medium', worker2Id,
    'Scheduled for afternoon park sanitation crew.', null, '',
    '-8 hours', '-3 hours', null
  );

  insertReport.run(
    'SMC-2026-1036', citizen1Id, 'Overflowing Dustbin',
    'Commercial market corner waste bin completely full near West Plaza Pharmacy. Needs compaction vehicle and sidewalk washdown.',
    IMG_BIN, 28.6428, 77.2089, 'West Plaza Market Corner, Gate 2', 'Market Square Ward',
    'In Progress', 'Completed', 'Critical', worker1Id,
    'Worker uploaded completion proof; awaiting final supervisor sign-off.',
    IMG_CLEAN, 'Bin emptied, cardboard collected, and sidewalk swept and sanitized.',
    '-1 days', '-2 hours', null
  );

  insertReport.run(
    'SMC-2026-1032', citizen2Id, 'Garbage on Empty Plot',
    'Uncollected packaging waste and discarded sacks piled near the corner boundary wall of vacant Plot 19-B.',
    IMG_ROAD, 28.6095, 77.1982, 'Plot 19-B, Diplomatic Enclave Perimeter', 'West Sector Ward',
    'Resolved', 'Completed', 'Medium', worker4Id,
    'Verified clean on post-operation inspection. Plot perimeter cleared.',
    IMG_CLEAN, 'Removed 14 bags of dry waste and cleared perimeter curb.',
    '-2 days', '-1 days', nowIso
  );

  insertReport.run(
    'SMC-2026-1028', citizen3Id, 'Garbage Near Park',
    'Post-weekend picnic debris left around the north pavilion and children play area.',
    IMG_PARK, 28.6251, 77.2412, 'North Pavilion, Yamuna Riverfront Park', 'Green Park Ward',
    'Resolved', 'Completed', 'Low', worker2Id,
    'Cleaned and verified within 4 hours of assignment.',
    IMG_CLEAN, 'Area swept and segregated recyclables deposited at transfer station.',
    '-3 days', '-2 days', nowIso
  );

  insertReport.run(
    'SMC-2026-1025', citizen1Id, 'Overflowing Dustbin',
    'Twin recycling receptacles near Metro Exit Gate 3 overflowing after evening commute.',
    IMG_BIN, 28.6354, 77.2248, 'Metro Station Exit Gate 3', 'Central Ward',
    'Resolved', 'Completed', 'High', worker1Id,
    'High-footfall transit hub cleared on priority.',
    IMG_CLEAN, 'Replaced bin liners and sanitized surrounding pavement.',
    '-4 days', '-3 days', nowIso
  );

  insertReport.run(
    'SMC-2026-1021', citizen2Id, 'Other',
    'Private construction debris reported inside gated private apartment compound.',
    IMG_ROAD, 28.6012, 77.2355, 'Private Courtyard, Block C Apartments', 'East Residential Ward',
    'Rejected', null, 'Low', null,
    'Outside municipal public right-of-way. Advisory notice sent to RWA management.',
    null, '',
    '-5 days', '-4 days', null
  );
}
