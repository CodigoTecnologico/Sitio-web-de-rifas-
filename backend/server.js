require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const rifasRoutes = require('./routes/rifas');
const boletosRoutes = require('./routes/boletos');
const bannersRoutes = require('./routes/banners');
const pool = require('./utils/db');
const bcrypt = require('bcrypt');
const auth = require('./middleware/auth');
const { uploadImage } = require('./utils/cloudinary');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

// CORS
const allowedOrigins = [
  'https://loteria-backend-4afe.onrender.com',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('No permitido por CORS'));
  }
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const generalLimiter = rateLimit({ windowMs: 15*60*1000, max: 300 });
app.use('/api/', generalLimiter);
const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 10 });
app.use('/api/auth/login', loginLimiter);
const reserveLimiter = rateLimit({ windowMs: 60*1000, max: 20 });
app.use('/api/boletos/reserve', reserveLimiter);

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/rifas', rifasRoutes);
app.use('/api/boletos', boletosRoutes);
app.use('/api/banners', bannersRoutes);

// Endpoint de salud
app.get('/healthz', (req, res) => res.status(200).send('OK'));

// Subida de imagen a Cloudinary
app.post('/api/upload', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });
    const imageUrl = await uploadImage(req.file.buffer);
    res.json({ url: imageUrl });
  } catch (err) {
    console.error('Error al subir imagen:', err);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

// Archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Manejo de errores
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, req, res, next) => {
  console.error('Error general:', err);
  if (err.message === 'No permitido por CORS') return res.status(403).json({ error: 'Origen no permitido' });
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Inicialización de base de datos
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
      stream_url TEXT,
      stream_duration INTEGER DEFAULT 60,
      numero_ganador VARCHAR(50),
      ganador_boleto_id INTEGER,
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
      price NUMERIC(10,2),
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

    await pool.query('ALTER TABLE boletos ADD COLUMN IF NOT EXISTS price NUMERIC(10,2)');
    await pool.query('ALTER TABLE rifas ADD COLUMN IF NOT EXISTS stream_url TEXT');
    await pool.query('ALTER TABLE rifas ADD COLUMN IF NOT EXISTS stream_duration INTEGER DEFAULT 60');
    await pool.query('ALTER TABLE rifas ADD COLUMN IF NOT EXISTS numero_ganador VARCHAR(50)');
    await pool.query('ALTER TABLE rifas ADD COLUMN IF NOT EXISTS ganador_boleto_id INTEGER');
    console.log('✅ Columnas verificadas');

    const adminExists = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (adminExists.rows.length === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', ['admin', passwordHash]);
      console.log('✅ Usuario admin creado');
    }
  } catch (err) {
    console.error('❌ Error al inicializar base de datos:', err);
    process.exit(1);
  }
}

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
  })
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });