require('dotenv').config();
const pool = require('./utils/db');
const bcrypt = require('bcrypt');

const createTables = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rifas (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  total_boletos INTEGER NOT NULL,
  image_url TEXT,
  badge VARCHAR(50),
  date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS boletos (
  id SERIAL PRIMARY KEY,
  rifa_id INTEGER REFERENCES rifas(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'disponible',
  buyer_name VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  sale_date DATE,
  reservation_date DATE,
  contenido TEXT,
  UNIQUE(rifa_id, number)
);

CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100),
  image_url TEXT,
  link TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
`;

async function initDb() {
  try {
    await pool.query(createTables);
    console.log('✅ Tablas creadas correctamente');
    
    // Crear usuario admin si no existe
    const adminExists = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (adminExists.rows.length === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
        ['admin', passwordHash]
      );
      console.log('✅ Usuario admin creado (contraseña: admin123)');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error al inicializar base de datos:', err);
    process.exit(1);
  }
}

initDb();