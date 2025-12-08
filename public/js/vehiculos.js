document.addEventListener('DOMContentLoaded', function () {
    var modal = document.getElementById('vehiculo-modal');
    var closeBtn = document.getElementById('modalCloseBtn');

    var imgEl = document.getElementById('modalImg');
    var tituloEl = document.getElementById('modalTitulo');
    var precioEl = document.getElementById('modalPrecio');
    var categoriaEl = document.getElementById('modalCategoria');
    var transmisionEl = document.getElementById('modalTransmision');
    var capacidadEl = document.getElementById('modalCapacidad');
    var sucursalEl = document.getElementById('modalSucursal');
    var fechaInicioEl = document.getElementById('modalFechaInicio');
    var fechaFinEl = document.getElementById('modalFechaFin');

    var btnAgregar = document.getElementById('modalAgregarCarrito');

    // ============================
    // Helpers de fechas
    // ============================
    function formatearFecha(date) {
        var y = date.getFullYear();
        var m = String(date.getMonth() + 1).padStart(2, '0');
        var d = String(date.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    }

    function sumarDias(date, dias) {
        var copia = new Date(date.getTime());
        copia.setDate(copia.getDate() + dias);
        return copia;
    }

    function traducirTransmision(valor) {
        if (!valor) return '-';

        var t = valor.toString().toLowerCase().trim();

        if (t === 'mt' || t.includes('manual')) {
            return 'Manual';
        }

        if (t === 'at' || t.includes('autom')) {
            return 'Automática';
        }

        if (t === 'cvt') {
            return 'CVT (automática)';
        }

        return valor;
    }

    var fechaMinInicioStr = null; // se setea al abrir el modal

    function mostrarToastCarrito(mensaje) {
  const toast = document.getElementById('carrito-toast');
  const texto = document.getElementById('carrito-toast-text');
  if (!toast || !texto) return;

  texto.textContent = mensaje || 'Vehiculo agregado al carrito.';
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}


    function abrirModalDesdeCard(card) {
        var marca = card.getAttribute('data-marca') || '';
        var modelo = card.getAttribute('data-modelo') || '';
        var anio = card.getAttribute('data-anio') || '';
        var precio = card.getAttribute('data-precio') || '';
        var categoria = card.getAttribute('data-categoria') || '';
        var transmision = card.getAttribute('data-transmision') || '';
        var capacidad = card.getAttribute('data-capacidad') || '';
        var sucursal = card.getAttribute('data-sucursal') || '';
        var img = card.getAttribute('data-img') || '';
        var idVehiculo = card.getAttribute('data-id');

        // Guardamos el id del vehículo en el botón para usarlo al hacer clic
        btnAgregar.dataset.idVehiculo = idVehiculo;

        tituloEl.textContent = marca + ' ' + modelo + (anio ? ' (' + anio + ')' : '');
        if (precio) {
            precioEl.textContent = 'Desde $' + precio + ' / día';
        } else {
            precioEl.textContent = '';
        }

        categoriaEl.textContent = categoria || '-';
        transmisionEl.textContent = traducirTransmision(transmision);
        capacidadEl.textContent = capacidad ? capacidad + ' personas' : '-';
        sucursalEl.textContent = sucursal || '-';

        if (img) {
            imgEl.src = img;
            imgEl.style.display = 'block';
        } else {
            imgEl.style.display = 'none';
        }

        // ======== Reglas de fechas ========
        var hoy = new Date();
        var manana = sumarDias(hoy, 1);          // hoy + 1 día
        var minFin = sumarDias(manana, 1);       // inicio + 1 día (mínimo)

        fechaMinInicioStr = formatearFecha(manana);
        var minFinStr = formatearFecha(minFin);

        // setear mínimos
        fechaInicioEl.min = fechaMinInicioStr;
        fechaFinEl.min = minFinStr;

        // valores por defecto
        fechaInicioEl.value = fechaMinInicioStr;
        fechaFinEl.value = minFinStr;

        modal.classList.add('show');
    }

    // ============================
    // Eventos de cambio en fechas
    // ============================
    fechaInicioEl.addEventListener('change', function () {
        if (!fechaInicioEl.value) return;

        if (fechaInicioEl.value < fechaMinInicioStr) {
            alert('La fecha de inicio debe ser al menos el día siguiente: ' + fechaMinInicioStr);
            fechaInicioEl.value = fechaMinInicioStr;
        }

        var inicioDate = new Date(fechaInicioEl.value);
        var minFin = sumarDias(inicioDate, 1);
        var minFinStr = formatearFecha(minFin);

        fechaFinEl.min = minFinStr;

        if (!fechaFinEl.value || fechaFinEl.value < minFinStr) {
            fechaFinEl.value = minFinStr;
        }
    });

    fechaFinEl.addEventListener('change', function () {
        if (!fechaFinEl.value || !fechaInicioEl.value) return;

        var inicioDate = new Date(fechaInicioEl.value);
        var minFin = sumarDias(inicioDate, 1);
        var minFinStr = formatearFecha(minFin);

        if (fechaFinEl.value < minFinStr) {
            alert('La fecha de fin debe ser al menos un día después de la fecha de inicio.');
            fechaFinEl.value = minFinStr;
        }
    });

    // ============================
    // Click en cards -> abrir modal
    // ============================
    var cards = document.querySelectorAll('.btn-ver-detalle');
    cards.forEach(function (card) {
        card.addEventListener('click', function (e) {
            e.preventDefault();
            abrirModalDesdeCard(card);
        });
    });

    // ============================
    // Cerrar modal
    // ============================
    closeBtn.addEventListener('click', function () {
        modal.classList.remove('show');
    });

    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });

    // ============================
    // Botón "Agregar al carrito"
    // ============================
    btnAgregar.addEventListener('click', async function () {
        const idVehiculo = btnAgregar.dataset.idVehiculo;
        const inicioStr = fechaInicioEl.value;
        const finStr = fechaFinEl.value;

        if (!idVehiculo) {
            alert('No se pudo identificar el vehículo.');
            return;
        }

        if (!inicioStr || !finStr) {
            alert('Selecciona las fechas de inicio y fin.');
            return;
        }

        const inicio = new Date(inicioStr);
        const fin = new Date(finStr);

        if (fin <= inicio) {
            alert('La fecha de fin debe ser al menos un día después de la fecha de inicio.');
            return;
        }

        try {
            const resp = await fetch('/carrito/agregar', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  body: JSON.stringify({
    idVehiculo: idVehiculo,
    fechaInicio: inicioStr,
    fechaFin: finStr
  })
});

// 1) No logueado → ir al login con mensajito
if (resp.status === 401) {
  const data = await resp.json().catch(() => ({}));
  const redirectTo =
    (data && data.redirectTo) ||
    '/login?from=carrito&returnUrl=/vehiculos';
  window.location.href = redirectTo;
  return;
}

// 2) Error real de la API
// 2) Error real de la API (incluye el caso de duplicado)
if (!resp.ok) {
  const data = await resp.json().catch(() => ({}));
  console.error('Error al agregar al carrito:', data);
  mostrarToastCarrito(
    data.mensaje || 'No se pudo agregar el vehiculo al carrito.'
  );
  return;
}

// 3) Exito → cerramos modal y mostramos toast
const data = await resp.json().catch(() => ({}));
modal.classList.remove('show');
mostrarToastCarrito(data.mensaje || 'Vehiculo agregado al carrito.');

        } catch (err) {
            console.error(err);
            mostrarToastCarrito('Error al comunicarse con el servidor.');
        }

    });

   // ==========================
// Filtros: sliders de precio
// ==========================
const rangoMin = document.getElementById('precioMin');
const rangoMax = document.getElementById('precioMax');
const labelMin = document.getElementById('precioMinLabel');
const labelMax = document.getElementById('precioMaxLabel');

if (rangoMin && rangoMax && labelMin && labelMax) {
    const sincronizarRangos = () => {
        let minVal = parseInt(rangoMin.value, 10);
        let maxVal = parseInt(rangoMax.value, 10);

        // Valores por defecto si algo viene raro
        if (isNaN(minVal)) minVal = 0;
        if (isNaN(maxVal)) maxVal = 200;

        // Mantenerlos dentro del rango 0–200
        minVal = Math.max(0, Math.min(200, minVal));
        maxVal = Math.max(0, Math.min(200, maxVal));

        // Forzar separación mínima de 5, sin irse a negativos
        if (minVal > maxVal - 5) {
            minVal = Math.max(0, maxVal - 5);
            rangoMin.value = minVal;
        }
        if (maxVal < minVal + 5) {
            maxVal = Math.min(200, minVal + 5);
            rangoMax.value = maxVal;
        }

        labelMin.textContent = minVal;
        labelMax.textContent = maxVal;
    };

    rangoMin.addEventListener('input', sincronizarRangos);
    rangoMax.addEventListener('input', sincronizarRangos);

    // Ajustar al cargar la página
    sincronizarRangos();
}



    
});
