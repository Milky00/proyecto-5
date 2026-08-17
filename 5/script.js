// ============================================================
// 1. ORIENTACIÓN A OBJETOS
// ============================================================

class Tarea {
  constructor(descripcion, fechaLimite = null) {
    this.id = crypto.randomUUID();
    this.descripcion = descripcion;
    this.estado = 'pendiente'; // 'pendiente' | 'completada'
    this.fechaCreacion = new Date();
    this.fechaLimite = fechaLimite ? new Date(fechaLimite) : null;
  }

  cambiarEstado() {
    this.estado = this.estado === 'pendiente' ? 'completada' : 'pendiente';
    return this.estado;
  }

  // El "eliminarla" real ocurre en GestorTareas; este método marca intención,
  // útil si se quisiera manejar una papelera/estado 'eliminada' en el futuro.
  marcarEliminada() {
    this.estado = 'eliminada';
  }
}

class GestorTareas {
  #tareas = [];

  constructor() {
    this.#tareas = [];
  }

  agregarTarea(tarea) {
    this.#tareas = [...this.#tareas, tarea];
    return tarea;
  }

  eliminarTarea(id) {
    this.#tareas = this.#tareas.filter((t) => t.id !== id);
  }

  obtenerTarea(id) {
    return this.#tareas.find((t) => t.id === id);
  }

  obtenerTodas() {
    return [...this.#tareas];
  }

  vaciar() {
    this.#tareas = [];
  }

  cargarDesde(tareasPlano) {
    this.#tareas = tareasPlano.map((t) => {
      const tarea = new Tarea(t.descripcion, t.fechaLimite);
      tarea.id = t.id;
      tarea.estado = t.estado;
      tarea.fechaCreacion = new Date(t.fechaCreacion);
      return tarea;
    });
  }
}

// ============================================================
// 2. INSTANCIA PRINCIPAL Y REFERENCIAS AL DOM
// ============================================================

const gestor = new GestorTareas();

const form = document.getElementById('task-form');
const descripcionInput = document.getElementById('descripcion-input');
const fechaLimiteInput = document.getElementById('fecha-limite-input');
const listaEl = document.getElementById('lista-tareas');
const vacioEl = document.getElementById('vacio');
const contadorTag = document.getElementById('contador-tag');
const statusLine = document.getElementById('status-line');
const notificaciones = document.getElementById('notificaciones');

const STORAGE_KEY = 'taskflow_tareas';

// ============================================================
// 3. UTILIDADES ES6+ (template literals, destructuring, arrow fns)
// ============================================================

const formatearFecha = (fecha) => {
  if (!fecha) return null;
  const opciones = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat('es-AR', opciones).format(fecha);
};

const mostrarNotificacion = (mensaje, { duracion = 3500 } = {}) => {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = mensaje;
  notificaciones.appendChild(toast);
  setTimeout(() => toast.remove(), duracion);
};

const actualizarStatus = (mensaje) => {
  statusLine.textContent = mensaje;
};

// ============================================================
// 4. RENDER — MANIPULACIÓN DEL DOM
// ============================================================

function renderTareas() {
  const tareas = gestor.obtenerTodas();
  listaEl.innerHTML = '';
  vacioEl.style.display = tareas.length === 0 ? 'block' : 'none';
  contadorTag.textContent = `${tareas.length} tarea${tareas.length === 1 ? '' : 's'}`;

  tareas.forEach((tarea) => {
    const { id, descripcion, estado, fechaCreacion, fechaLimite } = tarea;

    const li = document.createElement('li');
    li.className = `tarea-card ${estado === 'completada' ? 'completada' : ''}`;
    li.dataset.id = id;

    li.innerHTML = `
      <div style="flex:1;">
        <div class="descripcion">${descripcion}</div>
        <div class="meta">creada ${formatearFecha(fechaCreacion)}${fechaLimite ? ` · límite ${formatearFecha(fechaLimite)}` : ''}</div>
        ${fechaLimite ? `<div class="cuenta-regresiva" data-countdown="${id}"></div>` : ''}
      </div>
      <span class="estado-badge ${estado}">${estado}</span>
      <div class="acciones">
        <button type="button" class="btn-toggle" data-id="${id}">${estado === 'pendiente' ? 'Completar' : 'Reabrir'}</button>
        <button type="button" class="btn-eliminar" data-id="${id}">Eliminar</button>
      </div>
    `;

    listaEl.appendChild(li);

    if (fechaLimite) iniciarCuentaRegresiva(tarea);
  });
}

// ============================================================
// 5. EVENTOS DE USUARIO
// ============================================================

// submit del formulario -> agregar tarea (con simulación de asincronía)
form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const descripcion = descripcionInput.value.trim();
  if (!descripcion) return;

  const fechaLimite = fechaLimiteInput.value || null;

  actualizarStatus('Guardando tarea…');
  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    const tarea = await agregarTareaConRetardo(descripcion, fechaLimite);
    gestor.agregarTarea(tarea);
    renderTareas();
    form.reset();
    actualizarStatus('');
    mostrarNotificacionConRetardo(`Tarea agregada: "${descripcion}"`);
  } catch (error) {
    actualizarStatus('Error al agregar la tarea.');
    console.error(error);
  } finally {
    boton.disabled = false;
  }
});

