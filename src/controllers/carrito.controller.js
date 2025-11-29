// src/controllers/carrito.controller.js

const apiClient = require('../services/apiClientRest');

// =======================
// Ver carrito
// =======================
const verCarrito = async (req, res) => {
  if (!req.session.usuario) {
    return res.render('auth/login', {
      titulo: 'Iniciar sesión',
      error: null,
      mensajeInfo: 'Inicia sesion para ver tu carrito.',
      returnUrl: '/carrito'
    });
  }

  let carritoId = req.session.carritoId || null;
  const usuario = req.session.usuario;

  try {
    // 1) Si no tengo carritoId en sesion, lo busco en la API por usuario
    if (!carritoId && usuario) {
      const idUsuario =
        usuario.id ||
        usuario.IdUsuario ||
        usuario.idUsuario ||
        usuario.Id;

      if (idUsuario) {
        const dataCarrito = await apiClient.getCarritoPorUsuario(idUsuario);
        if (dataCarrito) {
          carritoId =
            dataCarrito.idCarrito ||
            dataCarrito.IdCarrito ||
            carritoId;

          if (carritoId) {
            req.session.carritoId = carritoId;
          }
        }
      }
    }

    // 2) Si tengo carritoId, pido el detalle
    let items = [];
    let total = 0;

    if (carritoId) {
      const detalle = await apiClient.obtenerDetalleCarrito(carritoId);

      items = Array.isArray(detalle)
        ? detalle
        : detalle.items || detalle.Items || [];

      total = items.reduce((acc, it) => {
        const sub =
          it.subtotal ??
          it.Subtotal ??
          it.totalItem ??
          0;
        return acc + Number(sub);
      }, 0);
    }

    return res.render('carrito/index', {
      titulo: 'Tu carrito',
      items,
      total,
      error: null
    });
  } catch (err) {
    console.error('Error al ver carrito:', err);
    return res.status(500).render('carrito/index', {
      titulo: 'Tu carrito',
      items: [],
      total: 0,
      error: 'No se pudo cargar el carrito.'
    });
  }
};

