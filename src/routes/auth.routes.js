// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Login
router.get('/login', authController.mostrarLogin);
router.post('/login', authController.procesarLogin);

// Registro
router.get('/registro', authController.mostrarRegistro);
router.post('/registro', authController.procesarRegistro);

// Logout
router.post('/logout', authController.cerrarSesion);

module.exports = router;
