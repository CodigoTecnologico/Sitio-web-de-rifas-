const express = require('express');
const router = express.Router();
const rifasController = require('../controllers/rifasController');
const auth = require('../middleware/auth');

// Rutas públicas
router.get('/', rifasController.getAll);
router.get('/:id', rifasController.getOne);

// Rutas protegidas (requieren autenticación)
router.post('/', auth, rifasController.create);
router.put('/:id', auth, rifasController.update);
router.delete('/:id', auth, rifasController.delete);

module.exports = router;