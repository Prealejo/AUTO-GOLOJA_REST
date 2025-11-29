// src/controllers/auth.controller.js
const apiClient = require('../services/apiClientRest'); // servicio que habla con tu API REST

// GET /login
const mostrarLogin = (req, res) => {
  // Si venías de alguna página protegida
  const returnUrl = req.query.returnUrl || null;

  // Si venías del carrito sin estar logueado
  const mensajeInfo =
    req.query.from === 'carrito'
      ? 'Inicia sesion para agregar vehiculos al carrito.'
      : null;

  res.render('auth/login', {
    titulo: 'Iniciar sesión',
    error: null,
    mensajeInfo,   // para el mensajito verde
    returnUrl      // 👈 ahora SÍ existe en la vista
  });
};



// POST /login
async function procesarLogin(req, res) {
    const { email, password, returnUrl } = req.body;
    const destino = returnUrl && returnUrl !== '' ? returnUrl : '/vehiculos';

    if (!email || !password) {
        return res.status(400).render('auth/login', {
            titulo: 'Iniciar sesión',
            error: 'Debes ingresar correo y contraseña.',
            mensajeInfo: null,
            returnUrl: returnUrl || ''
        });
    }

    try {
        // Login usando GET /usuarios y comparando contra la contraseña local
        const usuario = await apiClient.loginUsuarioPorListado(email, password);

        if (!usuario) {
            return res.status(401).render('auth/login', {
                titulo: 'Iniciar sesión',
                error: 'Email o contraseña incorrectos.',
                mensajeInfo: null,
                returnUrl: returnUrl || ''
            });
        }

        // Guardamos lo necesario en sesión
        req.session.usuario = {
            id: usuario.IdUsuario,
            nombres: usuario.Nombre,
            apellidos: usuario.Apellido,
            email: usuario.Email,
            rol: usuario.Rol,
            pais: usuario.Pais
        };

        // Si luego quieres manejar admin vs cliente, aquí puedes redirigir distinto
        if (String(usuario.Rol || '').toLowerCase() === 'admin') {
            return res.redirect('/admin');
        }

        // Usuario normal: volvemos a donde estaba o a /vehiculos
        return res.redirect(destino);
    } catch (err) {
        console.error('Error en login:', err.response?.data || err.message);
        res.status(500).render('auth/login', {
            titulo: 'Iniciar sesión',
            error: 'Ocurrió un error al iniciar sesión. Inténtalo de nuevo.',
            mensajeInfo: null,
            returnUrl: returnUrl || ''
        });
    }
}

// GET /registro
function mostrarRegistro(req, res) {
    res.render('auth/registro', {
        titulo: 'Crear cuenta',
        errores: [],
        valores: {}
    });
}

// POST /registro
async function procesarRegistro(req, res) {
    const {
        nombres,
        apellidos,
        email,
        telefono,
        password,
        password2,
        pais,
        tipoIdentificacion,
        identificacion,
        edad
    } = req.body;

    const errores = [];
    const valores = {
    nombres,
    apellidos,
    email,
    telefono,
    direccion,
    pais,
    tipoIdentificacion,
    identificacion,
    edad
};


    // ===== Validaciones básicas =====
    if (!nombres || !apellidos || !email || !password || !password2 ||
    !pais || !tipoIdentificacion || !identificacion || !edad || !direccion) {
    errores.push('Todos los campos son obligatorios.');
}


    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
        errores.push('El correo electrónico no tiene un formato válido.');
    }

    // Edad mínima 18
    const edadNum = parseInt(edad, 10);
    if (isNaN(edadNum) || edadNum < 18) {
        errores.push('Debes tener al menos 18 años para registrarte.');
    }

    // Contraseña segura
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passRegex.test(password || '')) {
        errores.push('La contraseña debe tener mínimo 8 caracteres, con mayúsculas, minúsculas y números.');
    }

    if (password !== password2) {
        errores.push('Las contraseñas no coinciden.');
    }

    // Validación de identificación según tipo
    if (tipoIdentificacion === 'CI') {
        // Cédula ecuatoriana simple: 10 dígitos
        if (!/^\d{10}$/.test(identificacion)) {
            errores.push('La cédula debe tener exactamente 10 dígitos numéricos.');
        }
    } else if (tipoIdentificacion === 'PASAPORTE') {
        // Pasaporte: 6-15 alfanuméricos
        if (!/^[A-Za-z0-9]{6,15}$/.test(identificacion)) {
            errores.push('El pasaporte debe tener entre 6 y 15 caracteres alfanuméricos.');
        }
    } else if (tipoIdentificacion === 'LICENCIA') {
        // Licencia: 6-20 letras/números/guiones
        if (!/^[A-Za-z0-9-]{6,20}$/.test(identificacion)) {
            errores.push('La licencia debe tener entre 6 y 20 caracteres (letras, números o guiones).');
        }
    } else {
        errores.push('Debes seleccionar un tipo de identificación válido.');
    }

    if (errores.length > 0) {
        return res.status(400).render('auth/registro', {
            titulo: 'Crear cuenta',
            errores,
            valores
        });
    }

    // ===== Llamada a la API para crear usuario =====
    const payload = {
    Nombre: nombres,
    Apellido: apellidos,
    Email: email,
    Contrasena: password,
    Direccion: direccion,
    Pais: pais,
    Edad: edadNum,
    TipoIdentificacion: tipoIdentificacion,
    Identificacion: identificacion,
    Rol: 'Cliente',
    UsuarioCorreo: null
};


    try {
        const nuevoUsuario = await apiClient.registrarUsuario(payload);

        if (!nuevoUsuario) {
            return res.status(500).render('auth/registro', {
                titulo: 'Crear cuenta',
                errores: ['No se pudo crear el usuario en el servidor.'],
                valores
            });
        }

        // iniciar sesión directo después de registrarse
        req.session.usuario = {
            id: nuevoUsuario.IdUsuario,
            nombres: nuevoUsuario.Nombre,
            apellidos: nuevoUsuario.Apellido,
            email: nuevoUsuario.Email,
            rol: nuevoUsuario.Rol,
            pais: nuevoUsuario.Pais
        };

        res.redirect('/vehiculos');
    } catch (err) {
        console.error('Error registrando usuario:', err.response?.data || err.message);
        res.status(500).render('auth/registro', {
            titulo: 'Crear cuenta',
            errores: ['Ocurrió un error al registrar el usuario.'],
            valores
        });
    }
}

// POST /logout
function cerrarSesion(req, res) {
    req.session.destroy(() => {
        res.redirect('/');
    });
}

module.exports = {
    mostrarLogin,
    procesarLogin,
    mostrarRegistro,
    procesarRegistro,
    cerrarSesion
};
