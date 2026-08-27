const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const rifasController = require('../controllers/rifasController');
const auth = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Rutas públicas
router.get('/', rifasController.getAll);
router.get('/:id', param('id').isInt(), validate, rifasController.getOne);

// Rutas protegidas con validación
router.post(
  '/',
  auth,
  [
    body('name').isString().trim().notEmpty().withMessage('Nombre requerido'),
    body('price').isNumeric().withMessage('Precio debe ser número'),
    body('total_boletos').isInt({ min: 1 }).withMessage('Total boletos debe ser entero positivo'),
    body('date').isISO8601().withMessage('Fecha inválida'),
    body('badge').optional().isString().isLength({ max: 50 }),
    body('description').optional().isString(),
    body('image_url').optional().isString()
  ],
  validate,
  rifasController.create
);

router.put(
  '/:id',
  auth,
  [
    param('id').isInt(),
    body('name').isString().trim().notEmpty().withMessage('Nombre requerido'),
    body('price').isNumeric().withMessage('Precio debe ser número'),
    body('total_boletos').isInt({ min: 1 }).withMessage('Total boletos debe ser entero positivo'),
    body('date').isISO8601().withMessage('Fecha inválida'),
    body('badge').optional().isString(),
    body('description').optional().isString(),
    body('image_url').optional().isString()
  ],
  validate,
  rifasController.update
);

router.delete('/:id', auth, param('id').isInt(), validate, rifasController.delete);

module.exports = router;

router.post('/:id/set-ganador', auth, rifasController.setGanador);