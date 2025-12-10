// src/controllers/reservas.controller.js
const apiClient = require('../services/apiClientRest');
const bancoClient = require('../services/bancoClient');

// ===============================
// Helper: arma modelo de montos
// ===============================
function armarModeloReserva(reserva, usuarioSesion) {
  const u = usuarioSesion || {};

  const subtotal = Number(reserva.Total || reserva.total || 0);

  const taxRate = 0.08875;
  const iva = +(subtotal * taxRate).toFixed(2);
  const totalConIva = +(subtotal + iva).toFixed(2);

  const fIniRaw = reserva.FechaInicio || reserva.fechaInicio;
  const fFinRaw = reserva.FechaFin || reserva.fechaFin;

  let dias = 1;
  if (fIniRaw && fFinRaw) {
    const fIni = new Date(fIniRaw);
    const fFin = new Date(fFinRaw);
    const diffMs = fFin - fIni;
    const diffDias = diffMs / (1000 * 60 * 60 * 24);
    dias = diffDias > 0 ? Math.round(diffDias) : 1;
  }

  const precioDia = dias > 0 ? +(subtotal / dias).toFixed(2) : subtotal;

  const clienteNombre =
    (reserva.NombreUsuario || reserva.nombreUsuario || '').trim() ||
    `${(u.Nombre || u.nombre || '').trim()} ${(u.Apellido || u.apellido || '').trim()}`.trim();

  const clienteCorreo =
    reserva.CorreoUsuario ||
    reserva.UsuarioCorreo ||
    reserva.correoUsuario ||
    u.Email ||
    u.email ||
    u.Correo ||
    u.correo ||
    '';

  return {
    subtotal,
    iva,
    totalConIva,
    precioDia,
    clienteNombre,
    clienteCorreo
  };
}

// ===============================
// GET /reservas
// ===============================
async function listarMisReservas(req, res) {
  if (!req.session.usuario) {
    return res.redirect('/login?returnUrl=/reservas');
  }

  const usuario = req.session.usuario;
  const idUsuario =
    usuario.id ||
    usuario.IdUsuario ||
    usuario.idUsuario ||
    usuario.Id;

  try {
    const data = await apiClient.getReservasPorUsuario(idUsuario);

    const reservasRaw = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : [];

    const infoPagos = req.session.infoPagos || {};

    const reservas = reservasRaw.map((r) => {
      const id = r.IdReserva || r.idReserva || r.id;
      const pago = infoPagos[String(id)];
      if (pago) {
        return {
          ...r,
          Estado: r.Estado || r.estado || 'Confirmada',
          estado: r.Estado || r.estado || 'Confirmada'
        };
      }
      return r;
    });

    const mensaje = req.session.mensajeReservas || null;
    req.session.mensajeReservas = null;

    return res.render('reservas/index', {
      titulo: 'Mis reservas',
      reservas,
      usuario,
      error: null,
      mensaje
    });
  } catch (err) {
    console.error(
      'Error al obtener reservas del usuario:',
      err.response?.data || err.message
    );

    return res.render('reservas/index', {
      titulo: 'Mis reservas',
      reservas: [],
      usuario,
      error: 'No se pudieron cargar tus reservas.',
      mensaje: null
    });
  }
}