// =======================
// Agregar item al carrito
// =======================
const agregarItem = async (req, res) => {
  // 0) Si no está logueado, devolvemos 401 para que el front redirija
  if (!req.session.usuario) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Inicia sesion para agregar vehiculos al carrito.',
      redirectTo: '/login?from=carrito&returnUrl=/vehiculos'
    });
  }

  let { idVehiculo, fechaInicio, fechaFin } = req.body;

  if (!idVehiculo || !fechaInicio || !fechaFin) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Faltan datos obligatorios (vehiculo y fechas).'
    });
  }

  // Normalizamos datos
  const idVehiculoNum = parseInt(idVehiculo, 10);
  fechaInicio = String(fechaInicio).substring(0, 10); // YYYY-MM-DD
  fechaFin = String(fechaFin).substring(0, 10);       // YYYY-MM-DD

  const usuario = req.session.usuario;
  const idUsuario =
    usuario.id ||
    usuario.IdUsuario ||
    usuario.idUsuario ||
    usuario.Id;

  try {
    // =====================================================
    // 1) Evitar duplicados y solapes de fechas
    // =====================================================
    let carritoId = req.session.carritoId || null;

    // Si no tengo carritoId en sesión, intento buscarlo por usuario (igual que en verCarrito)
    if (!carritoId && idUsuario) {
      try {
        const dataCarrito = await apiClient.getCarritoPorUsuario(idUsuario);
        if (dataCarrito) {
          carritoId =
            dataCarrito.idCarrito ||
            dataCarrito.IdCarrito ||
            carritoId;

          if (carritoId) {
            req.session.carritoId = carritoId;
          }
        }
      } catch (e) {
        console.error(
          'Error buscando carrito por usuario (prevalidacion):',
          e.response?.data || e.message
        );
      }
    }

    if (carritoId) {
      try {
        const detalle = await apiClient.obtenerDetalleCarrito(carritoId);

        const items = Array.isArray(detalle)
          ? detalle
          : detalle.items || detalle.Items || [];

        const yaExiste = items.some((it) => {
          const vehId =
            it.IdVehiculo ||
            it.idVehiculo ||
            it.VehiculoId ||
            it.id_vehiculo ||
            it.vehiculoId;

          const ini = (
            it.FechaInicio ||
            it.fechaInicio ||
            it.fecha_inicio ||
            it.FechaInicioReserva ||
            it.fechaInicioReserva ||
            ''
          ).toString().substring(0, 10); // YYYY-MM-DD

          const fin = (
            it.FechaFin ||
            it.fechaFin ||
            it.fecha_fin ||
            it.FechaFinReserva ||
            it.fechaFinReserva ||
            ''
          ).toString().substring(0, 10); // YYYY-MM-DD

          // Rango existente: [ini, fin]
          // Rango nuevo:     [fechaInicio, fechaFin]
          //
          // Hay solape SI NO se cumple:
          //   nuevoFin < ini  (nuevo entero antes)
          //   ó
          //   nuevoInicio > fin (nuevo empieza después)
          //
          // Usamos comparación de strings porque todas son YYYY-MM-DD.
          const seSolapan = !(
            fechaFin < ini || fechaInicio > fin
          );

          return Number(vehId) === idVehiculoNum && seSolapan;
        });

        if (yaExiste) {
          return res.status(400).json({
            ok: false,
            mensaje:
              'Ya tienes este vehiculo en tu carrito en fechas que se cruzan con las seleccionadas.'
          });
        }
      } catch (e) {
        console.error(
          'Error revisando items del carrito antes de agregar:',
          e.response?.data || e.message
        );
        // Si falla esta validación, no bloqueamos el flujo: dejamos que la API decida
      }
    }

    // ====================================
    // 2) Llamar a la API para agregar item
    // ====================================
    const resultado = await apiClient.agregarItemCarrito({
      idUsuario,
      idVehiculo: idVehiculoNum,
      fechaInicio,
      fechaFin
    });

    // Actualizar / guardar carritoId en sesión
    let nuevoCarritoId = req.session.carritoId || null;

    if (resultado) {
      if (typeof resultado === 'number') {
        nuevoCarritoId = resultado;
      } else {
        nuevoCarritoId =
          resultado.idCarrito ||
          resultado.IdCarrito ||
          resultado.carritoId ||
          resultado.CarritoId ||
          nuevoCarritoId;
      }
    }

    if (nuevoCarritoId) {
      req.session.carritoId = nuevoCarritoId;
    }

    return res.json({
      ok: true,
      mensaje: 'Vehiculo agregado al carrito correctamente.',
      carritoId: nuevoCarritoId
    });
  } catch (err) {
    console.error(
      'Error al agregar al carrito:',
      err.response?.data || err.message
    );

    // Mensaje "bonito" según lo que devuelva la API
    let mensaje =
      'No se pudo agregar el vehiculo al carrito. Intentalo nuevamente.';

    const dataErr = err.response?.data;
    if (dataErr) {
      const texto = JSON.stringify(dataErr).toLowerCase();

      if (texto.includes('no esta disponible') || texto.includes('no está disponible')) {
        mensaje =
          'Ese vehiculo no esta disponible en las fechas seleccionadas. Prueba con otras fechas.';
      } else if (texto.includes('mantenimiento')) {
        mensaje =
          'Ese vehiculo esta en mantenimiento para esas fechas.';
      } else if (
        texto.includes('datos invalidos') ||
        texto.includes('datos inválidos') ||
        texto.includes('modelo invalido')
      ) {
        mensaje =
          'Los datos de la reserva no son validos. Revisa las fechas seleccionadas.';
      }
    }

    return res.status(400).json({
      ok: false,
      mensaje
    });
  }
};

// =======================
// Eliminar item del carrito
// =======================
const eliminarItem = async (req, res) => {
  // Si no esta logueado, lo mandamos al login
  if (!req.session.usuario) {
    return res.redirect('/login?returnUrl=/carrito');
  }

  // El id puede venir como :id, :itemId, :idItem (segun como este en la ruta)
  const rawId = req.params.id || req.params.itemId || req.params.idItem;
  const idItem = parseInt(rawId, 10);

  if (!idItem || Number.isNaN(idItem)) {
    console.warn('eliminarItem: id de item no valido:', rawId);
    return res.redirect('/carrito');
  }

  try {
    if (typeof apiClient.eliminarItemCarrito === 'function') {
      await apiClient.eliminarItemCarrito(idItem);
    } else if (typeof apiClient.eliminarDelCarrito === 'function') {
      await apiClient.eliminarDelCarrito(idItem);
    } else {
      console.error(
        'No se encontro un metodo de eliminacion en apiClient (eliminarItemCarrito / eliminarDelCarrito).'
      );
    }
  } catch (err) {
    console.error(
      'Error al eliminar item del carrito:',
      err.response?.data || err.message
    );
  }

  return res.redirect('/carrito');
};

