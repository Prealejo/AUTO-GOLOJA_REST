// src/services/apiClientRest.js
const axios = require('axios');

// Base de tus APIs de gestión
const API_BASE_URL = 'http://restgesstion.runasp.net/api/v1';

// Creamos una instancia de axios reutilizable
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
});

// =======================================
// Vehículos (público)
// =======================================

async function getVehiculos() {
  try {
    const response = await api.get('/vehiculos');
    return response.data;
  } catch (error) {
    console.error('Error al obtener vehículos desde la API:', error.message);
    throw error;
  }
}

async function getVehiculoPorId(idVehiculo) {
  try {
    const response = await api.get(`/vehiculos/${idVehiculo}`);
    return response.data;
  } catch (error) {
    console.error('Error al obtener vehículo por id:', error.message);
    throw error;
  }
}

// =======================================
// Usuarios (para login / registro público)
// =======================================

// 1) Traer todos los usuarios
async function obtenerUsuarios() {
  try {
    const resp = await api.get('/usuarios');
    const data = resp.data && resp.data.data ? resp.data.data : [];
    return data;
  } catch (error) {
    console.error('Error al obtener usuarios:', error.message);
    throw error;
  }
}

// 2) "Login" local: busca por email y compara contraseña
async function loginUsuarioPorListado(email, contrasena) {
  const usuarios = await obtenerUsuarios();
  const usuario = usuarios.find(
    (u) => String(u.Email).toLowerCase() === String(email).toLowerCase()
  );

  if (!usuario) {
    return null;
  }

  if (String(usuario.Contrasena) !== String(contrasena)) {
    return null;
  }

  return usuario;
}

// 3) Registrar usuario público
async function registrarUsuario(payload) {
  try {
    const resp = await api.post('/usuarios', payload);
    return resp.data && resp.data.data ? resp.data.data : null;
  } catch (error) {
    console.error(
      'Error al registrar usuario en la API:',
      error.response?.data || error.message
    );
    throw error;
  }
}

// =======================================
// Transmisiones
// =======================================

async function getTransmisiones() {
  const fallback = [
    { codigo: 'MT', nombre: 'Manual' },
    { codigo: 'AT', nombre: 'Automática' },
    { codigo: 'CVT', nombre: 'CVT' }
  ];

  try {
    const resp = await api.get('/categoriasvehiculo/transmisiones');
    const data = resp.data;

    if (!Array.isArray(data)) {
      return fallback;
    }

    const mapa = new Map();

    data.forEach((item) => {
      if (!item) return;

      if (typeof item === 'string') {
        const lower = item.toLowerCase();
        if (lower.includes('man')) {
          mapa.set('MT', { codigo: 'MT', nombre: item });
        } else if (lower.includes('aut')) {
          mapa.set('AT', { codigo: 'AT', nombre: item });
        } else if (lower.includes('cvt')) {
          mapa.set('CVT', { codigo: 'CVT', nombre: item });
        }
        return;
      }

      const nombre = (item.nombre || item.Nombre || '').toString();
      const desc = (item.descripcion || item.Descripcion || '').toString();
      const texto = (nombre + ' ' + desc).toLowerCase();

      let codigo = 'MT';
      if (texto.includes('aut')) codigo = 'AT';
      else if (texto.includes('cvt')) codigo = 'CVT';
      else if (texto.includes('man')) codigo = 'MT';

      const label =
        desc ||
        nombre ||
        (codigo === 'MT'
          ? 'Manual'
          : codigo === 'AT'
          ? 'Automática'
          : 'CVT');

      mapa.set(codigo, { codigo, nombre: label });
    });

    const lista = Array.from(mapa.values());
    return lista.length > 0 ? lista : fallback;
  } catch (error) {
    console.error('Error al obtener transmisiones:', error.message);
    return fallback;
  }
}

// =======================================
// Carrito
// =======================================

// Muy importante: que acepte el mismo "shape" que el SOAP
// (IdUsuario, IdVehiculo, FechaInicio, FechaFin), pero también
// soporta variantes en minúsculas por si acaso.
async function agregarItemCarrito(payload) {
  try {
    const idUsuario =
      payload.IdUsuario ?? payload.idUsuario ?? payload.id_usuario;
    const idVehiculo =
      payload.IdVehiculo ?? payload.idVehiculo ?? payload.id_vehiculo;
    const fechaInicio = payload.FechaInicio ?? payload.fechaInicio;
    const fechaFin = payload.FechaFin ?? payload.fechaFin;

    const body = {
      IdUsuario: idUsuario,
      IdVehiculo: idVehiculo,
      FechaInicio: fechaInicio,
      FechaFin: fechaFin
    };

    const resp = await api.post('/carrito/agregar', body);
    return resp.data;
  } catch (error) {
    console.error(
      'Error al llamar a la API de carrito/agregar:',
      error.response?.data || error.message
    );
    throw error;
  }
}

