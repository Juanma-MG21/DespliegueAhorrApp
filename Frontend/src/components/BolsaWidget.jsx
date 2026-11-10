import { useState, useEffect } from 'react'

const ACCIONES_DEFAULT = [
  { symbol: 'EC', nombre: 'Ecopetrol', icono: '🛢️', pais: 'Colombia' },
  { symbol: 'CIB', nombre: 'Bancolombia', icono: '🏦', pais: 'Colombia' },
  { symbol: 'NU', nombre: 'Nubank', icono: '💜', pais: 'Brasil / Colombia' },
  { symbol: 'BBVA', nombre: 'BBVA', icono: '🔵', pais: 'España / Colombia' },
  { symbol: 'GEB', nombre: 'Grupo Energía Bogotá', icono: '⚡', pais: 'Colombia' },
]

const TRM_DEFAULT = 4200

const metricasDetalle = (accion, formatCOP) => [
  {
    label: 'Precio actual',
    valor: `$${accion.precio.toFixed(2)} USD`,
    apoyo: formatCOP(accion.precio),
  },
  {
    label: 'Máximo del día',
    valor: `$${accion.maximo.toFixed(2)} USD`,
    apoyo: formatCOP(accion.maximo),
  },
  {
    label: 'Mínimo del día',
    valor: `$${accion.minimo.toFixed(2)} USD`,
    apoyo: formatCOP(accion.minimo),
  },
  {
    label: 'Apertura',
    valor: `$${accion.apertura.toFixed(2)} USD`,
    apoyo: formatCOP(accion.apertura),
  },
  {
    label: 'Cierre anterior',
    valor: `$${accion.cierreAnt.toFixed(2)} USD`,
    apoyo: formatCOP(accion.cierreAnt),
  },
  {
    label: 'Variación',
    valor: `${accion.subio ? '+' : ''}${accion.cambio.toFixed(2)} USD`,
    apoyo: `${accion.porcentaje.toFixed(2)}%`,
  },
]