// ===============================
// GET /reservas/:id
// ===============================
async function verDetalleReserva(req, res) {
  if (!req.session.usuario) {
    return res.redirect('/login?returnUrl=/reservas');
  }

  const idReserva = parseInt(req.params.id, 10);
  if (!idReserva || Number.isNaN(idReserva)) {
    return res.redirect('/reservas');
  }

  try {
    const data = await apiClient.getReservaPorId(idReserva);
    const reserva = data?.data || data;

    if (!reserva) {
      return res.redirect('/reservas');
    }

    const modelo = armarModeloReserva(reserva, req.session.usuario);

    // 1) Leer info de pago (sesión + WS_Pagos)
    let infoPagos = req.session.infoPagos || {};
    let infoPago = infoPagos[String(idReserva)] || null;

    if (!infoPago) {
      try {
        const pagos = await apiClient.getPagosPorReserva(idReserva);
        if (pagos && pagos.length) {
          const ultimo = pagos[pagos.length - 1];

          infoPago = {
            transaccionId: ultimo.IdPago || ultimo.idPago || null,
            cuentaOrigen:
              ultimo.CuentaCliente ||
              ultimo.cuentaCliente ||
              ultimo.cuenta_origen ||
              ultimo.ReferenciaExterna ||
              ultimo.referencia_externa ||
              ultimo.referenciaExterna ||
              null,
            cuentaDestino:
              ultimo.CuentaComercio ||
              ultimo.cuentaComercio ||
              ultimo.cuenta_destino ||
              null,
            monto: Number(ultimo.Monto || ultimo.monto || 0),
            fecha:
              ultimo.FechaPago ||
              ultimo.fecha_pago ||
              ultimo.fechaPago ||
              null
          };

          if (!req.session.infoPagos) req.session.infoPagos = {};
          req.session.infoPagos[String(idReserva)] = infoPago;
        }
      } catch (errPagos) {
        console.error(
          'No se pudo recuperar pago desde Rest:',
          errPagos.message || errPagos
        );
      }
    }

    let estadoReserva =
      reserva.Estado ||
      reserva.estado ||
      (infoPago ? 'Confirmada' : 'Pendiente');

    const estadoLower = (estadoReserva || '').toLowerCase();

    // Si ya está cancelada, no dejar ver detalle
    if (estadoLower === 'cancelada') {
      req.session.mensajeReservas = 'Esta reserva ya está cancelada.';
      return res.redirect('/reservas');
    }

    // 2) Intentar obtener la URL de la factura
    let facturaUrl = infoPago?.uriFactura || null;

    if (!facturaUrl) {
      try {
        const facturas = await apiClient.getFacturasAdmin();
        const match = facturas.find(
          (f) => Number(f.IdReserva || f.id_reserva) === Number(idReserva)
        );

        if (match) {
          facturaUrl = match.UriFactura || match.uri_factura || null;

          if (facturaUrl) {
            if (!req.session.infoPagos) req.session.infoPagos = {};
            if (!req.session.infoPagos[String(idReserva)]) {
              req.session.infoPagos[String(idReserva)] = {};
            }
            req.session.infoPagos[String(idReserva)].uriFactura = facturaUrl;
          }
        }
      } catch (errFacturas) {
        console.error(
          'No se pudo recuperar la factura para la reserva:',
          errFacturas.message || errFacturas
        );
      }
    }

    return res.render('reservas/detalle', {
      titulo: 'Resumen de tu reserva',
      reserva,
      precioDia: modelo.precioDia,
      subtotal: modelo.subtotal,
      iva: modelo.iva,
      totalConIva: modelo.totalConIva,
      clienteNombre: modelo.clienteNombre,
      clienteCorreo: modelo.clienteCorreo,
      usuario: req.session.usuario,
      estadoReserva,
      infoPago,
      facturaUrl,
      mensajePago: null,
      errorPago: null
    });
  } catch (err) {
    console.error(
      'Error al obtener detalle de reserva:',
      err.response?.data || err.message
    );
    return res.redirect('/reservas');
  }
}