async function obtenerDetalleCarrito(idCarrito) {
  if (!idCarrito) return null;

  try {
    const resp = await api.get(`/carrito/${idCarrito}/detalle`);
    return resp.data;
  } catch (error) {
    console.error(
      'Error al obtener detalle de carrito:',
      error.response?.data || error.message
    );
    throw error;
  }
}

async function getCarritoPorUsuario(idUsuario) {
  try {
    const resp = await api.get(`/carrito/usuario/${idUsuario}`);

    // Muchas APIs devuelven { data: {...} } o directo {...}
    const raw = resp.data?.data ?? resp.data ?? null;
    if (!raw) return null;

    // Normalizamos ids
    const idCarrito =
      raw.IdCarrito ?? raw.idCarrito ?? raw.id_carrito ?? null;
    const idUser =
      raw.IdUsuario ?? raw.idUsuario ?? raw.id_usuario ?? idUsuario;

    // Normalizamos los items
    const itemsNode =
      raw.Items ??
      raw.items ??
      raw.Detalles ??
      raw.detalles ??
      [];

    const items = Array.isArray(itemsNode)
      ? itemsNode
      : itemsNode
      ? [itemsNode]
      : [];

    return {
      IdCarrito: idCarrito,
      IdUsuario: idUser,
      FechaCreacion:
        raw.FechaCreacion ?? raw.fechaCreacion ?? raw.fecha_creacion ?? null,
      Items: items
    };
  } catch (error) {
    console.error(
      'Error al obtener carrito por usuario:',
      error.response?.data || error.message
    );
    throw error;
  }
}


async function eliminarItemCarrito(idItem) {
  try {
    const resp = await api.delete(`/carrito/item/${idItem}`);
    return resp.data;
  } catch (error) {
    console.error(
      'Error al eliminar item del carrito:',
      error.response?.data || error.message
    );
    throw error;
  }
}

// =========================================================
// VEHICULOS - CRUD COMPLETO (panel admin)
// =========================================================

async function crearVehiculo(data) {
  const resp = await api.post('/vehiculos', data);
  return resp.data;
}

async function actualizarVehiculo(id, data) {
  const resp = await api.put(`/vehiculos/${id}`, data);
  return resp.data;
}

async function eliminarVehiculo(id) {
  const resp = await api.delete(`/vehiculos/${id}`);
  return resp.data;
}

async function getCategoriasVehiculo() {
  try {
    const resp = await api.get('/categoriasvehiculo');
    return resp.data;
  } catch (err) {
    console.error(
      'Error al obtener categorias desde la API:',
      err.response?.status,
      err.response?.data
    );

    try {
      const vehiculos = await getVehiculos();
      const mapa = new Map();

      vehiculos.forEach((v) => {
        const id =
          v.IdCategoria ||
          v.idCategoria ||
          v.idCategoriaVehiculo ||
          v.id_categoria;

        const nombre =
          v.NombreCategoria ||
          v.nombreCategoria ||
          v.Categoria ||
          v.categoria;

        if (id != null && nombre && !mapa.has(id)) {
          mapa.set(id, { IdCategoria: id, Nombre: nombre });
        }
      });

      return Array.from(mapa.values());
    } catch (e2) {
      console.error('Error generando categorias de respaldo:', e2);
      return [];
    }
  }
}

// =========================================================
// SUCURSALES / PROMOCIONES
// =========================================================

async function getSucursales() {
  const resp = await api.get('/sucursales');
  const data = resp.data;

  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.Sucursales)) return data.Sucursales;

  return [];
}

async function getPromociones() {
  const resp = await api.get('/promociones');
  const data = resp.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.Promociones)) return data.Promociones;

  return [];
}

// =======================
// USUARIOS (CRUD ADMIN)
// =======================

function normalizarUsuarioApi(raw) {
  if (!raw) return null;

  return {
    IdUsuario: raw.IdUsuario ?? raw.idUsuario ?? raw.id_usuario,
    Nombre: raw.Nombre ?? raw.nombre ?? '',
    Apellido: raw.Apellido ?? raw.apellido ?? '',
    Email: raw.Email ?? raw.email ?? '',
    Contrasena: raw.Contrasena ?? raw.contrasena ?? '',
    Direccion: raw.Direccion ?? raw.direccion ?? '',
    Pais: raw.Pais ?? raw.pais ?? '',
    Edad: raw.Edad ?? raw.edad ?? null,
    TipoIdentificacion:
      raw.TipoIdentificacion ?? raw.tipo_identificacion ?? '',
    Identificacion: raw.Identificacion ?? raw.identificacion ?? '',
    Rol: raw.Rol ?? raw.rol ?? ''
  };
}

