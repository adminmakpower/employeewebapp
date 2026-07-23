const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const logFilePath = path.join(__dirname, 'server.log');

function writeToLogFile(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) console.error("Failed to write to log file:", err);
  });
  console.log(logMessage.trim());
}

writeToLogFile('info', 'System initializing...');

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

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

    // 6. Migrating items table structure if it was VARCHAR in old schema
    const typeCheck = await client.query(`
      SELECT data_type FROM information_schema.columns 
      WHERE table_name = 'items' AND column_name = 'id';
    `);
    if (typeCheck.rows.length > 0 && typeCheck.rows[0].data_type === 'character varying') {
      console.log("Migrating items table schema from VARCHAR to SERIAL...");
      await client.query('DROP TABLE IF EXISTS items CASCADE;');
    }

    // 6. Items Table (with SERIAL auto-incrementing integer key)
    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        category VARCHAR(100) NOT NULL
      );
    `);

    // 6.1 Item History Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS item_history (
        id SERIAL PRIMARY KEY,
        item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        details TEXT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Migrating new_orders table if it has the old column layout or type layout
    const ordersColCheck = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'new_orders';
    `);
    const hasItemId = ordersColCheck.rows.some(r => r.column_name === 'item_id');
    const idCol = ordersColCheck.rows.find(r => r.column_name === 'id');
    const isIdVarchar = idCol && idCol.data_type === 'character varying';
    const hasItemIdCode = ordersColCheck.rows.some(r => r.column_name === 'item_id_code');
    
    if (!hasItemId || isIdVarchar || !hasItemIdCode) {
      console.log("Migrating new_orders table to support item_id_code and serial id...");
      await client.query('DROP TABLE IF EXISTS new_orders CASCADE;');
    }

    // 7. New Orders Table (linked to items table via item_id with auto-incrementing integer id)
    await client.query(`
      CREATE TABLE IF NOT EXISTS new_orders (
        id SERIAL PRIMARY KEY,
        item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        item_id_code VARCHAR(100),
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
        INSERT INTO items (name, category) VALUES
        ('Mak Charger 20W', 'Chargers'),
        ('Lightning Cable 1.5m', 'Cables'),
        ('Power Bank 20000mAh', 'Power Banks');
      `;
      await client.query(itemsQuery);

      // Seed Item History
      const historyQuery = `
        INSERT INTO item_history (item_id, action, details) VALUES
        (1, 'create', 'Item created during system initialization'),
        (2, 'create', 'Item created during system initialization'),
        (3, 'create', 'Item created during system initialization');
      `;
      await client.query(historyQuery);

      // Seed Orders
      const ordersQuery = `
        INSERT INTO new_orders (id, item_id, qty, amt, date, party_name, order_no, remarks_timestamp) VALUES
        ('O-1', 1, 50, 'Applicable', '2026-07-23', 'A1 Electronics', 'ORD-2026-001', 'Immediate dispatch'),
        ('O-2', 2, 100, 'Not Applicable', '2026-07-22', 'Supreme Traders', 'ORD-2026-002', 'Deliver before 5 PM');
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
        o.id, 
        o.item_id AS "itemId",
        i.name AS "itemName", 
        o.qty, 
        o.amt, 
        o.date, 
        o.party_name AS "partyName", 
        o.order_no AS "orderNo", 
        o.remarks_timestamp AS "remarksTimestamp" 
      FROM new_orders o
      JOIN items i ON o.item_id = i.id
      ORDER BY o.date DESC, o.id DESC
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
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const itemsToInsert = Array.isArray(body) ? body : [body];
    writeToLogFile('info', `Received request to upload ${itemsToInsert.length} items.`);
    
    if (itemsToInsert.length === 0) {
      await client.query('COMMIT');
      writeToLogFile('info', 'No items to save.');
      return res.status(201).json({ message: 'No items to save' });
    }

    // Batch items in chunks of 10000 to prevent exceeding PostgreSQL's 65535 parameter formats limit (each item has 2 parameters)
    const BATCH_SIZE = 10000;
    
    for (let i = 0; i < itemsToInsert.length; i += BATCH_SIZE) {
      const batch = itemsToInsert.slice(i, i + BATCH_SIZE);
      const valueParams = [];
      const valuePlaceholders = [];
      let counter = 1;
      
      for (const item of batch) {
        if (!item.name) continue;
        valuePlaceholders.push(`($${counter}, $${counter + 1})`);
        valueParams.push(item.name.trim(), item.category || 'Others');
        counter += 2;
      }

      if (valueParams.length > 0) {
        const insertQuery = `
          INSERT INTO items (name, category) 
          VALUES ${valuePlaceholders.join(', ')} 
          ON CONFLICT (name) DO NOTHING 
          RETURNING id, name
        `;
        const insertRes = await client.query(insertQuery, valueParams);
        const insertedItems = insertRes.rows;
        writeToLogFile('info', `Batch insert: saved ${insertedItems.length} new items into directory.`);

        if (insertedItems.length > 0) {
          const historyParams = [];
          const historyPlaceholders = [];
          let hCounter = 1;
          const importMethod = Array.isArray(body) ? 'bulk import' : 'manual addition';
          
          for (const item of insertedItems) {
            historyPlaceholders.push(`($${hCounter}, 'create', $${hCounter + 1})`);
            historyParams.push(item.id, `Item created via ${importMethod}`);
            hCounter += 2;
          }

          const historyQuery = `
            INSERT INTO item_history (item_id, action, details) 
            VALUES ${historyPlaceholders.join(', ')}
          `;
          await client.query(historyQuery, historyParams);
          writeToLogFile('info', `Batch history: logged audit trail for ${insertedItems.length} items.`);
        } else {
          if (!Array.isArray(body)) {
            if (client) await client.query('ROLLBACK');
            writeToLogFile('warning', 'Manual item upload rejected: Name already exists.');
            return res.status(400).json({ error: 'Item with this name already exists' });
          }
        }
      }
    }
    
    await client.query('COMMIT');
    writeToLogFile('info', `Successfully committed transaction and saved items.`);
    res.status(201).json({ message: 'Items saved successfully' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    writeToLogFile('error', `Error saving items: ${err.stack}`);
    res.status(500).json({ error: 'Failed to save items: ' + err.message });
  } finally {
    if (client) client.release();
  }
});

app.put('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category } = req.body;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    
    const currentRes = await client.query('SELECT * FROM items WHERE id = $1', [id]);
    if (currentRes.rows.length === 0) {
      if (client) await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const currentItem = currentRes.rows[0];
    const changes = [];
    
    if (name && name !== currentItem.name) {
      const nameCheck = await client.query('SELECT id FROM items WHERE name = $1 AND id <> $2', [name, id]);
      if (nameCheck.rows.length > 0) {
        if (client) await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Item with this name already exists' });
      }
      changes.push(`Name changed from '${currentItem.name}' to '${name}'`);
    }
    
    if (category && category !== currentItem.category) {
      changes.push(`Category changed from '${currentItem.category}' to '${category}'`);
    }
    
    if (changes.length > 0) {
      await client.query(
        'UPDATE items SET name = COALESCE($1, name), category = COALESCE($2, category) WHERE id = $3',
        [name, category, id]
      );
      
      for (const change of changes) {
        await client.query(
          'INSERT INTO item_history (item_id, action, details) VALUES ($1, $2, $3)',
          [id, 'update', change]
        );
      }
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Item updated successfully', changes });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error("Error updating item:", err);
    res.status(500).json({ error: 'Failed to update item: ' + err.message });
  } finally {
    if (client) client.release();
  }
});

app.get('/api/items/:id/history', async (req, res) => {
  const { id } = req.params;
  try {
    const history = await pool.query(
      'SELECT id, action, details, timestamp FROM item_history WHERE item_id = $1 ORDER BY timestamp DESC, id DESC',
      [id]
    );
    res.json(history.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch item history' });
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
        o.id, 
        o.item_id AS "itemId",
        o.item_id_code AS "itemIdCode",
        i.name AS "itemName", 
        o.qty, 
        o.amt, 
        o.date, 
        o.party_name AS "partyName", 
        o.order_no AS "orderNo", 
        o.remarks_timestamp AS "remarksTimestamp" 
      FROM new_orders o
      JOIN items i ON o.item_id = i.id
      ORDER BY o.date DESC, o.id DESC
    `);
    res.json(orders.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.post('/api/orders', async (req, res) => {
  const body = req.body;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const ordersToInsert = Array.isArray(body) ? body : [body];
    writeToLogFile('info', `Received request to upload ${ordersToInsert.length} orders.`);
    
    if (ordersToInsert.length === 0) {
      await client.query('COMMIT');
      writeToLogFile('info', 'No orders to save.');
      return res.status(201).json({ message: 'No orders to save' });
    }

    await saveOrdersInternal(client, ordersToInsert);
    
    await client.query('COMMIT');
    writeToLogFile('info', 'Successfully committed transaction and saved all orders.');
    res.status(201).json({ message: 'Orders saved successfully' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    writeToLogFile('error', `Error saving orders: ${err.stack}`);
    res.status(500).json({ error: 'Failed to save orders: ' + err.message });
  } finally {
    if (client) client.release();
  }
});

async function saveOrdersInternal(client, ordersToInsert) {
  // 1. Get all existing items to build name-to-id mapping
  const allItemsRes = await client.query('SELECT id, name FROM items');
  const itemMap = new Map();
  allItemsRes.rows.forEach(r => itemMap.set(r.name.toLowerCase().trim(), r.id));

  // 2. Identify missing items in the uploaded orders
  const missingNames = new Set();
  for (const order of ordersToInsert) {
    if (order.itemName) {
      const nameClean = order.itemName.toLowerCase().trim();
      if (!itemMap.has(nameClean)) {
        missingNames.add(order.itemName.trim());
      }
    }
  }

  // 3. Bulk insert missing items if any (batched to prevent parameter format limit)
  if (missingNames.size > 0) {
    writeToLogFile('info', `Found ${missingNames.size} missing items in order upload. Registering them...`);
    const missingArray = Array.from(missingNames);
    const ITEM_BATCH_SIZE = 10000;
    
    for (let i = 0; i < missingArray.length; i += ITEM_BATCH_SIZE) {
      const batch = missingArray.slice(i, i + ITEM_BATCH_SIZE);
      const valPlaceholders = [];
      const valParams = [];
      let iCounter = 1;
      for (const name of batch) {
        valPlaceholders.push(`($${iCounter}, 'Others')`);
        valParams.push(name);
        iCounter++;
      }
      
      const insertItemsQuery = `
        INSERT INTO items (name, category) 
        VALUES ${valPlaceholders.join(', ')} 
        ON CONFLICT (name) DO NOTHING 
        RETURNING id, name
      `;
      const insertItemsRes = await client.query(insertItemsQuery, valParams);
      
      // Update our map with the newly inserted items
      insertItemsRes.rows.forEach(r => itemMap.set(r.name.toLowerCase().trim(), r.id));
      writeToLogFile('info', `Registered ${insertItemsRes.rows.length} new items from this batch.`);
      
      // Bulk insert history logs for these new items
      if (insertItemsRes.rows.length > 0) {
        const hPlaceholders = [];
        const hParams = [];
        let hCounter = 1;
        for (const r of insertItemsRes.rows) {
          hPlaceholders.push(`($${hCounter}, 'create', 'Item created via orders import')`);
          hParams.push(r.id);
          hCounter += 1;
        }
        await client.query(
          `INSERT INTO item_history (item_id, action, details) VALUES ${hPlaceholders.join(', ')}`,
          hParams
        );
      }
    }
  }

  // 4. Construct values and placeholders for bulk inserting orders in batches
  // Batch size of 5000 to prevent exceeding PostgreSQL's 65535 parameter formats limit (each order has 8 parameters)
  const ORDER_BATCH_SIZE = 5000;
  
  for (let i = 0; i < ordersToInsert.length; i += ORDER_BATCH_SIZE) {
    const batch = ordersToInsert.slice(i, i + ORDER_BATCH_SIZE);
    const valueParams = [];
    const valuePlaceholders = [];
    let counter = 1;
    
    for (const order of batch) {
      const { itemName, itemIdCode, qty, amt, date, partyName, orderNo, remarksTimestamp } = order;
      
      const nameClean = itemName ? itemName.toLowerCase().trim() : '';
      const itemId = itemMap.get(nameClean);
      
      if (!itemId) {
        continue;
      }
      
      valuePlaceholders.push(`($${counter}, $${counter+1}, $${counter+2}, $${counter+3}, $${counter+4}, $${counter+5}, $${counter+6}, $${counter+7})`);
      valueParams.push(
        itemId, 
        itemIdCode ? itemIdCode.trim() : '',
        parseInt(qty, 10) || 0, 
        amt ? amt.trim() : '', 
        date ? date.trim() : '', 
        partyName ? partyName.trim() : '', 
        orderNo ? orderNo.trim() : '', 
        remarksTimestamp ? remarksTimestamp.trim() : ''
      );
      counter += 8;
    }
    
    if (valueParams.length > 0) {
      const insertQuery = `
        INSERT INTO new_orders (item_id, item_id_code, qty, amt, date, party_name, order_no, remarks_timestamp) 
        VALUES ${valuePlaceholders.join(', ')}
      `;
      await client.query(insertQuery, valueParams);
      writeToLogFile('info', `Batch insert: successfully saved ${valueParams.length / 8} orders.`);
    }
  }
}

// CSV parser helper
function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }
  return lines;
}

// Backend version of formatExcelDate
function formatExcelDateBackend(val) {
  if (val === undefined || val === null) return '';
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    const yyyy = date.getFullYear();
    let mm = date.getMonth() + 1;
    let dd = date.getDate();
    if (mm < 10) mm = '0' + mm;
    if (dd < 10) dd = '0' + dd;
    return `${yyyy}-${mm}-${dd}`;
  }
  return String(val).trim();
}

// Google Sheets Sync function
async function syncGoogleSheet() {
  try {
    const settingsRes = await pool.query("SELECT value FROM system_settings WHERE key = 'google_sheet_url'");
    if (settingsRes.rows.length === 0 || !settingsRes.rows[0].value) {
      return { success: false, message: 'Google Sheet URL not configured.' };
    }
    const url = settingsRes.rows[0].value;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    const csvText = await response.text();
    
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return { success: false, message: 'Empty sheet or invalid CSV.' };
    }
    
    const headers = rows[0].map(h => h.trim().toLowerCase().replace(/[\s_&]/g, ''));
    const dataRows = rows.slice(1);
    
    const findIndex = (candidates) => {
      return headers.findIndex(h => candidates.includes(h));
    };
    
    const itemIdx = findIndex(['itemname', 'item']);
    const itemIdCodeIdx = findIndex(['itemidcode', 'itemid', 'itemcode']);
    const qtyIdx = findIndex(['qty', 'quantity']);
    const amtIdx = findIndex(['amt', 'amount', 'scheme']);
    const dateIdx = findIndex(['date', 'orderdate']);
    const partyIdx = findIndex(['partyname', 'party']);
    const orderNoIdx = findIndex(['orderno', 'ordernumber']);
    const remarksIdx = findIndex(['remarkstimestamp', 'remarks', 'timestamp']);
    
    if (itemIdx === -1 || partyIdx === -1) {
      return { success: false, message: 'Required headers (Item Name, Party Name) not found in Google Sheet.' };
    }
    
    const ordersToInsert = [];
    for (const r of dataRows) {
      const itemName = r[itemIdx];
      const partyName = r[partyIdx];
      if (!itemName || !partyName) continue;
      
      ordersToInsert.push({
        itemName: itemName.trim(),
        itemIdCode: itemIdCodeIdx !== -1 ? r[itemIdCodeIdx].trim() : '',
        qty: parseInt(r[qtyIdx], 10) || 0,
        amt: amtIdx !== -1 ? r[amtIdx].trim() : '',
        date: dateIdx !== -1 ? formatExcelDateBackend(r[dateIdx]) : new Date().toISOString().split('T')[0],
        partyName: partyName.trim(),
        orderNo: orderNoIdx !== -1 ? r[orderNoIdx].trim() : '',
        remarksTimestamp: remarksIdx !== -1 ? r[remarksIdx].trim() : ''
      });
    }
    
    if (ordersToInsert.length === 0) {
      return { success: true, message: 'No valid orders to import.', count: 0 };
    }
    
    let client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Delete existing orders to ensure 1-to-1 sync
      await client.query('DELETE FROM new_orders');
      
      await saveOrdersInternal(client, ordersToInsert);
      
      await client.query('COMMIT');
      writeToLogFile('info', `Google Sheet Auto-Sync: successfully imported ${ordersToInsert.length} orders.`);
      return { success: true, message: `Successfully synced ${ordersToInsert.length} orders!`, count: ordersToInsert.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    writeToLogFile('error', `Google Sheet Auto-Sync failed: ${err.stack}`);
    return { success: false, error: err.message };
  }
}

