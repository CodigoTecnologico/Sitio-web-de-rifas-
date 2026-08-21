const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post(
  '/login',
  [
    body('username').isString().trim().notEmpty().withMessage('Usuario requerido'),
    body('password').isString().notEmpty().withMessage('Contraseña requerida')
  ],
  validate,
  authController.login
);

router.post(
  '/register',
  [
    body('username').isString().trim().isLength({ min: 3 }).withMessage('Usuario mínimo 3 caracteres'),
    body('password').isString().isLength({ min: 6 }).withMessage('Contraseña mínima 6 caracteres')
  ],
  validate,
  authController.register
);

module.exports = router;