async function getUsuarios() {
  try {
    const resp = await api.get('/usuarios');
    const data = resp.data;
    const lista = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : [];
    return lista.map(normalizarUsuarioApi);
  } catch (err) {
    console.error(
      'Error al obtener usuarios:',
      err.response?.data || err.message
    );
    throw err;
  }
}

async function getUsuarioPorId(id) {
  try {
    const resp = await api.get(`/usuarios/${id}`);
    const data = resp.data;
    const raw = data?.data ?? data;
    return normalizarUsuarioApi(raw);
  } catch (err) {
    console.error(
      'Error al obtener usuario por id:',
      err.response?.data || err.message
    );
    throw err;
  }
}

async function crearUsuario(dto) {
  try {
    const body = {
      Nombre: dto.Nombre,
      Apellido: dto.Apellido,
      Email: dto.Email,
      Contrasena: dto.Contrasena,
      Direccion: dto.Direccion,
      Pais: dto.Pais,
      Edad: dto.Edad,
      TipoIdentificacion: dto.TipoIdentificacion,
      Identificacion: dto.Identificacion,
      Rol: dto.Rol
    };

    const resp = await api.post('/usuarios', body);
    return resp.data;
  } catch (err) {
    console.error(
      'Error al crear usuario:',
      err.response?.data || err.message
    );
    throw err;
  }
}

async function actualizarUsuario(id, dto) {
  try {
    const body = {
      IdUsuario: id,
      Nombre: dto.Nombre,
      Apellido: dto.Apellido,
      Email: dto.Email,
      Contrasena: dto.Contrasena,
      Direccion: dto.Direccion,
      Pais: dto.Pais,
      Edad: dto.Edad,
      TipoIdentificacion: dto.TipoIdentificacion,
      Identificacion: dto.Identificacion,
      Rol: dto.Rol
    };

    const resp = await api.put(`/usuarios/${id}`, body);
    return resp.data;
  } catch (err) {
    console.error(
      'Error al actualizar usuario:',
      err.response?.data || err.message
    );
    throw err;
  }
}

async function eliminarUsuario(id) {
  try {
    const resp = await api.delete(`/usuarios/${id}`);
    return resp.data;
  } catch (err) {
    console.error(
      'Error al eliminar usuario:',
      err.response?.data || err.message
    );
    throw err;
  }
}

// =========================
// RESERVAS (público + admin)
// =========================

async function crearReserva(reservaDto) {
  try {
    const resp = await api.post('/reservas', reservaDto);
    return resp.data?.data ?? resp.data;
  } catch (err) {
    console.error(
      'Error al crear reserva:',
      err.response?.data || err.message
    );
    throw err;
  }
}

async function getReservasPorUsuario(idUsuario) {
  try {
    const resp = await api.get(`/reservas/usuario/${idUsuario}`);
    const data = resp.data;

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  } catch (err) {
    console.error(
      'Error al obtener reservas del usuario:',
      err.response?.data || err.message
    );
    throw err;
  }
}

async function getReservaPorId(idReserva) {
  try {
    const resp = await api.get(`/reservas/${idReserva}`);
    const data = resp.data;
    return data?.data ?? data;
  } catch (err) {
    console.error(
      'Error al obtener reserva por id:',
      err.response?.data || err.message
    );
    throw err;
  }
}

async function getReservas() {
  try {
    const resp = await api.get('/reservas');
    const data = resp.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  } catch (err) {
    console.error(
      'Error al obtener reservas:',
      err.response?.data || err.message
    );
    throw err;
  }
}

async function actualizarReserva(idReserva, reservaDto) {
  try {
    const resp = await api.put(`/reservas/${idReserva}`, reservaDto);
    return resp.data?.data ?? resp.data;
  } catch (err) {
    console.error(
      'Error al actualizar reserva:',
      err.response?.data || err.message
    );
    throw err;
  }
}

async function eliminarReserva(idReserva) {
  try {
    const resp = await api.delete(`/reservas/${idReserva}`);
    return resp.data?.data ?? resp.data;
  } catch (err) {
    console.error(
      'Error al eliminar reserva:',
      err.response?.data || err.message
    );
    throw err;
  }
}

// =======================
// RESERVAS (ADMIN)
// =======================

