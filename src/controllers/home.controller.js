// src/controllers/home.controller.js

const getHome = (req, res) => {
  res.render('home', {
    titulo: 'AutoGo Loja',
    mensaje: 'Viaja cómodo en Ecuador con el auto perfecto para ti  - Reserva rápido, fácil y seguro desde cualquier lugar.'
  });
};

module.exports = {
  getHome,
};