// =======================================
// POST /reservas/:id/pagar
// =======================================
async function pagarReserva(req, res) {
  if (!req.session.usuario) {
    return res.redirect('/login?returnUrl=/reservas');
  }

  const idReserva = parseInt(req.params.id, 10);
  const cedula = (req.body.cedula || '').trim();

  if (!idReserva || Number.isNaN(idReserva)) {
    return res.redirect('/reservas');
  }

  try {
    const data = await apiClient.getReservaPorId(idReserva);
    const reserva = data?.data || data;

    if (!reserva) {
      return res.redirect('/reservas');
    }

    const modelo = armarModeloReserva(reserva, req.session.usuario);

    const estadoActual =
      (reserva.Estado || reserva.estado || '').toString().toLowerCase();

    // Si la reserva ya está cancelada, no permitir pagar
    if (estadoActual === 'cancelada') {
      req.session.mensajeReservas =
        'Esta reserva está cancelada, no se puede realizar el pago.';
      return res.redirect('/reservas');
    }

    if (!cedula) {
      const infoPagos = req.session.infoPagos || {};
      const infoPago = infoPagos[String(idReserva)] || null;
      const estadoReserva = infoPago
        ? 'Confirmada'
        : reserva.Estado || reserva.estado || 'Pendiente';

      return res.render('reservas/detalle', {
        titulo: 'Resumen de tu reserva',
        reserva,
        precioDia: modelo.precioDia,
        subtotal: modelo.subtotal,
        iva: modelo.iva,
        totalConIva: modelo.totalConIva,
        clienteNombre: modelo.clienteNombre,
        clienteCorreo: modelo.clienteCorreo,
        usuario: req.session.usuario,
        estadoReserva,
        infoPago,
        mensajePago: null,
        errorPago: 'Ingresa tu número de cédula para realizar el pago.'
      });
    }

    // 2) Buscar cuentas del cliente en MiBanca
    const cuentasCliente = await bancoClient.obtenerCuentasPorCliente(cedula);
    const listaCliente = Array.isArray(cuentasCliente) ? cuentasCliente : [];

    if (!listaCliente.length) {
      const infoPagos = req.session.infoPagos || {};
      const infoPago = infoPagos[String(idReserva)] || null;
      const estadoReserva = infoPago
        ? 'Confirmada'
        : reserva.Estado || reserva.estado || 'Pendiente';

      return res.render('reservas/detalle', {
        titulo: 'Resumen de tu reserva',
        reserva,
        precioDia: modelo.precioDia,
        subtotal: modelo.subtotal,
        iva: modelo.iva,
        totalConIva: modelo.totalConIva,
        clienteNombre: modelo.clienteNombre,
        clienteCorreo: modelo.clienteCorreo,
        usuario: req.session.usuario,
        estadoReserva,
        infoPago,
        mensajePago: null,
        errorPago:
          'No se encontró ninguna cuenta. Contáctese con el soporte de su banco.'
      });
    }

    const cuentaCli = listaCliente[0];
    const cuentaOrigen = Number(cuentaCli.cuenta_id);

    // 3) Cuenta de la empresa (comercio)
    const cuentasEmpresa = await bancoClient.obtenerCuentasPorCliente(
      bancoClient.EMPRESA_CEDULA
    );
    const listaEmp = Array.isArray(cuentasEmpresa) ? cuentasEmpresa : [];

    if (!listaEmp.length) {
      const infoPagos = req.session.infoPagos || {};
      const infoPago = infoPagos[String(idReserva)] || null;
      const estadoReserva = infoPago
        ? 'Confirmada'
        : reserva.Estado || reserva.estado || 'Pendiente';

      return res.render('reservas/detalle', {
        titulo: 'Resumen de tu reserva',
        reserva,
        precioDia: modelo.precioDia,
        subtotal: modelo.subtotal,
        iva: modelo.iva,
        totalConIva: modelo.totalConIva,
        clienteNombre: modelo.clienteNombre,
        clienteCorreo: modelo.clienteCorreo,
        usuario: req.session.usuario,
        estadoReserva,
        infoPago,
        mensajePago: null,
        errorPago: 'No se encontró la cuenta de la empresa en MiBanca.'
      });
    }

    const cuentaEmp = listaEmp[0];
    const cuentaDestino = Number(cuentaEmp.cuenta_id);

    // 4) Crear transacción en MiBanca
    const transaccion = await bancoClient.crearTransaccion({
      cuentaOrigen,
      cuentaDestino,
      monto: modelo.totalConIva,
      tipoTransaccion: `Pago reserva UrbanDrive #${idReserva}`
    });

    // 4.1) Registrar pago en WS_Pagos (BD interna)
    try {
      // Guardamos la cuenta del cliente en referencia_externa
      const pagoBody = {
        IdReserva: idReserva,
        Metodo: 'Transaccion',
        Monto: modelo.totalConIva,
        ReferenciaExterna: String(cuentaOrigen),
        Estado: 'Exitoso'
      };

      console.log('[pagarReserva] Llamando a REST_Pagos.CrearPago...');
      console.log('[REST_Pagos] Request CrearPago:', pagoBody);

      const pagoResp = await apiClient.registrarPagoReserva(pagoBody);

      console.log('[REST_Pagos] Respuesta CrearPago:', pagoResp);
    } catch (errPago) {
      console.error(
        'Error registrando pago en Rest:',
        errPago.message || errPago
      );
    }

    // 4.2) Cambiar estado de la reserva a CONFIRMADA
    try {
      await apiClient.actualizarEstadoReserva(idReserva, 'Confirmada');
    } catch (errEstado) {
      console.error(
        'Error actualizando estado de reserva en WS_RentaAutos:',
        errEstado.message || errEstado
      );
    }

    // 4.3) Crear FACTURA en el WS
    let idFacturaCreada = null;
    let facturaCreada = null;

    try {
      const usuarioSesion = req.session.usuario || {};
      const idUsuario =
        usuarioSesion.idUsuario ||
        usuarioSesion.IdUsuario ||
        usuarioSesion.id ||
        usuarioSesion.Id ||
        null;

      const facturaDto = {
        IdFactura: 0,
        IdReserva: idReserva,
        IdUsuario: idUsuario,
        UriFactura: null,
        FechaEmision: new Date().toISOString(),
        ValorTotal: modelo.totalConIva,
        Descripcion: `Factura reserva #${idReserva} - UrbanDrive NY`
      };

      idFacturaCreada = await apiClient.crearFacturaDesdeReserva(facturaDto);

      if (idFacturaCreada) {
        facturaCreada = await apiClient.getFacturaPorId(idFacturaCreada);
      }
    } catch (errFactura) {
      console.error(
        'Error al crear factura en WS_Factura:',
        errFactura.message || errFactura
      );
    }

    // 5) Guardar info del pago en sesión
    if (!req.session.infoPagos) {
      req.session.infoPagos = {};
    }

    req.session.infoPagos[String(idReserva)] = {
      transaccionId: transaccion?.transaccion_id || transaccion?.id || null,
      cuentaOrigen,
      cuentaDestino,
      monto: modelo.totalConIva,
      fecha: transaccion?.fecha_transaccion || new Date().toISOString(),
      cedula,
      idFactura: idFacturaCreada,
      uriFactura:
        facturaCreada?.UriFactura ||
        facturaCreada?.uri_factura ||
        null
    };

    req.session.mensajeReservas = 'Pago realizado correctamente en MiBanca.';

    return res.redirect('/reservas');
  } catch (err) {
    console.error(
      'Error al procesar pago en MiBanca:',
      err.response?.data || err.message
    );

    try {
      const data = await apiClient.getReservaPorId(idReserva);
      const reserva = data?.data || data;
      const modelo = armarModeloReserva(reserva, req.session.usuario);

      const infoPagos = req.session.infoPagos || {};
      const infoPago = infoPagos[String(idReserva)] || null;
      const estadoReserva = infoPago
        ? 'Confirmada'
        : reserva.Estado || reserva.estado || 'Pendiente';

      return res.render('reservas/detalle', {
        titulo: 'Resumen de tu reserva',
        reserva,
        precioDia: modelo.precioDia,
        subtotal: modelo.subtotal,
        iva: modelo.iva,
        totalConIva: modelo.totalConIva,
        clienteNombre: modelo.clienteNombre,
        clienteCorreo: modelo.clienteCorreo,
        usuario: req.session.usuario,
        estadoReserva,
        infoPago,
        mensajePago: null,
        errorPago: 'No se pudo completar el pago. Intenta nuevamente.'
      });
    } catch {
      return res.redirect('/reservas');
    }
  }
}