// =======================
// Generar reserva(s) desde el carrito
// - Crea reservas en la API (estado Pendiente)
// - Vacía el carrito
// - Muestra la vista de resumen
// =======================
const generarReserva = async (req, res) => {
  if (!req.session.usuario) {
    return res.redirect('/login?returnUrl=/carrito');
  }

  let carritoId = req.session.carritoId || null;
  const usuario = req.session.usuario;
  const idUsuario =
    usuario.id ||
    usuario.IdUsuario ||
    usuario.idUsuario ||
    usuario.Id;

  try {
    // 1) Asegurarnos de tener carritoId
    if (!carritoId && idUsuario) {
      const dataCarrito = await apiClient.getCarritoPorUsuario(idUsuario);
      if (dataCarrito) {
        carritoId =
          dataCarrito.idCarrito ||
          dataCarrito.IdCarrito ||
          null;

        if (carritoId) {
          req.session.carritoId = carritoId;
        }
      }
    }

    if (!carritoId) {
      return res.render('carrito/index', {
        titulo: 'Tu carrito',
        items: [],
        total: 0,
        error: 'Tu carrito esta vacio.',
        usuario: req.session.usuario
      });
    }

    // 2) Traer items del carrito
    const detalle = await apiClient.obtenerDetalleCarrito(carritoId);

    const items = Array.isArray(detalle)
      ? detalle
      : detalle.items || detalle.Items || [];

    if (!items.length) {
      return res.render('carrito/index', {
        titulo: 'Tu carrito',
        items: [],
        total: 0,
        error: 'Tu carrito esta vacio.',
        usuario: req.session.usuario
      });
    }

    // 3) Datos del usuario
    const nombreUsuario = (
      (usuario.nombre || usuario.Nombre || usuario.nombres || usuario.Nombres || '') +
      ' ' +
      (usuario.apellido || usuario.Apellido || usuario.apellidos || usuario.Apellidos || '')
    ).trim();

    const correoUsuario =
      usuario.email ||
      usuario.Email ||
      usuario.correo ||
      usuario.Correo ||
      null;

    const reservasCreadas = [];

    // 4) Crear una reserva por cada item del carrito
    for (const it of items) {
      const idVehiculo =
        it.IdVehiculo ||
        it.idVehiculo ||
        it.vehiculoId ||
        it.id_vehiculo;

      const fechaInicio = (
        it.FechaInicio ||
        it.fechaInicio ||
        it.fecha_inicio ||
        ''
      ).toString();

      const fechaFin = (
        it.FechaFin ||
        it.fechaFin ||
        it.fecha_fin ||
        ''
      ).toString();

      const subtotal = it.Subtotal ?? it.subtotal ?? 0;

      const reservaDto = {
        IdUsuario: idUsuario,
        NombreUsuario: nombreUsuario || null,
        CorreoUsuario: correoUsuario || null,
        UsuarioCorreo: correoUsuario || null,
        IdVehiculo: idVehiculo,
        VehiculoNombre: it.VehiculoNombre || it.vehiculoNombre || it.Modelo || null,
        FechaInicio: fechaInicio,
        FechaFin: fechaFin,
        Total: subtotal,
        Estado: 'Pendiente',
        FechaReserva: new Date().toISOString()
      };

      try {
        // OJO: aquí solo “desenvolvemos” lo que devuelve la API,
        // sin tocar apiClientRest.
        const rawReserva = await apiClient.crearReserva(reservaDto);

        const reservaCreada =
          rawReserva?.data ||   // { data: { ... } }
          rawReserva?.reserva ||
          rawReserva?.Reserva ||
          rawReserva;           // plano { ... }

        reservasCreadas.push(reservaCreada);
      } catch (e) {
        console.error('Error creando reserva para item del carrito:', e.response?.data || e.message);
      }

      // Borrar item del carrito
      const idItem =
        it.IdItem ||
        it.idItem ||
        it.id ||
        it.ID_ITEM;

      if (idItem) {
        try {
          if (typeof apiClient.eliminarItemCarrito === 'function') {
            await apiClient.eliminarItemCarrito(idItem);
          } else if (typeof apiClient.eliminarDelCarrito === 'function') {
            await apiClient.eliminarDelCarrito(idItem);
          }
        } catch (e) {
          console.error('Error borrando item del carrito:', e.response?.data || e.message);
        }
      }
    }

    // 5) Limpiar carrito en la sesión
    req.session.carritoId = null;

    // 6) Calcular total con las reservas “planas”
    const totalReservas = reservasCreadas.reduce((acc, r) => {
      const t = Number(r.Total ?? r.total ?? 0);
      return acc + (Number.isNaN(t) ? 0 : t);
    }, 0);

    // Por ahora, después de generar, te mando a "Mis reservas".
    // Si quieres, luego lo cambiamos para redirigir al detalle de la última.
    return res.redirect('/reservas');

  } catch (err) {
    console.error('Error al generar reservas desde el carrito:', err.response?.data || err.message);

    return res.status(500).render('carrito/index', {
      titulo: 'Tu carrito',
      items: [],
      total: 0,
      error: 'No se pudo generar la reserva.',
      usuario: req.session.usuario
    });
  }
};

module.exports = {
  verCarrito,
  agregarItem,
  eliminarItem,
  generarReserva
};
