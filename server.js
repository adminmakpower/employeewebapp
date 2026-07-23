const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Database connection config
const isLocal = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/employeedb',
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

// Database schema initialization
async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log("Initializing database tables...");
    
    // 1. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        password VARCHAR(100) NOT NULL,
        avatar VARCHAR(10) NOT NULL
      );
    `);

    // 2. Tasks Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        assignee_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
        assignee_name VARCHAR(100) NOT NULL,
        due VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        creator VARCHAR(100) NOT NULL
      );
    `);

    // 3. Announcements Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        date VARCHAR(50) NOT NULL,
        priority VARCHAR(50) NOT NULL
      );
    `);

    // 4. Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id VARCHAR(50) PRIMARY KEY,
        time VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL,
        msg TEXT NOT NULL
      );
    `);

    // 5. Reports Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
        date VARCHAR(50) NOT NULL,
        text TEXT NOT NULL
      );
    `);

    // 6. Items Table (with UNIQUE item name constraint)
    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        category VARCHAR(100) NOT NULL
      );
    `);

    // 7. New Orders Table (storing Excel imported orders)
    await client.query(`
      CREATE TABLE IF NOT EXISTS new_orders (
        id VARCHAR(50) PRIMARY KEY,
        item_name VARCHAR(255) NOT NULL,
        qty INTEGER NOT NULL,
        amt VARCHAR(100) NOT NULL,
        date VARCHAR(50) NOT NULL,
        party_name VARCHAR(255) NOT NULL,
        order_no VARCHAR(100) NOT NULL,
        remarks_timestamp TEXT
      );
    `);

    // Check if database needs seeding (check if users exist)
    const userCheck = await client.query("SELECT COUNT(*) FROM users;");
    const count = parseInt(userCheck.rows[0].count, 10);
    
    if (count === 0) {
      console.log("Database is empty. Seeding default records...");

      // Seed Users
      const usersQuery = `
        INSERT INTO users (id, name, email, role, status, password, avatar) VALUES
        ('u-1', 'Mukesh Kumar', 'superadmin@makpower.com', 'superadmin', 'active', 'super123', 'MK'),
        ('u-2', 'Anand Verma', 'admin@makpower.com', 'admin', 'active', 'admin123', 'AV'),
        ('u-3', 'Rajesh Sharma', 'employee@makpower.com', 'employee', 'active', 'emp123', 'RS'),
        ('u-4', 'Pooja Patel', 'pooja@makpower.com', 'employee', 'active', 'emp123', 'PP'),
        ('u-5', 'Vikram Singh', 'vikram@makpower.com', 'employee', 'active', 'emp123', 'VS');
      `;
      await client.query(usersQuery);

      // Seed Tasks
      const tasksQuery = `
        INSERT INTO tasks (id, title, description, assignee_id, assignee_name, due, status, creator) VALUES
        ('t-1', 'Charger Board Quality Check', 'Perform QC checks on the new batch of fast-charging circuits (Batch QC-2026). Ensure safety standards are met.', 'u-3', 'Rajesh Sharma', '2026-07-28', 'progress', 'Anand Verma'),
        ('t-2', 'Update Inventory Records', 'Log all inbound power bank cells into the main registry system. Double check the batch counts.', 'u-4', 'Pooja Patel', '2026-07-25', 'pending', 'Anand Verma'),
        ('t-3', 'Final Packaging Approval', 'Approve custom packing materials for the Mak Power SuperCharge series.', 'u-3', 'Rajesh Sharma', '2026-07-24', 'completed', 'Anand Verma');
      `;
      await client.query(tasksQuery);

      // Seed Announcements
      const announcementsQuery = `
        INSERT INTO announcements (id, title, content, date, priority) VALUES
        ('a-1', 'System Portal Launched!', 'Welcome to the new Mak Power Enterprise Portal. Use this system to manage work orders, update task progress, and submit daily activity reports.', '2026-07-23', 'normal'),
        ('a-2', 'Safety Protocol Review', 'All manufacturing and testing staff must attend the quarterly safety guidelines review meeting in Conference Room A tomorrow at 10:00 AM.', '2026-07-23', 'high');
      `;
      await client.query(announcementsQuery);

      // Seed Logs
      const logsQuery = `
        INSERT INTO logs (id, time, type, msg) VALUES
        ('l-1', '12:00:00 PM', 'success', 'Database initialized with default configurations.'),
        ('l-2', '12:05:30 PM', 'info', 'Super Admin account pre-configured.');
      `;
      await client.query(logsQuery);

      // Seed Reports
      const reportsQuery = `
        INSERT INTO reports (id, user_id, date, text) VALUES
        ('r-1', 'u-3', '2026-07-22', 'Completed testing of 200 fast charging circuits. Prepared inventory dispatch sheet.');
      `;
      await client.query(reportsQuery);

      // Seed Items
      const itemsQuery = `
        INSERT INTO items (id, name, category) VALUES
        ('I-1', 'Mak Charger 20W', 'Chargers'),
        ('I-2', 'Lightning Cable 1.5m', 'Cables'),
        ('I-3', 'Power Bank 20000mAh', 'Power Banks');
      `;
      await client.query(itemsQuery);

      // Seed Orders
      const ordersQuery = `
        INSERT INTO new_orders (id, item_name, qty, amt, date, party_name, order_no, remarks_timestamp) VALUES
        ('O-1', 'Mak Charger 20W', 50, 'Applicable', '2026-07-23', 'A1 Electronics', 'ORD-2026-001', 'Immediate dispatch'),
        ('O-2', 'Lightning Cable 1.5m', 100, 'Not Applicable', '2026-07-22', 'Supreme Traders', 'ORD-2026-002', 'Deliver before 5 PM');
      `;
      await client.query(ordersQuery);
      
      console.log("Seeding complete!");
    } else {
      console.log("Database already has data. Skipping seeding.");
    }
  } catch (err) {
    console.error("Error initializing database schema", err);
  } finally {
    client.release();
  }
}

// Run DB Initialization
initDatabase().catch(err => console.error("Database connection failed", err));

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. Get entire database state
app.get('/api/db', async (req, res) => {
  try {
    const usersRes = await pool.query('SELECT * FROM users ORDER BY name ASC');
    const tasksRes = await pool.query(`
      SELECT 
        id, 
        title, 
        description AS desc, 
        assignee_id AS "assigneeId", 
        assignee_name AS "assigneeName", 
        due, 
        status, 
        creator 
      FROM tasks
    `);
    const announcementsRes = await pool.query('SELECT * FROM announcements ORDER BY date DESC, id DESC');
    const logsRes = await pool.query('SELECT * FROM logs ORDER BY id DESC');
    const reportsRes = await pool.query(`
      SELECT 
        id, 
        user_id AS "userId", 
        date, 
        text 
      FROM reports
    `);
    const itemsRes = await pool.query('SELECT * FROM items ORDER BY name ASC');
    const ordersRes = await pool.query(`
      SELECT 
        id, 
        item_name AS "itemName", 
        qty, 
        amt, 
        date, 
        party_name AS "partyName", 
        order_no AS "orderNo", 
        remarks_timestamp AS "remarksTimestamp" 
      FROM new_orders 
      ORDER BY date DESC, id DESC
    `);

    res.json({
      users: usersRes.rows,
      tasks: tasksRes.rows,
      announcements: announcementsRes.rows,
      logs: logsRes.rows,
      reports: reportsRes.rows,
      items: itemsRes.rows,
      orders: ordersRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database fetch failed' });
  }
});

// 2. User Endpoints
app.post('/api/users', async (req, res) => {
  const { id, name, email, role, status, password, avatar } = req.body;
  try {
    await pool.query(
      'INSERT INTO users (id, name, email, role, status, password, avatar) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, name, email, role, status, password, avatar]
    );
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);
    res.json({ message: 'User status updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

app.put('/api/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  try {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    res.json({ message: 'User role updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// 3. Tasks Endpoints
app.post('/api/tasks', async (req, res) => {
  const { id, title, desc, assigneeId, assigneeName, due, status, creator } = req.body;
  try {
    await pool.query(
      'INSERT INTO tasks (id, title, description, assignee_id, assignee_name, due, status, creator) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, title, desc, assigneeId, assigneeName, due, status, creator]
    );
    res.status(201).json({ message: 'Task created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.put('/api/tasks/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await pool.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, id]);
    res.json({ message: 'Task status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// 4. Announcements Endpoints
app.post('/api/announcements', async (req, res) => {
  const { id, title, content, date, priority } = req.body;
  try {
    await pool.query(
      'INSERT INTO announcements (id, title, content, date, priority) VALUES ($1, $2, $3, $4, $5)',
      [id, title, content, date, priority]
    );
    res.status(201).json({ message: 'Announcement created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

app.delete('/api/announcements/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// 5. Logs Endpoints
app.post('/api/logs', async (req, res) => {
  const { id, time, type, msg } = req.body;
  try {
    await pool.query(
      'INSERT INTO logs (id, time, type, msg) VALUES ($1, $2, $3, $4)',
      [id, time, type, msg]
    );
    res.status(201).json({ message: 'Log created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create log' });
  }
});

app.delete('/api/logs', async (req, res) => {
  try {
    await pool.query('DELETE FROM logs');
    res.json({ message: 'Logs cleared' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// 6. Reports Endpoints
app.post('/api/reports', async (req, res) => {
  const { id, userId, date, text } = req.body;
  try {
    await pool.query(
      'INSERT INTO reports (id, user_id, date, text) VALUES ($1, $2, $3, $4)',
      [id, userId, date, text]
    );
    res.status(201).json({ message: 'Report submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// 7. Items Endpoints
app.get('/api/items', async (req, res) => {
  try {
    const items = await pool.query('SELECT * FROM items ORDER BY name ASC');
    res.json(items.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

app.post('/api/items', async (req, res) => {
  const body = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const itemsToInsert = Array.isArray(body) ? body : [body];
    
    for (const item of itemsToInsert) {
      const { id, name, category } = item;
      const existCheck = await client.query('SELECT id FROM items WHERE name = $1', [name]);
      if (existCheck.rows.length > 0) {
        if (Array.isArray(body)) {
          continue; // Skip duplicate item names in bulk upload
        } else {
          return res.status(400).json({ error: 'Item with this name already exists' });
        }
      }
      await client.query(
        'INSERT INTO items (id, name, category) VALUES ($1, $2, $3)',
        [id, name, category]
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json({ message: 'Items saved successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to save items' });
  } finally {
    client.release();
  }
});

app.delete('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM items WHERE id = $1', [id]);
    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// 8. Orders Endpoints
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await pool.query(`
      SELECT 
        id, 
        item_name AS "itemName", 
        qty, 
        amt, 
        date, 
        party_name AS "partyName", 
        order_no AS "orderNo", 
        remarks_timestamp AS "remarksTimestamp" 
      FROM new_orders 
      ORDER BY date DESC, id DESC
    `);
    res.json(orders.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.post('/api/orders', async (req, res) => {
  const body = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ordersToInsert = Array.isArray(body) ? body : [body];
    
    for (const order of ordersToInsert) {
      const { id, itemName, qty, amt, date, partyName, orderNo, remarksTimestamp } = order;
      const finalId = id || ('O-' + Date.now() + Math.random().toString(36).substr(2, 4));
      
      await client.query(
        'INSERT INTO new_orders (id, item_name, qty, amt, date, party_name, order_no, remarks_timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET item_name = EXCLUDED.item_name, qty = EXCLUDED.qty, amt = EXCLUDED.amt, date = EXCLUDED.date, party_name = EXCLUDED.party_name, order_no = EXCLUDED.order_no, remarks_timestamp = EXCLUDED.remarks_timestamp',
        [finalId, itemName, qty, amt, date, partyName, orderNo, remarksTimestamp]
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json({ message: 'Orders saved successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to save orders' });
  } finally {
    client.release();
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM new_orders WHERE id = $1', [id]);
    res.json({ message: 'Order deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// ==========================================
// STATIC FILES & FRONTEND ROUTING
// ==========================================

// Serve static assets from Vite's build folder
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for Single Page App client routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