// =======================================
// POST /reservas/:id/cancelar
// =======================================
async function cancelarReserva(req, res) {
  if (!req.session.usuario) {
    return res.redirect('/login?returnUrl=/reservas');
  }

  const idReserva = parseInt(req.params.id, 10);
  if (!idReserva || Number.isNaN(idReserva)) {
    return res.redirect('/reservas');
  }

  try {
    const data = await apiClient.getReservaPorId(idReserva);
    const reserva = data?.data || data;

    if (!reserva) {
      req.session.mensajeReservas = 'No se encontró la reserva.';
      return res.redirect('/reservas');
    }

    const estado =
      (reserva.Estado || reserva.estado || '').toString().toLowerCase();

    if (estado === 'cancelada') {
      req.session.mensajeReservas = 'La reserva ya está cancelada.';
      return res.redirect('/reservas');
    }

    // ============ CASO 1: PENDIENTE ==============
    if (estado === 'pendiente') {
      try {
        await apiClient.actualizarEstadoReserva(idReserva, 'Cancelada');
      } catch (e) {
        console.error('Error cancelando reserva pendiente:', e.message || e);
        req.session.mensajeReservas =
          'No se pudo cancelar la reserva. Intenta nuevamente.';
        return res.redirect('/reservas');
      }

      req.session.mensajeReservas = 'Reserva cancelada correctamente.';
      return res.redirect('/reservas');
    }

    // ============ CASO 2: CONFIRMADA ==============
    if (estado === 'confirmada') {
      // 2) Buscar último pago de esa reserva
      let pagos = [];
      try {
        const respPagos = await apiClient.getPagosPorReserva(idReserva);
        pagos = Array.isArray(respPagos?.data)
          ? respPagos.data
          : Array.isArray(respPagos)
          ? respPagos
          : [];
      } catch (e) {
        console.error(
          'Error REST getPagosPorReserva en cancelar:',
          e.message || e
        );
      }

      if (!pagos.length) {
        req.session.mensajeReservas =
          'No se encontró ningún pago para esta reserva. No se puede hacer reembolso.';
        return res.redirect('/reservas');
      }

      const ultimo = pagos[pagos.length - 1];

      // cuenta del cliente guardada en referencia_externa
      const cuentaCliente = Number(
        ultimo.ReferenciaExterna ||
          ultimo.referencia_externa ||
          ultimo.referenciaExterna ||
          0
      );

      const monto = Number(ultimo.Monto || ultimo.monto || 0);

      if (!cuentaCliente || !monto) {
        req.session.mensajeReservas =
          'No se pudo determinar la información del pago. No se realizó el reembolso.';
        return res.redirect('/reservas');
      }

      // Cuenta del comercio: siempre la misma, la obtenemos por EMPRESA_CEDULA
      let cuentaComercio = 0;
      try {
        const cuentasEmpresa = await bancoClient.obtenerCuentasPorCliente(
          bancoClient.EMPRESA_CEDULA
        );
        const listaEmp = Array.isArray(cuentasEmpresa) ? cuentasEmpresa : [];
        if (!listaEmp.length) {
          req.session.mensajeReservas =
            'No se encontró la cuenta de la empresa para hacer el reembolso.';
          return res.redirect('/reservas');
        }
        cuentaComercio = Number(listaEmp[0].cuenta_id);
      } catch (e) {
        console.error(
          'Error obteniendo cuenta de empresa para reembolso:',
          e.message || e
        );
        req.session.mensajeReservas =
          'No se pudo obtener la cuenta de la empresa. No se realizó el reembolso.';
        return res.redirect('/reservas');
      }

      // 3) Hacer transacción inversa en MiBanca (reembolso)
      let refundOk = false;
      try {
        const trx = await bancoClient.crearTransaccion({
          cuentaOrigen: cuentaComercio, // comercio devuelve el dinero
          cuentaDestino: cuentaCliente, // cliente recibe el reembolso
          monto,
          tipoTransaccion: `Reembolso reserva UrbanDrive #${idReserva}`
        });

        const respuesta =
          trx?.respuesta ||
          trx?.respuestaBanco ||
          trx?.status ||
          trx;

        refundOk = respuesta === 'OK' || respuesta === true;
      } catch (e) {
        console.error('Error al hacer reembolso en MiBanca:', e.message || e);
      }

      if (!refundOk) {
        req.session.mensajeReservas =
          'No se pudo realizar el reembolso. La reserva sigue activa.';
        return res.redirect(`/reservas/${idReserva}`);
      }

      // 4) Marcar reserva como Cancelada
      try {
        await apiClient.actualizarEstadoReserva(idReserva, 'Cancelada');
      } catch (e) {
        console.error(
          'Error al cancelar reserva luego del reembolso:',
          e.message || e
        );
        req.session.mensajeReservas =
          'Se realizó el reembolso, pero no se pudo cancelar la reserva. Revisa con soporte.';
        return res.redirect(`/reservas/${idReserva}`);
      }

      req.session.mensajeReservas =
        'Reserva cancelada y reembolso realizado correctamente.';
      return res.redirect('/reservas');
    }

    // Otros estados
    req.session.mensajeReservas =
      'Solo se pueden cancelar reservas Pendientes o Confirmadas.';
    return res.redirect('/reservas');
  } catch (err) {
    console.error(
      'Error general al cancelar reserva:',
      err.response?.data || err.message
    );
    req.session.mensajeReservas =
      'No se pudo cancelar la reserva. Intenta nuevamente.';
    return res.redirect('/reservas');
  }
}

module.exports = {
  listarMisReservas,
  verDetalleReserva,
  pagarReserva,
  cancelarReserva
};
