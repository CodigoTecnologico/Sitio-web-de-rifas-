require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const rifasRoutes = require('./routes/rifas');
const boletosRoutes = require('./routes/boletos');
const bannersRoutes = require('./routes/banners');
const pool = require('./utils/db');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/rifas', rifasRoutes);
app.use('/api/boletos', boletosRoutes);
app.use('/api/banners', bannersRoutes);

// Ruta principal
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Endpoint de salud
app.get('/healthz', (req, res) => res.status(200).send('OK'));

// Función para inicializar la base de datos (tablas + usuario admin + columna price)
async function initializeDatabase() {
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

  try {
    await pool.query(createTables);
    console.log('✅ Tablas creadas/verificadas');

    // Añadir columna price a boletos si no existe (para compatibilidad)
    await pool.query('ALTER TABLE boletos ADD COLUMN IF NOT EXISTS price NUMERIC(10,2)');
    console.log('✅ Columna price verificada en boletos');

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
  } catch (err) {
    console.error('❌ Error al inicializar la base de datos:', err);
    process.exit(1);
  }
}

// Inicializar base de datos y luego escuchar
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });