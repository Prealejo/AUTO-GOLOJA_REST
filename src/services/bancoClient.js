// src/services/bancoClient.js
const axios = require('axios');

// Base de MiBanca (según el Help)
const BANCO_API_BASE_URL = 'http://mibanca.runasp.net/api';

// Cedula del “cliente empresa” (la que termina en 02)
const EMPRESA_CEDULA = process.env.BANCO_EMPRESA_CEDULA || '1725985302';

const bancoApi = axios.create({
  baseURL: BANCO_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  },
  timeout: 5000
});

// ================================
// GET api/Cuentas/cliente/{cliID}
// cliID = cedula del cliente
// ================================
async function obtenerCuentasPorCliente(cliId) {
  try {
    const resp = await bancoApi.get(
      `/Cuentas/cliente/${encodeURIComponent(cliId)}`
    );
    const data = resp.data;

    if (Array.isArray(data)) return data;
    if (!data) return [];
    return [data];
  } catch (err) {
    console.error(
      'Error al consultar cuentas en MiBanca:',
      err.response?.data || err.message
    );
    throw err;
  }
}

// =====================
// POST api/Transacciones
// =====================
async function crearTransaccion({
  cuentaOrigen,
  cuentaDestino,
  monto,
  tipoTransaccion
}) {
  const body = {
    transaccion_id: 0, // la BD lo puede ignorar/autonumerar
    cuenta_origen: cuentaOrigen,   // OJO: es el cuenta_id, no la cedula
    cuenta_destino: cuentaDestino, // cuenta_id de la empresa
    monto: Number(monto),
    tipo_transaccion: tipoTransaccion || 'Pago reserva UrbanDrive',
    fecha_transaccion: new Date().toISOString(),
    Cuentas: null,   // propiedades de navegación, no las usamos
    Cuentas1: null
  };

  try {
    const resp = await bancoApi.post('/Transacciones', body);
    return resp.data;
  } catch (err) {
    console.error(
      'Error al crear transaccion en MiBanca:',
      err.response?.data || err.message
    );
    throw err;
  }
}

module.exports = {
  obtenerCuentasPorCliente,
  crearTransaccion,
  EMPRESA_CEDULA
};
