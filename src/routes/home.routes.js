// src/routes/home.routes.js

const express = require('express');
const router = express.Router();
const homeController = require('../controllers/home.controller');

// Ruta de inicio: GET /
router.get('/', homeController.getHome);

module.exports = router;