async function getReservasAdmin() {
  const resp = await api.get('/reservas');
  const data = resp.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function crearReservaAdmin(reserva) {
  const resp = await api.post('/reservas', reserva);
  return resp.data;
}

async function actualizarReservaAdmin(idReserva, reserva) {
  const resp = await api.put(`/reservas/${idReserva}`, reserva);
  return resp.data;
}

async function eliminarReservaAdmin(idReserva) {
  const resp = await api.delete(`/reservas/${idReserva}`);
  return resp.data;
}

async function cambiarEstadoReserva(idReserva, nuevoEstado) {
  const resp = await api.patch(`/reservas/${idReserva}/estado/${nuevoEstado}`);
  return resp.data;
}

// Alias para mantener misma firma que en SOAP
async function actualizarEstadoReserva(idReserva, nuevoEstado) {
  return cambiarEstadoReserva(idReserva, nuevoEstado);
}

// =======================
// PAGOS (REST)
// =======================
async function registrarPagoReserva(pago) {
  try {
    const body = {
      IdReserva: Number(pago.IdReserva),
      CuentaCliente: String(pago.CuentaCliente),
      CuentaComercio: String(pago.CuentaComercio),
      Monto: Number(pago.Monto)
    };

    // ✅ ESTE ES EL ENDPOINT QUE SÍ EXISTE EN TU BACKEND:
    // POST /api/v1/pagos
    const resp = await api.post('/pagos', body);

    // Tu API suele devolver { data: {...} } o directo {...}
    const raw = resp.data?.data ?? resp.data ?? {};

    return {
      mensaje: raw.mensaje ?? raw.Mensaje ?? '',
      aprobado: !!(raw.aprobado ?? raw.Aprobado),
      respuestaBanco: raw.respuestaBanco ?? raw.RespuestaBanco ?? '',
      idPago: Number(raw.idPago ?? raw.IdPago ?? 0)
    };
  } catch (err) {
    console.error(
      'Error REST registrarPagoReserva:',
      err.response?.data || err.message
    );
    throw err;
  }
}

// ================== PAGOS ==================
async function getPagosPorReserva(idReserva) {
  try {
    const resp = await client.get(`/pagos/reserva/${idReserva}`);
    // El controller REST devuelve { data: [...] }
    return resp.data?.data || [];
  } catch (err) {
    console.error('Error REST getPagosPorReserva:', err.message || err);
    throw err;
  }
}


// =======================
// FACTURAS (ADMIN / RESERVA)
// =======================
async function getFacturasAdmin() {
  const resp = await api.get('/facturas');
  const data = resp.data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

async function getFacturaPorId(idFactura) {
  const resp = await api.get(`/facturas/${idFactura}`);
  const data = resp.data;
  return data?.data ?? data;
}

async function crearFacturaAdmin(factura) {
  const resp = await api.post('/facturas', factura);
  return resp.data;
}

// Alias para que el controller siga usando el mismo nombre.
// Hacemos que devuelva el IdFactura (como hacía SOAP).
async function crearFacturaDesdeReserva(factura) {
  const resp = await api.post('/facturas', factura);
  const data = resp.data?.data ?? resp.data;

  const id =
    data?.IdFactura ??
    data?.idFactura ??
    data?.id ??
    null;

  // Si por alguna razón la API devuelve directamente el id
  // y no un objeto, devolvemos eso también.
  return id ?? data;
}

async function actualizarFacturaAdmin(idFactura, factura) {
  const resp = await api.put(`/facturas/${idFactura}`, factura);
  return resp.data;
}

async function eliminarFacturaAdmin(idFactura) {
  const resp = await api.delete(`/facturas/${idFactura}`);
  return resp.data;
}


// =======================================
// Exportar TODO
// =======================================

module.exports = {
  // vehículos (público + admin)
  getVehiculos,
  getVehiculoPorId,
  crearVehiculo,
  actualizarVehiculo,
  eliminarVehiculo,
  getCategoriasVehiculo,
  getSucursales,
  getPromociones,

  // usuarios (login / registro público)
  obtenerUsuarios,
  loginUsuarioPorListado,
  registrarUsuario,

  // usuarios (CRUD admin)
  getUsuarios,
  getUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,

  // categorías / transmisiones
  getTransmisiones,

  // carrito
  agregarItemCarrito,
  obtenerDetalleCarrito,
  getCarritoPorUsuario,
  eliminarItemCarrito,

  // reservas (público + admin)
  crearReserva,
  getReservasPorUsuario,
  getReservaPorId,
  getReservas,
  actualizarReserva,
  eliminarReserva,

  // reservas / facturas admin
  getReservasAdmin,
  crearReservaAdmin,
  actualizarReservaAdmin,
  eliminarReservaAdmin,
  cambiarEstadoReserva,
  actualizarEstadoReserva,

  // pagos
  registrarPagoReserva,
  getPagosPorReserva,

  // facturas
  getFacturasAdmin,
  getFacturaPorId,
  crearFacturaAdmin,
  crearFacturaDesdeReserva,
  actualizarFacturaAdmin,
  eliminarFacturaAdmin
};
