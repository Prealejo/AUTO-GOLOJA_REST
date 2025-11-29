// src/controllers/admin.controller.js
const apiClient = require('../services/apiClientRest');

// =======================
// Middleware: solo admins
// =======================
function requireAdmin(req, res, next) {
    const user = req.session.usuario;

    if (!user) {
        return res.redirect('/login?returnUrl=/admin');
    }

    const rol = String(user.rol || user.Rol || '').toLowerCase();
    if (rol !== 'admin') {
        return res.status(403).send('Acceso no autorizado');
    }

    next();
}

// =======================
// GET /admin  → dashboard
// =======================
async function dashboard(req, res) {
    res.render('admin/index', {
        titulo: 'Panel de administración',
        usuario: req.session.usuario
    });
}

// =====================================================
// Helpers para VEHICULOS (mapear y validar datos)
// =====================================================
function mapVehiculoFromBody(body, idDesdeRuta) {
    const parseIntOrNull = (v) => {
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? null : n;
    };

    const parseFloatOrZero = (v) => {
        const n = parseFloat(v);
        return Number.isNaN(n) ? 0 : n;
    };

    const precioDia = parseFloatOrZero(body.PrecioDia);

    return {
        IdVehiculo: idDesdeRuta ?? (body.IdVehiculo ? parseInt(body.IdVehiculo, 10) : undefined),
        Marca: (body.Marca || '').trim(),
        Modelo: (body.Modelo || '').trim(),
        Anio: parseIntOrNull(body.Anio),
        IdCategoria: parseIntOrNull(body.IdCategoria),
        IdTransmision: parseIntOrNull(body.IdTransmision),
        Capacidad: parseIntOrNull(body.Capacidad),
        PrecioDia: precioDia,
        // El backend sigue esperando estos campos, los igualamos al precio del día
        PrecioNormal: precioDia,
        PrecioActual: precioDia,
        Matricula: null,
        IdPromocion: null,
        Estado: (body.Estado || '').trim() || 'Disponible',
        Descripcion: (body.Descripcion || '').trim(),
        IdSucursal: parseIntOrNull(body.IdSucursal),
        UrlImagen: (body.UrlImagen || '').trim() || null
    };
}

function validarVehiculo(dto) {
    const errores = [];
    const anioActual = new Date().getFullYear();

    // Marca / modelo
    if (!dto.Marca) errores.push('La marca es obligatoria.');
    if (!dto.Modelo) errores.push('El modelo es obligatorio.');

    // Año
    if (!Number.isInteger(dto.Anio)) {
        errores.push('El año es obligatorio.');
    } else {
        if (dto.Anio < 1990) errores.push('El año no puede ser menor a 1990.');
        if (dto.Anio > anioActual) errores.push('El año no puede ser mayor al año actual.');
    }

    // Capacidad
    if (!Number.isInteger(dto.Capacidad) || dto.Capacidad <= 0) {
        errores.push('La capacidad debe ser mayor a 0.');
    } else if (dto.Capacidad > 9) {
        errores.push('La capacidad máxima permitida es 9 personas.');
    }

    // Precio
    if (dto.PrecioDia <= 0) {
        errores.push('El precio por día debe ser mayor a 0.');
    }

    // IDs básicos
    if (!Number.isInteger(dto.IdCategoria) || dto.IdCategoria <= 0) {
        errores.push('La categoría es obligatoria.');
    }

    if (!Number.isInteger(dto.IdSucursal) || dto.IdSucursal <= 0) {
        errores.push('La sucursal es obligatoria.');
    }

    // Transmisión (sabemos que son 1..3)
    if (!Number.isInteger(dto.IdTransmision) || dto.IdTransmision < 1 || dto.IdTransmision > 3) {
        errores.push('El ID de transmisión debe estar entre 1 y 3.');
    }

    // URL imagen
    if (dto.UrlImagen && !/^https?:\/\//i.test(dto.UrlImagen)) {
        errores.push('La URL de la imagen debe empezar con http:// o https://');
    }

    // Estado
    const estadosValidos = ['Disponible', 'Mantenimiento', 'Inactivo'];
    if (!dto.Estado || !estadosValidos.includes(dto.Estado)) {
        errores.push('El estado seleccionado no es válido.');
    }

    return errores;
}

