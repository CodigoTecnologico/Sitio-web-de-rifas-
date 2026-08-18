const express = require('express');
const router = express.Router();
const boletosController = require('../controllers/boletosController');
const auth = require('../middleware/auth');

// Ruta pública para ver boletos de una rifa
router.get('/rifa/:rifaId', boletosController.getByRifa);

// Ruta pública para reservar boletos
router.post('/reserve', boletosController.reserve);

// Ruta protegida para actualizar boleto
router.put('/:id', auth, boletosController.update);

// Ruta protegida para generar boletos
router.post('/generate', auth, boletosController.generateBoletos);

module.exports = router;