// Google Sheets endpoints
app.get('/api/settings/google-sheet-url', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'google_sheet_url'");
    res.json({ url: result.rows.length > 0 ? result.rows[0].value : '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/google-sheet-url', async (req, res) => {
  const { url } = req.body;
  try {
    await pool.query(`
      INSERT INTO system_settings (key, value) VALUES ('google_sheet_url', $1)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, [url || '']);
    writeToLogFile('info', `Google Sheet URL updated to: ${url}`);
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/sync-sheet', async (req, res) => {
  writeToLogFile('info', 'Manual Google Sheet sync triggered by user.');
  const result = await syncGoogleSheet();
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Auto-sync Google Sheet every 15 minutes in background
setInterval(async () => {
  try {
    writeToLogFile('info', 'Auto-Sync: starting Google Sheet import check...');
    const result = await syncGoogleSheet();
    writeToLogFile('info', `Auto-Sync result: ${JSON.stringify(result)}`);
  } catch (err) {
    writeToLogFile('error', `Auto-Sync background interval error: ${err.message}`);
  }
}, 15 * 60 * 1000);

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

// Delete all orders
app.post('/api/orders/clear', async (req, res) => {
  try {
    await pool.query('DELETE FROM new_orders');
    writeToLogFile('info', 'All orders deleted from database.');
    res.json({ success: true, message: 'All orders deleted successfully.' });
  } catch (err) {
    writeToLogFile('error', `Failed to delete all orders: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Delete selected orders
app.post('/api/orders/delete-multiple', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No IDs provided' });
  }
  try {
    await pool.query('DELETE FROM new_orders WHERE id = ANY($1::int[])', [ids.map(Number)]);
    writeToLogFile('info', `Deleted ${ids.length} selected orders.`);
    res.json({ success: true, message: `Successfully deleted ${ids.length} orders.` });
  } catch (err) {
    writeToLogFile('error', `Failed to delete selected orders: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Update an order
app.put('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { orderNo, itemIdCode, qty, amt, date, partyName, remarksTimestamp, itemName } = req.body;
  try {
    let itemId = null;
    if (itemName) {
      const nameClean = itemName.toLowerCase().trim();
      let itemRes = await pool.query('SELECT id FROM items WHERE LOWER(name) = $1', [nameClean]);
      if (itemRes.rows.length > 0) {
        itemId = itemRes.rows[0].id;
      } else {
        const insertRes = await pool.query("INSERT INTO items (name, category) VALUES ($1, 'Others') RETURNING id", [itemName.trim()]);
        itemId = insertRes.rows[0].id;
        await pool.query("INSERT INTO item_history (item_id, action, details) VALUES ($1, 'create', 'Item created during order edit')", [itemId]);
      }
    }
    
    await pool.query(`
      UPDATE new_orders SET
        item_id = COALESCE($1, item_id),
        item_id_code = $2,
        qty = $3,
        amt = $4,
        date = $5,
        party_name = $6,
        order_no = $7,
        remarks_timestamp = $8
      WHERE id = $9
    `, [
      itemId,
      itemIdCode ? itemIdCode.trim() : '',
      parseInt(qty, 10) || 0,
      amt ? amt.trim() : '',
      date ? date.trim() : '',
      partyName ? partyName.trim() : '',
      orderNo ? orderNo.trim() : '',
      remarksTimestamp ? remarksTimestamp.trim() : '',
      id
    ]);
    
    writeToLogFile('info', `Order ID ${id} updated successfully.`);
    res.json({ success: true, message: 'Order updated successfully' });
  } catch (err) {
    writeToLogFile('error', `Failed to update order ${id}: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// STATIC FILES & FRONTEND ROUTING
// ==========================================

app.get('/api/server-logs', (req, res) => {
  writeToLogFile('info', 'Received request to download server log file');
  if (fs.existsSync(logFilePath)) {
    res.setHeader('Content-Type', 'text/plain');
    res.sendFile(logFilePath);
  } else {
    res.status(404).send('Log file not found');
  }
});

app.get('/api/storage-info', async (req, res) => {
  try {
    const sizeRes = await pool.query('SELECT pg_database_size(current_database()) AS size;');
    const sizeBytes = parseInt(sizeRes.rows[0].size, 10);
    
    // Neon Free Tier storage limit: 512 MB
    const limitBytes = 512 * 1024 * 1024;
    const usedMb = (sizeBytes / (1024 * 1024)).toFixed(2);
    const limitMb = (limitBytes / (1024 * 1024)).toFixed(2);
    const availableBytes = Math.max(0, limitBytes - sizeBytes);
    const availableMb = (availableBytes / (1024 * 1024)).toFixed(2);
    const pctUsed = ((sizeBytes / limitBytes) * 100).toFixed(1);
    
    res.json({
      usedBytes: sizeBytes,
      usedMb: parseFloat(usedMb),
      limitBytes: limitBytes,
      limitMb: parseFloat(limitMb),
      availableBytes: availableBytes,
      availableMb: parseFloat(availableMb),
      percentageUsed: parseFloat(pctUsed)
    });
  } catch (err) {
    writeToLogFile('error', `Error retrieving storage info: ${err.message}`);
    res.status(500).json({ error: 'Failed to retrieve storage info' });
  }
});

// Serve static assets from Vite's build folder
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for Single Page App client routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  writeToLogFile('info', `Server is running on port ${PORT}`);
});
