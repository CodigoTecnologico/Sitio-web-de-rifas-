const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const boletosController = require('../controllers/boletosController');
const auth = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Ruta pública para ver boletos
router.get(
  '/rifa/:rifaId',
  param('rifaId').isInt(),
  validate,
  boletosController.getByRifa
);

// Ruta pública para reservar
router.post(
  '/reserve',
  [
    body('rifaId').isInt(),
    body('numbers').isArray({ min: 1 }).withMessage('Debe seleccionar al menos un número'),
    body('name').isString().trim().notEmpty().withMessage('Nombre requerido'),
    body('phone').isString().trim().notEmpty().withMessage('Teléfono requerido'),
    body('email').optional().isEmail().withMessage('Email inválido')
  ],
  validate,
  boletosController.reserve
);

// Ruta protegida para actualizar boleto
router.put(
  '/:id',
  auth,
  [
    param('id').isInt(),
    body('status').isIn(['disponible', 'reservado', 'vendido']).withMessage('Estado inválido'),
    body('price').optional().isNumeric(),
    body('contenido').optional().isString()
  ],
  validate,
  boletosController.update
);

// Ruta protegida para generar boletos
router.post(
  '/generate',
  auth,
  [
    body('rifaId').isInt(),
    body('total').isInt({ min: 1 })
  ],
  validate,
  boletosController.generateBoletos
);

module.exports = router;