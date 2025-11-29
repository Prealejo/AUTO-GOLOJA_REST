// src/routes/admin.routes.js
const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');

// Middleware para proteger TODAS las rutas de este router
router.use(adminController.requireAdmin);

// =======================
// Dashboard  (/admin)
// =======================
router.get('/', adminController.dashboard);

// =======================
// Vehículos  (/admin/vehiculos/...)
// =======================
router.get('/vehiculos', adminController.listaVehiculos);
router.get('/vehiculos/nuevo', adminController.formNuevoVehiculo);
router.post('/vehiculos/nuevo', adminController.crearVehiculo);

router.get('/vehiculos/:id/editar', adminController.formEditarVehiculo);
router.post('/vehiculos/:id/editar', adminController.actualizarVehiculo);

router.post('/vehiculos/:id/eliminar', adminController.eliminarVehiculo);

// =======================
// Usuarios  (/admin/usuarios/...)
// =======================
router.get('/usuarios', adminController.listaUsuarios);
router.get('/usuarios/nuevo', adminController.formNuevoUsuario);
router.post('/usuarios/nuevo', adminController.crearUsuario);

router.get('/usuarios/:id/editar', adminController.formEditarUsuario);
router.post('/usuarios/:id/editar', adminController.actualizarUsuario);

router.post('/usuarios/:id/eliminar', adminController.eliminarUsuario);

module.exports = router;
