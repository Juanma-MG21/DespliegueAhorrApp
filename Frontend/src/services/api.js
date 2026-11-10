// const API_URL = "http://localhost:3000/api";
export const API_URL = "/api";


// ── Helpers ───────────────────────────────────────────────────────────────────
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const fetchJSON = async (url, options = {}) => {
  const res = await fetch(url, { headers: authHeaders(), cache: "no-store", ...options });
  
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }
  
  if (!res.ok) {
    // Antes solo se lanzaba "HTTP 400/500" y se perdía el motivo real.
    // El backend responde { ok:false, mensaje } (algunos módulos usan { error }).
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.mensaje || data.error || `HTTP ${res.status}`);
    error.status = res.status;
    error.response = { status: res.status, data };
    throw error;
  }
  
  return res.json();
};

// Helper específico para endpoints públicos (sin token, ya que el usuario
// aún no está logueado en el flujo de recuperación de contraseña)
const fetchPublicJSON = async (url, options = {}) => {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.mensaje || `HTTP ${res.status}`);
    error.response = { status: res.status, data };
    throw error;
  }

  return data;
};

// ── Olvidar contraseña ──────────────────────────────────────────────────────────────────────
export const forgotPassword = (email) =>
  fetchPublicJSON(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    body: JSON.stringify({ Email: email }),
  });

export const verifyResetCode = (email, code) =>
  fetchPublicJSON(`${API_URL}/auth/verify-reset-code`, {
    method: "POST",
    body: JSON.stringify({ Email: email, code }),
  });

export const resetPassword = (resetToken, nuevaPassword) =>
  fetchPublicJSON(`${API_URL}/auth/reset-password`, {
    method: "POST",
    body: JSON.stringify({ resetToken, nuevaPassword }),
  });

// ── Auth ──────────────────────────────────────────────────────────────────────
export const registerUser = (datos) =>
  fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  }).then((r) => r.json());

export const loginUser = (datos) =>
  fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  }).then((r) => r.json());

export const actualizarRolUsuario = (id, ID_rol) =>
  fetchJSON(`${API_URL}/auth/PanelUsuarios/${id}/rol`, {
    method: "PUT",
    body: JSON.stringify({ ID_rol }),
  });

// ── Movimientos (base) ────────────────────────────────────────────────────────
export const getMovimientos = async () => {
  try {
    const data = await fetchJSON(`${API_URL}/movimientos`);
    return Array.isArray(data) ? data : (data.movimientos ?? []);
  } catch {
    return [];
  }
};

// ── Dashboard (una sola llamada) ──────────────────────────────────────────────
export const getDashboardData = async () => {
  const data = await fetchJSON(`${API_URL}/dashboard/resumen`);
  return {
    totalIngresos: data.totalIngresos ?? 0,
    totalGastos:   data.totalGastos   ?? 0,
    totalAhorros:  data.totalAhorros  ?? 0,
    balance:       data.balance       ?? 0,
    periodo:       data.periodo       ?? null,
    sin_periodo:   data.sin_periodo   ?? true,
  };
};
 
export const getPresupuestoVsEjecutado = async () => {
  const data = await fetchJSON(`${API_URL}/dashboard/presupuesto-vs-ejecutado`);
  return data.data ?? [];
};
 
export const getFlujoPorSemana = async () => {
  const data = await fetchJSON(`${API_URL}/dashboard/flujo-semanal`);
  return data.data ?? [];
};
 

// ── Dependientes ──────────────────────────────────────────────────────────────
export const getDependientes = async () => {
  try {
    return await fetchJSON(`${API_URL}/dependientes`);
  } catch (error) {
    console.error("Error en getDependientes:", error);
    throw error;
  }
};

// ── Categorías ────────────────────────────────────────────────────────────────
export const getCategorias = async () => {
  const data = await fetchJSON(`${API_URL}/categorias`);
  return data.categorias ?? [];
};

