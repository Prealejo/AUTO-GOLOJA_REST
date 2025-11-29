// src/controllers/home.controller.js

const getHome = (req, res) => {
  res.render('home', {
    titulo: 'UrbanDrive NYC',
    mensaje: 'Bienvenido a UrbanDrive NYC – Renta de autos en New York'
  });
};

module.exports = {
  getHome,
};