// =====================================================
// Helpers para USUARIOS
// =====================================================
function mapUsuarioFromBody(body, idDesdeRuta) {
    const limpiar = (v) => (v || '').toString().trim();
    const parseEdad = (v) => {
        const soloDigitos = (v || '').toString().replace(/\D/g, '');
        if (!soloDigitos) return null;
        const n = parseInt(soloDigitos, 10);
        return Number.isNaN(n) ? null : n;
    };

    return {
        IdUsuario: idDesdeRuta ?? (body.IdUsuario ? parseInt(body.IdUsuario, 10) : undefined),

        // Campos principales (coinciden con lo que espera la API REST)
        Nombre: limpiar(body.Nombre || body.nombre || body.Nombres || body.nombres),
        Apellido: limpiar(body.Apellido || body.apellido || body.Apellidos || body.apellidos),
        Email: limpiar(body.Email || body.email),
        Contrasena: limpiar(body.Contrasena || body.contrasena),
        Direccion: limpiar(body.Direccion || body.direccion),
        Pais: limpiar(body.Pais || body.pais),
        Edad: parseEdad(body.Edad || body.edad),
        TipoIdentificacion: limpiar(body.TipoIdentificacion || body.tipoIdentificacion),
        Identificacion: limpiar(body.Identificacion || body.identificacion),
        Rol: limpiar(body.Rol || body.rol) || 'Cliente'
    };
}

function validarUsuario(dto) {
    const errores = [];

    if (!dto.Nombre) errores.push('El nombre es obligatorio.');
    if (!dto.Apellido) errores.push('El apellido es obligatorio.');

    if (!dto.Email) {
        errores.push('El correo electrónico es obligatorio.');
    } else {
        const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regexEmail.test(dto.Email)) {
            errores.push('El correo electrónico no tiene un formato válido.');
        }
    }

    if (!dto.Contrasena) {
        errores.push('La contraseña es obligatoria.');
    }

    if (!dto.Direccion) {
        errores.push('La dirección es obligatoria.');
    }

    if (!dto.Pais) {
        errores.push('El país es obligatorio.');
    }

    if (dto.Edad == null || Number.isNaN(dto.Edad)) {
        errores.push('La edad es obligatoria.');
    } else if (dto.Edad < 18 || dto.Edad > 90) {
        errores.push('La edad debe estar entre 18 y 90 años.');
    }

    if (!dto.TipoIdentificacion) {
        errores.push('El tipo de identificación es obligatorio.');
    }

    if (!dto.Identificacion) {
        errores.push('La identificación es obligatoria.');
    }

    // Validación según tipo de identificación
    if (dto.TipoIdentificacion && dto.Identificacion) {
        const tipo = dto.TipoIdentificacion.toUpperCase();
        const id = dto.Identificacion;

        if (tipo === 'CI' && !/^\d{10}$/.test(id)) {
            errores.push('La cédula ecuatoriana debe tener exactamente 10 dígitos numéricos.');
        } else if (tipo === 'PASAPORTE' && !/^[A-Za-z0-9]{6,15}$/.test(id)) {
            errores.push('El pasaporte debe tener entre 6 y 15 caracteres alfanuméricos.');
        } else if (tipo === 'LICENCIA' && !/^[A-Za-z0-9-]{6,20}$/.test(id)) {
            errores.push('La licencia debe tener entre 6 y 20 caracteres; se permiten letras, números y guiones.');
        }
    }

    const rolesPermitidos = ['Cliente', 'Admin', 'cliente', 'admin'];
    if (!dto.Rol || !rolesPermitidos.includes(dto.Rol)) {
        errores.push('El rol debe ser Cliente o Admin.');
    }

    return errores;
}

// =======================
// CRUD VEHICULOS
// =======================

// GET /admin/vehiculos
async function listaVehiculos(req, res) {
    try {
        const vehiculos = await apiClient.getVehiculos();

        res.render('admin/vehiculos/index', {
            titulo: 'Gestión de vehículos',
            vehiculos,
            error: null,
            usuario: req.session.usuario
        });
    } catch (err) {
        console.error('Error al cargar vehiculos para admin:', err.message);

        res.render('admin/vehiculos/index', {
            titulo: 'Gestión de vehículos',
            vehiculos: [],
            error: 'No se pudieron cargar los vehículos.',
            usuario: req.session.usuario
        });
    }
}

// GET /admin/vehiculos/nuevo
async function formNuevoVehiculo(req, res) {
    try {
        const [categorias, transmisiones, sucursales] = await Promise.all([
            apiClient.getCategoriasVehiculo(),
            apiClient.getTransmisiones(),
            apiClient.getSucursales()
        ]);

        res.render('admin/vehiculos/form', {
            titulo: 'Crear vehículo',
            modo: 'crear',
            vehiculo: {},
            errores: [],
            categorias,
            transmisiones,
            sucursales,
            usuario: req.session.usuario
        });
    } catch (err) {
        console.error('Error cargando listas para nuevo vehículo:', err);
        res.status(500).send('Error al cargar el formulario de vehículo');
    }
}