export const getGastosPorCategoria = async () => {
  const response = await fetch(`${API_URL}/categorias/gastos`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  const data = await response.json();
  return data.categorias ?? [];
};

export const getIngresosPorCategoria = async () => {
  const response = await fetch(`${API_URL}/categorias/ingresos`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  const data = await response.json();
  return data.categorias ?? [];
};

export const getAhorrosPorCategoria = async () => {
  const response = await fetch(`${API_URL}/categorias/ahorros`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  const data = await response.json();
  return data.categorias ?? [];
};

export const getImprevistosPorCategoria = async () => {
  const response = await fetch(`${API_URL}/categorias/imprevistos`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  const data = await response.json();
  return data.categorias ?? [];
};

export const getDeudasPorCategoria = async () => {
  const response = await fetch(`${API_URL}/categorias/deudas`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  const data = await response.json();
  return data.categorias ?? [];
};

export const crearCategoria = (datos) =>
  fetchJSON(`${API_URL}/categorias`, {
    method: "POST",
    body: JSON.stringify(datos),
  });

export const editarCategoria = (id, datos) =>
  fetchJSON(`${API_URL}/categorias/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });

export const deshabilitarCategoria = (id) =>
  fetchJSON(`${API_URL}/categorias/${id}/deshabilitar`, { method: "PATCH" });

export const habilitarCategoria = (id) =>
  fetchJSON(`${API_URL}/categorias/${id}/habilitar`, { method: "PATCH" });

// ── Notificaciones ────────────────────────────────────────────────────────────
export const getNotificaciones = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const data = await fetchJSON(`${API_URL}/notificaciones${query ? `?${query}` : ""}`);
  return {
    notificaciones: data.notificaciones ?? [],
    paginacion: data.paginacion ?? null,
  };
};

export const getNoLeidasCount = async () => {
  try {
    const data = await fetchJSON(`${API_URL}/notificaciones/no-leidas/count`);
    return data.count ?? 0;
  } catch (error) {
    console.error("Error en getNoLeidasCount:", error);
    return 0;
  }
};

export const marcarNotificacionLeida = (id) =>
  fetchJSON(`${API_URL}/notificaciones/${id}/leer`, { method: "PATCH" });

export const marcarTodasNotificacionesLeidas = () =>
  fetchJSON(`${API_URL}/notificaciones/leer-todas`, { method: "PATCH" });

export const archivarNotificacion = (id) =>
  fetchJSON(`${API_URL}/notificaciones/${id}/archivar`, { method: "PATCH" });

export const eliminarNotificacion = (id) =>
  fetchJSON(`${API_URL}/notificaciones/${id}`, { method: "DELETE" });

export const getPreferenciasNotificacion = async () => {
  const data = await fetchJSON(`${API_URL}/preferencias-notificacion`);
  return data.preferencias ?? [];
};

export const actualizarPreferenciasNotificacion = (preferencias) =>
  fetchJSON(`${API_URL}/preferencias-notificacion`, {
    method: "PUT",
    body: JSON.stringify({ preferencias }),
  });

// ── Presupuestos ──────────────────────────────────────────────────────────────
export const getPerfilesPrespuesto = () =>
  fetchJSON(`${API_URL}/presupuestos`);
 
export const crearPerfil = (datos) =>
  fetchJSON(`${API_URL}/presupuestos`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
 
export const editarPerfil = (id, datos) =>
  fetchJSON(`${API_URL}/presupuestos/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
 
export const eliminarPerfil = (id) =>
  fetchJSON(`${API_URL}/presupuestos/${id}`, { method: "DELETE" });
 
export const activarPerfil = (id) =>
  fetchJSON(`${API_URL}/presupuestos/${id}/activar`, { method: "PUT" });
 
// ── Períodos ──────────────────────────────────────────────────────────────────
export const getPeriodos = (pagina = 1, limite = 50) =>
  fetchJSON(`${API_URL}/presupuestos/periodos?pagina=${pagina}&limite=${limite}`);

export const getPeriodoActivo = () =>
  fetchJSON(`${API_URL}/presupuestos/periodos/activo`);
 
export const abrirPeriodo = (ingreso_estimado) =>
  fetchJSON(`${API_URL}/presupuestos/periodos/abrir`, {
    method: "POST",
    body: JSON.stringify({ ingreso_estimado }),
  });
 
export const cerrarPeriodo = () =>
  fetchJSON(`${API_URL}/presupuestos/periodos/cerrar`, { method: "PUT" });
 
export const ajustarIngresoPeriodo = (ingreso_estimado) =>
  fetchJSON(`${API_URL}/presupuestos/periodos/ajustar-ingreso`, {
    method: "PATCH",
    body: JSON.stringify({ ingreso_estimado }),
  });
 
// ── Movimientos extra ─────────────────────────────────────────────────────────
export const abonarDeuda = (id, cuotas = 1) =>
  fetchJSON(`${API_URL}/movimientos/deudas/${id}/abonar`, {
    method: "PATCH",
    body: JSON.stringify({ cuotas }),
  });
 
export const abonarAhorro = (id, monto) =>
  fetchJSON(`${API_URL}/movimientos/ahorros/${id}/abonar`, {
    method: "PATCH",
    body: JSON.stringify({ monto }),
  });
 
// ── Resumen financiero (para el Asistente) ────────────────────────────────────
export const getResumenFinancieroBreve = async () => {
  try {
    const movimientos = await getMovimientos();

    const sumar = (tipo) =>
      movimientos
        .filter((m) => (m.tipo ?? m.tipo_movimiento ?? "").toLowerCase() === tipo)
        .reduce((acc, m) => acc + Number(m.monto ?? 0), 0);

    const ingresosTotales = sumar("ingreso");
    const gastosTotales = sumar("gasto");
    const deudas = movimientos.filter((m) =>
      ["deuda"].includes((m.tipo ?? m.tipo_movimiento ?? "").toLowerCase())
    );
    const ahorros = movimientos.filter((m) =>
      ["ahorro"].includes((m.tipo ?? m.tipo_movimiento ?? "").toLowerCase())
    );

    const lines = [
      "CONTEXTO FINANCIERO REAL DEL USUARIO:",
      `- Ingresos totales de este mes: $${ingresosTotales}`,
      `- Gastos totales de este mes: $${gastosTotales}`,
      `- Balance actual: $${ingresosTotales - gastosTotales}`,
      "",
      "DEUDAS ACTIVAS:",
      deudas.length === 0
        ? "  Sin deudas registradas."
        : deudas
            .map(
              (d) =>
                `  * ${d.descripcion ?? "Deuda"}: $${d.monto} (Estado: ${d.estado ?? "Pendiente"})`
            )
            .join("\n"),
      "",
      "PLANES DE AHORRO:",
      ahorros.length === 0
        ? "  Sin ahorros registrados."
        : ahorros
            .map((a) => `  * ${a.descripcion ?? "Ahorro"}: $${a.monto}`)
            .join("\n"),
    ];

    return lines.join("\n");
  } catch (error) {
    console.error("Error al recopilar el contexto financiero:", error);
    return "No se pudo cargar la información financiera actual del usuario.";
  }
};

// ── Exportar Datos (funciones desactivadas por el momento) ────────────────────────────────────────────────────────────
// export const exportarDatos = async (payload, { onError, onDone } = {}) => {
//   try {
//     const res = await fetch(`${API_URL}/exportar`, {
//       method: "POST",
//       headers: authHeaders(),
//       body: JSON.stringify(payload),
//     });

//     if (!res.ok) {
//       const { error } = await res.json();
//       throw new Error(error ?? "Error al exportar datos");
//     }

//     const contentType = res.headers.get("Content-Type") ?? "";
//     const contentDisposition = res.headers.get("Content-Disposition") ?? "";
//     const match = contentDisposition.match(/filename\"?=\"?([^;\"]+)/i);
//     const filename = match?.[1]?.trim() ?? `reporte_financiero.${payload.formato}`;

//     const blob = await res.blob();

//     // Detectar respuesta corrupta (JSON/HTML cuando se esperaba binario)
//     const isExpectedType =
//       contentType.includes("application/pdf") ||
//       contentType.includes("text/csv") ||
//       payload.formato === "json";

//     if (!isExpectedType) {
//       const text = await blob.text().catch(() => "");
//       try {
//         const { error } = JSON.parse(text);
//         throw new Error(error ?? "Respuesta inesperada del servidor");
//       } catch {
//         if (text) throw new Error(text.slice(0, 200));
//       }
//     }

//     const url = URL.createObjectURL(blob);
//     const a = Object.assign(document.createElement("a"), { href: url, download: filename });
//     document.body.appendChild(a);
//     a.click();
//     setTimeout(() => {
//       URL.revokeObjectURL(url);
//       a.remove();
//     }, 0);

//     onDone?.();
//   } catch (error) {
//     console.error("Error en exportarDatos:", error);
//     onError?.(error.message);
//     throw error;
//   }
// };

//// ── Historial de Exportaciones ───────────────────────────────────────────────
// export const getHistorialExportaciones = async (params = {}) => {
//   const query = new URLSearchParams(params).toString();

//   const response = await fetch(`${API_URL}/exportar?${query}`, {
//     headers: authHeaders(),
//     cache: "no-store",
//   });

//   if (!response.ok) {
//     const errorData = await response.json().catch(() => ({}));

//     throw new Error(
//       errorData.error || "Error al obtener historial de exportaciones"
//     );
//   }

//   return response.json();
// };

// // ── Eliminar Exportación del Historial ───────────────────────────────────────
// export const eliminarExportacion = async (id) => {
//   const response = await fetch(`${API_URL}/exportar/${id}`, {
//     method: "DELETE",
//     headers: authHeaders(),
//     cache: "no-store",
//   });

//   if (!response.ok) {
//     const errorData = await response.json().catch(() => ({}));

//     throw new Error(
//       errorData.error || "Error al eliminar exportación"
//     );
//   }

//   return response.json();
// };

// ── Ingresos / Gastos ─────────────────────────────────────────────────────────

export const getIngresos = async () => {
  const movimientos = await getMovimientos();
  return movimientos.filter(m =>
    (m.tipo ?? m.tipo_movimiento ?? "").toLowerCase() === "ingreso"
  );
};

export const getGastos = async () => {
  const movimientos = await getMovimientos();
  return movimientos.filter(m =>
    (m.tipo ?? m.tipo_movimiento ?? "").toLowerCase() === "gasto"
  );
};

// ── Panel Admin ───────────────────────────────────────────────────────────────
export const getUsuariosPanelAdmin = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}/auth/usuarios/PanelAdmin`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Error al obtener total de usuarios");
  }

  return response.json(); 
}

export const getDependientesPanelAdmin = async () => {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/auth/dependientes/PanelAdmin`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Error al obtener total de dependientes");
  }

  return response.json(); 
}

// dependientes para admin
export const getTodosDependientesAdmin = async () => {
  const token = localStorage.getItem('token');

  const res = await fetch(`${API_URL}/auth/PanelDependientes`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Error al obtener todos los dependientes');
  }

  const data = await res.json();

  return data.dependientes ?? data;
};

// Eliminar el dependiente de cualquier usuario (solo admin/superuser)
export const eliminarDependienteAdmin = (id) =>
  fetchJSON(`${API_URL}/dependientes/admin/${id}`, {
    method: 'DELETE',
  });

// ── Historial de acciones ─────────────────────────────────────────────────────
// Historial completo del sistema (solo admin/superuser)
export const getHistorial = async () => {
  const data = await fetchJSON(`${API_URL}/historial`);
  return data.historial ?? [];
};

// Historial propio del usuario logueado (para Configuración)
export const getHistorialPropio = async () => {
  const data = await fetchJSON(`${API_URL}/historial/propio`);
  return data.historial ?? [];
};

// Desactivar la propia cuenta (autoservicio, con eliminación programada a 30 días)
export const desactivarCuentaPropia = () =>
  fetchJSON(`${API_URL}/auth/mi-cuenta/desactivar`, {
    method: 'PUT',
  });

// Editar mis propios datos (nombre, apellido, email)
export const actualizarMiPerfil = (datos) =>
  fetchJSON(`${API_URL}/auth/mi-perfil`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  });

// Cambiar mi propia contraseña
export const cambiarMiPassword = (passwordActual, passwordNueva) =>
  fetchJSON(`${API_URL}/auth/mi-cuenta/password`, {
    method: 'PUT',
    body: JSON.stringify({ passwordActual, passwordNueva }),
  });


// ── Reportes ────────────────────────────────────────────────────────────────

const paramsFechaReporte = (fechaInicio, fechaFin) => {
  const params = new URLSearchParams();

  if (fechaInicio) {
    params.append("fecha_inicio", fechaInicio);
  }

  if (fechaFin) {
    params.append("fecha_fin", fechaFin);
  }

  return params.toString();
};

export const getReporteResumen = async (fechaInicio, fechaFin) => {
  const query = paramsFechaReporte(fechaInicio, fechaFin);

  return fetchJSON(
    `${API_URL}/reportes/resumen${query ? `?${query}` : ""}`
  );
};

export const getReporteGastosCategorias = async (fechaInicio, fechaFin) => {
  const query = paramsFechaReporte(fechaInicio, fechaFin);

  return fetchJSON(
    `${API_URL}/reportes/gastos/categorias${query ? `?${query}` : ""}`
  );
};

export const getReporteGastosDependientes = async (fechaInicio, fechaFin) => {
  const query = paramsFechaReporte(fechaInicio, fechaFin);

  return fetchJSON(
    `${API_URL}/reportes/gastos/dependientes${query ? `?${query}` : ""}`
  );
};

export const getReporteIngresosCategorias = async (fechaInicio, fechaFin) => {
  const query = paramsFechaReporte(fechaInicio, fechaFin);

  return fetchJSON(
    `${API_URL}/reportes/ingresos/categorias${query ? `?${query}` : ""}`
  );
};

export const getReporteIngresosFuentes = async (fechaInicio, fechaFin) => {
  const query = paramsFechaReporte(fechaInicio, fechaFin);

  return fetchJSON(
    `${API_URL}/reportes/ingresos/fuentes${query ? `?${query}` : ""}`
  );
};

export const getReporteAhorros = async (fechaInicio, fechaFin) => {
  const query = paramsFechaReporte(fechaInicio, fechaFin);

  return fetchJSON(
    `${API_URL}/reportes/ahorros${query ? `?${query}` : ""}`
  );
};

export const getEstadoAhorros = async () => {
  return fetchJSON(`${API_URL}/reportes/ahorros/estado`);
};

export const getReporteDeudas = async (fechaInicio, fechaFin) => {
  const query = paramsFechaReporte(fechaInicio, fechaFin);

  return fetchJSON(
    `${API_URL}/reportes/deudas${query ? `?${query}` : ""}`
  );
};

export const getEstadoDeudas = async () => {
  return fetchJSON(`${API_URL}/reportes/deudas/estado`);
};

export const getReporteImprevistosCategorias = async (
  fechaInicio,
  fechaFin
) => {
  const query = paramsFechaReporte(fechaInicio, fechaFin);

  return fetchJSON(
    `${API_URL}/reportes/imprevistos/categorias${query ? `?${query}` : ""}`
  );
};

export const getReporteFondoEmergencia = async (
  fechaInicio,
  fechaFin
) => {
  const query = paramsFechaReporte(fechaInicio, fechaFin);

  return fetchJSON(
    `${API_URL}/reportes/fondo-emergencia${query ? `?${query}` : ""}`
  );
};

export const getEstadoFondoEmergencia = async () => {
  return fetchJSON(`${API_URL}/reportes/fondo-emergencia/estado`);
};

// ── Fondo de Emergencia (CRUD propio, distinto del módulo de Reportes) ─────
export const getFondoEmergencia = () =>
  fetchJSON(`${API_URL}/fondo-emergencia`);

export const crearFondoEmergencia = (meta) =>
  fetchJSON(`${API_URL}/fondo-emergencia`, {
    method: "POST",
    body: JSON.stringify({ meta }),
  });

export const actualizarMetaFondoEmergencia = (meta) =>
  fetchJSON(`${API_URL}/fondo-emergencia/meta`, {
    method: "PUT",
    body: JSON.stringify({ meta }),
  });

export const registrarAporteFondo = (monto, descripcion) =>
  fetchJSON(`${API_URL}/fondo-emergencia/aporte`, {
    method: "POST",
    body: JSON.stringify({ monto, descripcion }),
  });

export const registrarRetiroFondo = (monto, descripcion) =>
  fetchJSON(`${API_URL}/fondo-emergencia/retiro`, {
    method: "POST",
    body: JSON.stringify({ monto, descripcion }),
  });

export const getMovimientosFondoEmergencia = () =>
  fetchJSON(`${API_URL}/fondo-emergencia/movimientos`);

export const getReportePresupuesto = async (idPeriodo) => {
  if (!idPeriodo) return null;

  return fetchJSON(
    `${API_URL}/reportes/presupuesto/${idPeriodo}`
  );
};

export const getReporteEvolucion = async (fechaInicio, fechaFin) => {
  const query = paramsFechaReporte(fechaInicio, fechaFin);

  return fetchJSON(
    `${API_URL}/reportes/evolucion${query ? `?${query}` : ""}`
  );
};

export const eliminarCategoria = (id) =>
  fetchJSON(`${API_URL}/categorias/${id}`, { method: "DELETE" });

export const obtenerInformeCompleto = async ({
  fechaInicio,
  fechaFin,
  idPeriodo = null,
}) => {
  // Cada llamada se protege individualmente: si una falla (ej. el usuario
  // todavía no tiene fondo de emergencia creado -> 404), esa sección queda
  // en null en vez de tumbar el informe completo.
  const seguro = (promesa) => promesa.catch((e) => {
    console.warn('Sección del informe no disponible:', e.message);
    return null;
  });

  const [
    resumen,
    gastosCategoria,
    gastosDependiente,
    ingresosCategoria,
    ingresosFuente,
    ahorros,
    deudas,
    imprevistosCategoria,
    fondoEmergencia,
    evolucion,
    estadoAhorros,
    estadoDeudas,
    estadoFondoEmergencia,
  ] = await Promise.all([
    seguro(getReporteResumen(fechaInicio, fechaFin)),
    seguro(getReporteGastosCategorias(fechaInicio, fechaFin)),
    seguro(getReporteGastosDependientes(fechaInicio, fechaFin)),
    seguro(getReporteIngresosCategorias(fechaInicio, fechaFin)),
    seguro(getReporteIngresosFuentes(fechaInicio, fechaFin)),
    seguro(getReporteAhorros(fechaInicio, fechaFin)),
    seguro(getReporteDeudas(fechaInicio, fechaFin)),
    seguro(getReporteImprevistosCategorias(fechaInicio, fechaFin)),
    seguro(getReporteFondoEmergencia(fechaInicio, fechaFin)),
    seguro(getReporteEvolucion(fechaInicio, fechaFin)),
    seguro(getEstadoAhorros()),
    seguro(getEstadoDeudas()),
    seguro(getEstadoFondoEmergencia()),
  ]);

  let presupuesto = null;

  if (idPeriodo) {
    presupuesto = await seguro(getReportePresupuesto(idPeriodo));
  }

  return {
    resumen,
    gastosCategoria,
    gastosDependiente,
    ingresosCategoria,
    ingresosFuente,
    ahorros,
    deudas,
    imprevistosCategoria,
    fondoEmergencia,
    evolucion,
    estadoAhorros,
    estadoDeudas,
    estadoFondoEmergencia,
    presupuesto,
    periodo: {
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      id_periodo: idPeriodo,
    },
  };
};