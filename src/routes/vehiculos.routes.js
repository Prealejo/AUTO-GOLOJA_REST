const express = require('express');
const router = express.Router();
const vehiculosController = require('../controllers/vehiculos.controller');

// GET /vehiculos
router.get('/vehiculos', vehiculosController.listarVehiculos);

// GET /vehiculos/:id
router.get('/vehiculos/:id', vehiculosController.detalleVehiculo);

module.exports = router;
