const express = require('express');
const path = require('path');
const session = require('express-session');
const authRoutes = require('./src/routes/auth.routes');
const carritoRoutes = require('./src/routes/carrito.routes');
const adminRoutes = require('./src/routes/admin.routes');
const reservasRoutes = require('./src/routes/reservas.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// importar rutas
const homeRoutes = require('./src/routes/home.routes');
const vehiculosRoutes = require('./src/routes/vehiculos.routes');

// vistas
app.set('views', path.join(__dirname, 'src', 'views'));
app.set('view engine', 'ejs');

// estáticos y parseo
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


app.use(session({
    secret: 'UrbanDriveSuperSecreto123', // luego si quieres lo cambias
    resave: false,
    saveUninitialized: false
}));

// Middleware global para compartir datos con todas las vistas
app.use((req, res, next) => {
  // Usuario logueado (si existe)
  res.locals.usuario = req.session.usuario || null;

  // Estamos en el panel admin si la ruta empieza con /admin
  res.locals.esAdminPanel = req.path && req.path.startsWith('/admin');

  next();
});


// usar rutas
app.use('/', homeRoutes);
app.use('/', vehiculosRoutes);
app.use('/', authRoutes);
app.use('/carrito', carritoRoutes);
app.use('/admin', adminRoutes);
app.use('/reservas', reservasRoutes);

// servidor
app.listen(PORT, () => {
  console.log(`Servidor UrbanDrive escuchando en http://localhost:${PORT}`);
});
