const express = require('express');
const router = express.Router();
const bannersController = require('../controllers/bannersController');
const auth = require('../middleware/auth');

// Ruta pública
router.get('/', bannersController.getAll);

// Rutas protegidas
router.post('/', auth, bannersController.create);
router.put('/:id', auth, bannersController.update);
router.delete('/:id', auth, bannersController.delete);

module.exports = router;