// click delegado -> completar / reabrir / eliminar
listaEl.addEventListener('click', (evento) => {
  const { target } = evento;
  const id = target.dataset.id;
  if (!id) return;

  if (target.classList.contains('btn-toggle')) {
    const tarea = gestor.obtenerTarea(id);
    tarea.cambiarEstado();
    renderTareas();
  }

  if (target.classList.contains('btn-eliminar')) {
    gestor.eliminarTarea(id);
    renderTareas();
    mostrarNotificacion('Tarea eliminada.');
  }
});

// mouseover -> resaltar tarjeta bajo el cursor
listaEl.addEventListener('mouseover', (evento) => {
  const card = evento.target.closest('.tarea-card');
  if (card) card.style.boxShadow = '4px 4px 0 var(--ink)';
});
listaEl.addEventListener('mouseout', (evento) => {
  const card = evento.target.closest('.tarea-card');
  if (card) card.style.boxShadow = 'none';
});

// keyup -> atajo Escape para limpiar el input de descripción
descripcionInput.addEventListener('keyup', (evento) => {
  if (evento.key === 'Escape') {
    descripcionInput.value = '';
  }
});

document.getElementById('btn-limpiar').addEventListener('click', () => {
  gestor.vaciar();
  renderTareas();
  mostrarNotificacion('Lista vaciada.');
});

document.getElementById('btn-guardar').addEventListener('click', () => {
  guardarEnLocalStorage();
});

document.getElementById('btn-importar').addEventListener('click', () => {
  importarDesdeAPI();
});

// ============================================================
// 6. JAVASCRIPT ASÍNCRONO
// ============================================================

// Simula latencia de red al agregar una tarea
function agregarTareaConRetardo(descripcion, fechaLimite) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(new Tarea(descripcion, fechaLimite));
    }, 600);
  });
}

// Notificación que aparece 2 segundos después de agregar la tarea
function mostrarNotificacionConRetardo(mensaje) {
  setTimeout(() => mostrarNotificacion(mensaje), 2000);
}

// Contador regresivo para tareas con fecha límite
function iniciarCuentaRegresiva(tarea) {
  const elemento = document.querySelector(`[data-countdown="${tarea.id}"]`);
  if (!elemento) return;

  const intervalId = setInterval(() => {
    const el = document.querySelector(`[data-countdown="${tarea.id}"]`);
    if (!el || !gestor.obtenerTarea(tarea.id)) {
      clearInterval(intervalId);
      return;
    }

    const restante = tarea.fechaLimite - new Date();
    if (restante <= 0) {
      el.textContent = 'Vencida';
      clearInterval(intervalId);
      return;
    }

    const horas = Math.floor(restante / 3_600_000);
    const minutos = Math.floor((restante % 3_600_000) / 60_000);
    const segundos = Math.floor((restante % 60_000) / 1000);
    el.textContent = `vence en ${horas}h ${minutos}m ${segundos}s`;
  }, 1000);
}

// ============================================================
// 7. CONSUMO DE APIS + LOCALSTORAGE
// ============================================================

async function importarDesdeAPI() {
  actualizarStatus('Importando tareas desde la API…');
  try {
    const respuesta = await fetch('https://jsonplaceholder.typicode.com/todos?_limit=5');
    if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}`);
    const datos = await respuesta.json();

    datos.forEach(({ title, completed }) => {
      const tarea = new Tarea(title);
      tarea.estado = completed ? 'completada' : 'pendiente';
      gestor.agregarTarea(tarea);
    });

    renderTareas();
    actualizarStatus('');
    mostrarNotificacion(`Se importaron ${datos.length} tareas de la API.`);
  } catch (error) {
    actualizarStatus('No se pudo importar desde la API.');
    mostrarNotificacion('Error al importar desde la API.');
    console.error(error);
  }
}

function guardarEnLocalStorage() {
  try {
    const plano = gestor.obtenerTodas().map(({ id, descripcion, estado, fechaCreacion, fechaLimite }) => ({
      id, descripcion, estado, fechaCreacion, fechaLimite,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plano));
    mostrarNotificacion('Tareas guardadas en localStorage.');
  } catch (error) {
    mostrarNotificacion('No se pudo guardar en localStorage.');
    console.error(error);
  }
}

function cargarDesdeLocalStorage() {
  try {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (!guardado) return;
    const plano = JSON.parse(guardado);
    gestor.cargarDesde(plano);
    renderTareas();
  } catch (error) {
    console.error('Error al leer localStorage', error);
  }
}

// ============================================================
// 8. INICIALIZACIÓN
// ============================================================

cargarDesdeLocalStorage();
renderTareas();
