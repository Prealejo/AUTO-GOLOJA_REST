// src/services/auth.service.js
const BASE_URL = 'http://restgesstion.runasp.net/api/v1';

async function login(email, password) {
    const resp = await fetch(`${BASE_URL}/usuarios/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if (!resp.ok) {
        // puedes leer el texto si quieres más detalle
        const txt = await resp.text();
        throw new Error('Error al iniciar sesión: ' + txt);
    }

    return resp.json(); // aquí esperamos que venga el usuario
}

async function registrarUsuario(datos) {
    const resp = await fetch(`${BASE_URL}/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
    });

    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error('Error al registrar usuario: ' + txt);
    }

    return resp.json();
}

module.exports = {
    login,
    registrarUsuario
};
