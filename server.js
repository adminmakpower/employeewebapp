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

    // 7. Migrating new_orders table if it has the old column layout
    const ordersColCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'new_orders' AND column_name = 'item_id';
    `);
    if (ordersColCheck.rows.length === 0) {
      console.log("Migrating new_orders table to support relational item_id...");
      await client.query('DROP TABLE IF EXISTS new_orders CASCADE;');
    }

    // 7. New Orders Table (linked to items table via item_id)
    await client.query(`
      CREATE TABLE IF NOT EXISTS new_orders (
        id VARCHAR(50) PRIMARY KEY,
        item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
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
    
    if (itemsToInsert.length === 0) {
      await client.query('COMMIT');
      return res.status(201).json({ message: 'No items to save' });
    }

    const valueParams = [];
    const valuePlaceholders = [];
    let counter = 1;
    
    for (const item of itemsToInsert) {
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
      } else {
        if (!Array.isArray(body)) {
          if (client) await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Item with this name already exists' });
        }
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json({ message: 'Items saved successfully' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error("Error saving items:", err);
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
    
    if (ordersToInsert.length === 0) {
      await client.query('COMMIT');
      return res.status(201).json({ message: 'No orders to save' });
    }

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

    // 3. Bulk insert missing items if any
    if (missingNames.size > 0) {
      const missingArray = Array.from(missingNames);
      const valPlaceholders = [];
      const valParams = [];
      let iCounter = 1;
      for (const name of missingArray) {
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

    // 4. Construct values and placeholders for bulk inserting orders
    const valueParams = [];
    const valuePlaceholders = [];
    let counter = 1;
    
    for (const order of ordersToInsert) {
      const { id, itemName, qty, amt, date, partyName, orderNo, remarksTimestamp } = order;
      const finalId = id || ('O-' + Date.now() + '-' + Math.random().toString(36).substr(2, 7) + '-' + counter);
      
      const nameClean = itemName ? itemName.toLowerCase().trim() : '';
      const itemId = itemMap.get(nameClean);
      
      if (!itemId) {
        // Skipping orders with empty item names that didn't resolve to any ID
        continue;
      }
      
      valuePlaceholders.push(`($${counter}, $${counter+1}, $${counter+2}, $${counter+3}, $${counter+4}, $${counter+5}, $${counter+6}, $${counter+7})`);
      valueParams.push(
        finalId, 
        itemId, 
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
        INSERT INTO new_orders (id, item_id, qty, amt, date, party_name, order_no, remarks_timestamp) 
        VALUES ${valuePlaceholders.join(', ')} 
        ON CONFLICT (id) DO UPDATE SET 
          item_id = EXCLUDED.item_id, 
          qty = EXCLUDED.qty, 
          amt = EXCLUDED.amt, 
          date = EXCLUDED.date, 
          party_name = EXCLUDED.party_name, 
          order_no = EXCLUDED.order_no, 
          remarks_timestamp = EXCLUDED.remarks_timestamp
      `;
      await client.query(insertQuery, valueParams);
    }
    
    await client.query('COMMIT');
    res.status(201).json({ message: 'Orders saved successfully' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error("Error saving orders:", err);
    res.status(500).json({ error: 'Failed to save orders: ' + err.message });
  } finally {
    if (client) client.release();
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