// POST /admin/vehiculos/nuevo
async function crearVehiculo(req, res) {
    const dto = mapVehiculoFromBody(req.body);
    const errores = validarVehiculo(dto);

    if (errores.length) {
        try {
            const [categorias, transmisiones, sucursales] = await Promise.all([
                apiClient.getCategoriasVehiculo(),
                apiClient.getTransmisiones(),
                apiClient.getSucursales()
            ]);

            return res.status(400).render('admin/vehiculos/form', {
                titulo: 'Crear vehículo',
                modo: 'crear',
                vehiculo: dto,
                errores,
                categorias,
                transmisiones,
                sucursales,
                usuario: req.session.usuario
            });
        } catch (err) {
            console.error('Error recargando listas para crear vehiculo:', err);
            return res.status(500).send('Error al validar los datos del vehículo');
        }
    }

    try {
        await apiClient.crearVehiculo(dto);
        return res.redirect('/admin/vehiculos');
    } catch (err) {
        console.error('Error al crear vehiculo:', err.response?.data || err.message);

        let categorias = [], transmisiones = [], sucursales = [];
        try {
            [categorias, transmisiones, sucursales] = await Promise.all([
                apiClient.getCategoriasVehiculo(),
                apiClient.getTransmisiones(),
                apiClient.getSucursales()
            ]);
        } catch (e) {
            console.error('Error recargando listas tras fallo de API (crear):', e);
        }

        const erroresApi = ['Ocurrió un error al crear el vehículo en la API.'];
        return res.status(500).render('admin/vehiculos/form', {
            titulo: 'Crear vehículo',
            modo: 'crear',
            vehiculo: dto,
            errores: erroresApi,
            categorias,
            transmisiones,
            sucursales,
            usuario: req.session.usuario
        });
    }
}

// GET /admin/vehiculos/:id/editar
async function formEditarVehiculo(req, res) {
    try {
        const id = req.params.id;
        const vehiculo = await apiClient.getVehiculoPorId(id);

        const [categorias, transmisiones, sucursales] = await Promise.all([
            apiClient.getCategoriasVehiculo(),
            apiClient.getTransmisiones(),
            apiClient.getSucursales()
        ]);

        res.render('admin/vehiculos/form', {
            titulo: 'Editar vehículo',
            modo: 'editar',
            vehiculo,
            errores: [],
            categorias,
            transmisiones,
            sucursales,
            usuario: req.session.usuario
        });
    } catch (err) {
        console.error('Error cargando edición:', err);
        res.status(500).send('Error al cargar el vehículo');
    }
}

// POST /admin/vehiculos/:id/editar
async function actualizarVehiculo(req, res) {
    const idRuta = parseInt(req.params.id, 10);
    const dto = mapVehiculoFromBody(req.body, idRuta);
    const errores = validarVehiculo(dto);

    if (errores.length) {
        try {
            const [categorias, transmisiones, sucursales] = await Promise.all([
                apiClient.getCategoriasVehiculo(),
                apiClient.getTransmisiones(),
                apiClient.getSucursales()
            ]);

            return res.status(400).render('admin/vehiculos/form', {
                titulo: 'Editar vehículo',
                modo: 'editar',
                vehiculo: dto,
                errores,
                categorias,
                transmisiones,
                sucursales,
                usuario: req.session.usuario
            });
        } catch (err) {
            console.error('Error recargando listas para editar vehiculo:', err);
            return res.status(500).send('Error al validar los datos del vehículo');
        }
    }

    try {
        await apiClient.actualizarVehiculo(dto.IdVehiculo, dto);
        res.redirect('/admin/vehiculos');
    } catch (err) {
        console.error('Error al actualizar vehículo:', err.response?.data || err.message);

        let categorias = [], transmisiones = [], sucursales = [];
        try {
            [categorias, transmisiones, sucursales] = await Promise.all([
                apiClient.getCategoriasVehiculo(),
                apiClient.getTransmisiones(),
                apiClient.getSucursales()
            ]);
        } catch (e) {
            console.error('Error recargando listas tras fallo de API (editar):', e);
        }

        const erroresApi = ['Ocurrió un error al actualizar el vehículo en la API.'];
        return res.status(500).render('admin/vehiculos/form', {
            titulo: 'Editar vehículo',
            modo: 'editar',
            vehiculo: dto,
            errores: erroresApi,
            categorias,
            transmisiones,
            sucursales,
            usuario: req.session.usuario
        });
    }
}

// POST /admin/vehiculos/:id/eliminar
async function eliminarVehiculo(req, res) {
    const id = parseInt(req.params.id, 10);

    try {
        await apiClient.eliminarVehiculo(id);
    } catch (err) {
        console.error('Error al eliminar vehiculo:', err.message);
        // Solo logueamos; igual redirigimos
    }

    return res.redirect('/admin/vehiculos');
}


// =======================
// CRUD USUARIOS
// =======================

// GET /admin/usuarios
async function listaUsuarios(req, res) {
    try {
        const usuarios = await apiClient.getUsuarios();

        res.render('admin/usuarios/index', {
            titulo: 'Gestión de usuarios',
            usuarios,
            error: null,
            usuario: req.session.usuario
        });
    } catch (err) {
        console.error('Error al cargar usuarios para admin:', err.message || err);
        res.render('admin/usuarios/index', {
            titulo: 'Gestión de usuarios',
            usuarios: [],
            error: 'No se pudieron cargar los usuarios.',
            usuario: req.session.usuario
        });
    }
}

// GET /admin/usuarios/nuevo
async function formNuevoUsuario(req, res) {
    res.render('admin/usuarios/form', {
        titulo: 'Crear usuario',
        modo: 'crear',
        usuarioForm: {},
        errores: [],
        usuario: req.session.usuario
    });
}

// POST /admin/usuarios/nuevo
async function crearUsuario(req, res) {
    const dto = mapUsuarioFromBody(req.body);
    const errores = validarUsuario(dto);

    if (errores.length) {
        return res.status(400).render('admin/usuarios/form', {
            titulo: 'Crear usuario',
            modo: 'crear',
            usuarioForm: dto,
            errores,
            usuario: req.session.usuario
        });
    }

    try {
        await apiClient.crearUsuario(dto);
        return res.redirect('/admin/usuarios');
    } catch (err) {
        console.error('Error al crear usuario:', err.response?.data || err.message);
        errores.push('Ocurrió un error al crear el usuario en la API.');
        return res.status(500).render('admin/usuarios/form', {
            titulo: 'Crear usuario',
            modo: 'crear',
            usuarioForm: dto,
            errores,
            usuario: req.session.usuario
        });
    }
}

// GET /admin/usuarios/:id/editar
async function formEditarUsuario(req, res) {
    try {
        const id = req.params.id;
        const usuarioApi = await apiClient.getUsuarioPorId(id);

        res.render('admin/usuarios/form', {
            titulo: 'Editar usuario',
            modo: 'editar',
            usuarioForm: usuarioApi,
            errores: [],
            usuario: req.session.usuario
        });
    } catch (err) {
        console.error('Error cargando usuario para edición:', err);
        res.status(500).send('Error al cargar el usuario');
    }
}

// POST /admin/usuarios/:id/editar
async function actualizarUsuario(req, res) {
    const id = parseInt(req.params.id, 10);
    const dto = mapUsuarioFromBody(req.body, id);
    const errores = validarUsuario(dto);

    if (errores.length) {
        return res.status(400).render('admin/usuarios/form', {
            titulo: 'Editar usuario',
            modo: 'editar',
            usuarioForm: dto,
            errores,
            usuario: req.session.usuario
        });
    }

    try {
        await apiClient.actualizarUsuario(id, dto);
        return res.redirect('/admin/usuarios');
    } catch (err) {
        console.error('Error al actualizar usuario:', err.response?.data || err.message);
        errores.push('Ocurrió un error al actualizar el usuario en la API.');
        return res.status(500).render('admin/usuarios/form', {
            titulo: 'Editar usuario',
            modo: 'editar',
            usuarioForm: dto,
            errores,
            usuario: req.session.usuario
        });
    }
}

// POST /admin/usuarios/:id/eliminar
async function eliminarUsuario(req, res) {
    const id = parseInt(req.params.id, 10);

    try {
        await apiClient.eliminarUsuario(id);
    } catch (err) {
        console.error('Error al eliminar usuario:', err.message || err);
    }

    return res.redirect('/admin/usuarios');
}

module.exports = {
    requireAdmin,
    dashboard,

    // VEHICULOS
    listaVehiculos,
    formNuevoVehiculo,
    crearVehiculo,
    formEditarVehiculo,
    actualizarVehiculo,
    eliminarVehiculo,

    // USUARIOS
    listaUsuarios,
    formNuevoUsuario,
    crearUsuario,
    formEditarUsuario,
    actualizarUsuario,
    eliminarUsuario
};
