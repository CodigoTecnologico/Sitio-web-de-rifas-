const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const rifasController = require('../controllers/rifasController');
const auth = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

router.get('/', rifasController.getAll);
router.get('/:id', param('id').isInt(), validate, rifasController.getOne);

router.post('/', auth, [
  body('name').notEmpty(),
  body('price').isNumeric(),
  body('total_boletos').isInt({ min: 1 }),
  body('date').isISO8601(),
  body('stream_url').optional({ values: 'falsy' }).isURL()
], validate, rifasController.create);

router.put('/:id', auth, [
  param('id').isInt(),
  body('name').notEmpty(),
  body('price').isNumeric(),
  body('total_boletos').isInt({ min: 1 }),
  body('date').isISO8601(),
  body('stream_url').optional({ values: 'falsy' }).isURL()
], validate, rifasController.update);

router.delete('/:id', auth, param('id').isInt(), validate, rifasController.delete);
router.post('/:id/set-ganador', auth, param('id').isInt(), validate, rifasController.setGanador);

module.exports = router;