export default function BolsaWidget() {
  const [acciones, setAcciones] = useState(ACCIONES_DEFAULT)
  const [datos, setDatos] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [seleccionada, setSeleccionada] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [trm, setTrm] = useState(TRM_DEFAULT)

  // ─────────────────────────────────────────────────────────
  // TRM
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/bolsa/trm/usd-cop')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.trm) {
          setTrm(data.trm)
        }
      })
      .catch(() => {})
  }, [])

  // ─────────────────────────────────────────────────────────
  // Fetch acciones
  // ─────────────────────────────────────────────────────────
  const fetchAcciones = async (lista) => {
    try {
      setError(null)

      const nuevos = {}

      await Promise.all(
        lista.map(async (accion) => {
          const res = await fetch(
            `/api/bolsa/${accion.symbol}`
            
          )

          const data = await res.json()

          if (!res.ok || data.ok === false) return

          nuevos[accion.symbol] = {
            precio: data.c ?? 0,
            cambio: data.d ?? 0,
            porcentaje: data.dp ?? 0,
            maximo: data.h ?? 0,
            minimo: data.l ?? 0,
            apertura: data.o ?? 0,
            cierreAnt: data.pc ?? 0,
            subio: (data.d ?? 0) >= 0,
          }
        })
      )

      setDatos((prev) => ({
        ...prev,
        ...nuevos,
      }))
    } catch (_) {
      setError('No se pudo conectar con la API de bolsa')
    }
  }

  // ─────────────────────────────────────────────────────────
  // Auto actualización
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    setCargando(true)

    fetchAcciones(acciones).finally(() => {
      setCargando(false)
    })

    const intervalo = setInterval(() => {
      fetchAcciones(acciones)
    }, 5 * 60 * 1000)

    return () => clearInterval(intervalo)
  }, [acciones])

  // ─────────────────────────────────────────────────────────
  // Agregar acción
  // ─────────────────────────────────────────────────────────
  const agregarAccion = async () => {
    const sym = busqueda.trim().toUpperCase()

    if (!sym) return

    if (acciones.find((a) => a.symbol === sym)) {
      setError('Ese símbolo ya está agregado')
      return
    }

    const nueva = {
      symbol: sym,
      nombre: sym,
      icono: '📈',
      pais: 'Internacional',
    }

    setAcciones((prev) => [...prev, nueva])
    setBusqueda('')

    try {
      const res = await fetch(
        `/api/bolsa/${sym}`
      )

      const data = await res.json()

      if (!res.ok || data.ok === false) {
        setError(data.mensaje || 'No se pudo consultar el símbolo')
        return
      }

      setDatos((prev) => ({
        ...prev,
        [sym]: {
          precio: data.c ?? 0,
          cambio: data.d ?? 0,
          porcentaje: data.dp ?? 0,
          maximo: data.h ?? 0,
          minimo: data.l ?? 0,
          apertura: data.o ?? 0,
          cierreAnt: data.pc ?? 0,
          subio: (data.d ?? 0) >= 0,
        },
      }))
    } catch (_) {
      setError('No se pudo conectar con la API')
    }
  }

  // ─────────────────────────────────────────────────────────
  // Eliminar acción
  // ─────────────────────────────────────────────────────────
  const eliminarAccion = (symbol) => {
    setAcciones((prev) =>
      prev.filter((a) => a.symbol !== symbol)
    )

    setDatos((prev) => {
      const copia = { ...prev }
      delete copia[symbol]
      return copia
    })

    if (seleccionada?.symbol === symbol) {
      setSeleccionada(null)
    }
  }

  // ─────────────────────────────────────────────────────────
  // Seleccionar acción
  // ─────────────────────────────────────────────────────────
  const seleccionarAccion = (accion) => {
    setSeleccionada(
      seleccionada?.symbol === accion.symbol
        ? null
        : {
            ...accion,
            ...datos[accion.symbol],
          }
    )
  }

  // ─────────────────────────────────────────────────────────
  // Formato COP
  // ─────────────────────────────────────────────────────────
  const formatCOP = (usd) => {
    return (usd * trm).toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    })
  }

  const accionesConDatos = acciones.filter(
    (accion) => datos[accion.symbol]
  )

  return (
    <section className="w-full rounded-2xl border border-white/10 bg-slate-950/40 p-6 shadow-[0_18px_45px_rgba(0,0,0,0.25)] backdrop-blur-xl">

      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-cyan-400/10 border border-cyan-300/20 text-cyan-100 font-black">
            BV
          </div>

          <div>
            <h2 className="text-xl font-black text-white">
              Bolsa de Valores
            </h2>

            <p className="text-sm text-slate-400">
              Seguimiento financiero en tiempo real
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          <span className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-100">
            TRM {trm.toLocaleString('es-CO')} COP
          </span>

          <span className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-bold text-amber-100">
            Finnhub API
          </span>

        </div>
      </div>

      {/* BUSCADOR */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">

        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') agregarAccion()
          }}
          placeholder="Agregar símbolo (AAPL, TSLA, NVDA...)"
          className="min-h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
        />

        <button
          type="button"
          onClick={agregarAccion}
          disabled={!busqueda.trim()}
          className="min-h-11 rounded-xl bg-cyan-400 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          Agregar
        </button>

      </div>

      {/* MENSAJES */}
      <div className="mt-4 min-h-6">

        {cargando && (
          <p className="text-sm text-slate-400">
            Consultando precios...
          </p>
        )}

        {error && (
          <p className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        )}

      </div>

      {/* GRID */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">

        {accionesConDatos.map((accion) => {
          const d = datos[accion.symbol]

          const activa =
            seleccionada?.symbol === accion.symbol

          return (
            <article
              key={accion.symbol}
              onClick={() => seleccionarAccion(accion)}
              className={`group relative cursor-pointer rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 ${
                activa
                  ? 'border-cyan-300/60 bg-cyan-300/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >

              {/* ELIMINAR */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  eliminarAccion(accion.symbol)
                }}
                className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-xs text-slate-400 opacity-70 transition hover:border-rose-300/40 hover:bg-rose-400/10 hover:text-rose-100 group-hover:opacity-100"
              >
                ✕
              </button>

              {/* TOP */}
              <div className="flex items-start gap-3 pr-8">

                <div className="text-3xl">
                  {accion.icono}
                </div>

                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black text-white">
                    {accion.nombre}
                  </h3>

                  <p className="mt-0.5 text-xs text-slate-400">
                    {accion.symbol} · {accion.pais}
                  </p>
                </div>

              </div>

              {/* PRECIO */}
              <div className="mt-5">

                <p className="text-2xl font-black text-white">
                  ${d.precio.toFixed(2)}

                  <span className="ml-1 text-[0.65rem] text-slate-400">
                    USD
                  </span>
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {formatCOP(d.precio)}
                </p>

              </div>

              {/* VARIACIÓN */}
              <div
                className={`mt-4 inline-flex rounded-lg px-2.5 py-1 text-xs font-black ${
                  d.subio
                    ? 'bg-emerald-400/10 text-emerald-200'
                    : 'bg-rose-400/10 text-rose-200'
                }`}
              >
                {d.subio ? '▲' : '▼'}{' '}
                {d.subio ? '+' : ''}
                {d.cambio.toFixed(2)} (
                {d.porcentaje.toFixed(2)}%)
              </div>

            </article>
          )
        })}
      </div>

      {/* DETALLE */}
      {seleccionada && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                Detalle de acción
              </p>

              <h3 className="mt-1 text-2xl font-black text-white">
                {seleccionada.icono} {seleccionada.nombre}
              </h3>

              <p className="text-sm text-slate-400">
                {seleccionada.symbol} · {seleccionada.pais}
              </p>
            </div>

            <div
              className={`rounded-xl px-4 py-2 ${
                seleccionada.subio
                  ? 'bg-emerald-400/10 text-emerald-100'
                  : 'bg-rose-400/10 text-rose-100'
              }`}
            >
              <p className="text-xs font-bold uppercase">
                Variación
              </p>

              <p className="text-lg font-black">
                {seleccionada.subio ? '+' : ''}
                {seleccionada.porcentaje.toFixed(2)}%
              </p>
            </div>

          </div>

          {/* MÉTRICAS */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

            {metricasDetalle(
              seleccionada,
              formatCOP
            ).map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/10 bg-slate-950/35 p-4"
              >

                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {item.label}
                </p>

                <p className="mt-2 text-lg font-black text-white">
                  {item.valor}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {item.apoyo}
                </p>

              </div>
            ))}

          </div>

        </section>
      )}

      {/* FOOTER */}
      <div className="mt-5 flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">

        <span>
          Actualización automática cada 5 minutos
        </span>

        <span>
          Haz clic en una acción para ver detalles
        </span>

      </div>

    </section>
  )
}