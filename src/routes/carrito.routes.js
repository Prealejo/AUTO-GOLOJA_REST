// src/routes/carrito.routes.js
const express = require('express');
const router = express.Router();
const carritoController = require('../controllers/carrito.controller');

// Ver carrito
router.get('/', carritoController.verCarrito);

// Agregar item desde el modal (llamado via fetch)
router.post('/agregar', carritoController.agregarItem);

// Eliminar item del carrito
router.post('/item/:idItem/eliminar', carritoController.eliminarItem);

// Generar reserva(s) desde el carrito y mostrar resumen
router.post('/generar-reserva', carritoController.generarReserva);

module.exports = router;
