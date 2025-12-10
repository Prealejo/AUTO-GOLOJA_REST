const express = require('express');
const router = express.Router();
const reservasController = require('../controllers/reservas.controller');

// /reservas
router.get('/', reservasController.listarMisReservas);

// /reservas/:id  → detalle
router.get('/:id', reservasController.verDetalleReserva);

// /reservas/:id/pagar  → POST pago MiBanca
router.post('/:id/pagar', reservasController.pagarReserva);
router.post('/reservas/:id/cancelar', reservasController.cancelarReserva);


module.exports = router;
