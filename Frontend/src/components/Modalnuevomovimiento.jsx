import { useState, useEffect } from 'react'
import { getCategorias, getDependientes } from '../services/api'
import { useToast } from '../context/ToastContext'
import { useNotificaciones } from '../context/NotificacionesContext'
import {
  validarMonto, validarLongitud, validarCuotas, validarOrdenFechas, validarNoFutura,
  primerError, LIMITES, MONTO_MINIMO_GASTO, hoyISO,
} from '../utils/validaciones'

// const API = 'http://localhost:3000/api/movimientos'
const API = '/api/movimientos'

// ── Configuración por subtipo ─────────────────────────────────
const CONFIG = {
  Ingreso:    { tipo_flujo: 'Entrada', label: 'Ingreso',    emoji: '💰', color: 'emerald' },
  Ahorro:     { tipo_flujo: 'Entrada', label: 'Ahorro',     emoji: '🎯', color: 'amber'   },
  Gasto:      { tipo_flujo: 'Salida',  label: 'Gasto',      emoji: '💸', color: 'red'     },
  Deuda:      { tipo_flujo: 'Salida',  label: 'Deuda',      emoji: '💳', color: 'purple'  },
  Imprevisto: { tipo_flujo: 'Salida',  label: 'Imprevisto', emoji: '⚡', color: 'orange'  },
}

const COLORES = {
  emerald: { ring: 'focus:border-emerald-400/60 focus:ring-emerald-400/20', btn: 'linear-gradient(135deg,#34d399,#10b981)', title: 'text-emerald-400' },
  amber:   { ring: 'focus:border-amber-400/60 focus:ring-amber-400/20',     btn: 'linear-gradient(135deg,#fbbf24,#f59e0b)', title: 'text-amber-400',   btnText: 'text-[#0f172a]' },
  red:     { ring: 'focus:border-red-400/60 focus:ring-red-400/20',         btn: 'linear-gradient(135deg,#f87171,#ef4444)', title: 'text-red-400'     },
  purple:  { ring: 'focus:border-purple-400/60 focus:ring-purple-400/20',   btn: 'linear-gradient(135deg,#c084fc,#a855f7)', title: 'text-purple-400'  },
  orange:  { ring: 'focus:border-orange-400/60 focus:ring-orange-400/20',   btn: 'linear-gradient(135deg,#fb923c,#f97316)', title: 'text-orange-400'  },
}

const labelCls = 'mt-3.5 block text-[0.72rem] font-bold uppercase tracking-[0.06em] text-zinc-400'
const mkInput  = (ring) => `mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 ${ring}`

// ── Campos por subtipo ────────────────────────────────────────
const INICIAL = {
  Ingreso:    { monto: '', fuente: '', descripcion: '', fecha_registro: '', id_categoria: '' },
  Ahorro:     { monto: '', meta: '', descripcion: '', fecha_registro: '', fecha_meta: '', id_categoria: '' },
  Gasto:      { monto: '', descripcion: '', fecha_registro: '', id_categoria: '', id_dependientes: '' },
  Deuda:      { monto: '', fuente: '', descripcion: '', cuotas_total: '', fecha_inicio: '', fecha_fin: '', id_categoria: '' },
  Imprevisto: { monto: '', causa: '', fecha_registro: '', id_categoria: '', id_dependientes: '' },
}

// ── Construye el payload según subtipo ────────────────────────
const buildDatos = (subtipo, form) => {
  const base = { monto: Number(form.monto) }
  switch (subtipo) {
    case 'Ingreso':
      return { ...base, fuente: form.fuente || null, descripcion: form.descripcion || null, fecha_registro: form.fecha_registro || null, id_categoria: form.id_categoria || null }
    case 'Ahorro':
      return { ...base, meta: form.meta || null, descripcion: form.descripcion || null, fecha_registro: form.fecha_registro || null, fecha_meta: form.fecha_meta || null, id_categoria: form.id_categoria || null }
    case 'Gasto':
      return { ...base, descripcion: form.descripcion || null, fecha_registro: form.fecha_registro || null, id_categoria: form.id_categoria || null, id_dependientes: form.id_dependientes || null }
    case 'Deuda':
      return { ...base, fuente: form.fuente || null, descripcion: form.descripcion || null, cuotas_total: form.cuotas_total ? Number(form.cuotas_total) : null, fecha_inicio: form.fecha_inicio || null, fecha_fin: form.fecha_fin || null, id_categoria: form.id_categoria || null }
    case 'Imprevisto':
      return { ...base, causa: form.causa || null, fecha_registro: form.fecha_registro || null, id_categoria: form.id_categoria || null, id_dependientes: form.id_dependientes || null }
    default:
      return base
  }
}

// ── Validaciones por subtipo ──────────────────────────────────
// Mismas reglas que el backend (service/validaciones.js) y el móvil
// (core/utils/validaciones.dart). Solo el gasto exige monto mínimo de 50 (RF-03).
const validar = (subtipo, form) => {
  const comunes = primerError(
    validarMonto(form.monto, subtipo === 'Gasto' ? { minimo: MONTO_MINIMO_GASTO } : {}),
    validarLongitud(form.descripcion, LIMITES.descripcion, 'La descripción'),
  )
  if (comunes) return comunes

  switch (subtipo) {
    case 'Ingreso':
      return primerError(
        validarLongitud(form.fuente, LIMITES.fuente, 'La fuente'),
        validarNoFutura(form.fecha_registro, 'La fecha'),
      )
    case 'Gasto':
      return validarNoFutura(form.fecha_registro, 'La fecha')
    case 'Imprevisto':
      return primerError(
        !form.causa?.trim() ? 'La causa es obligatoria' : null,
        validarLongitud(form.causa, LIMITES.causa, 'La causa'),
        validarNoFutura(form.fecha_registro, 'La fecha'),
      )
    case 'Ahorro':
      return primerError(
        !form.meta?.trim() ? 'El nombre de la meta es obligatorio' : null,
        validarLongitud(form.meta, LIMITES.meta, 'El nombre de la meta'),
        validarOrdenFechas(form.fecha_registro, form.fecha_meta, 'La fecha meta no puede ser anterior a la de registro'),
        form.fecha_meta && form.fecha_meta < hoyISO() ? 'La fecha meta no puede estar en el pasado' : null,
      )
    case 'Deuda':
      return primerError(
        !form.fuente?.trim() ? 'La fuente de la deuda es obligatoria' : null,
        validarLongitud(form.fuente, LIMITES.fuente, 'La fuente'),
        validarCuotas(form.cuotas_total),
        validarOrdenFechas(form.fecha_inicio, form.fecha_fin, 'La fecha de fin no puede ser anterior a la de inicio'),
      )
    default:
      return null
  }
}

// ── Subcomponentes reutilizables (antes duplicados 5x y 2x) ───
const CampoCategoria = ({ inputCls, categorias, value, onChange }) => (
  <>
    <label className={labelCls}>Categoría</label>
    <select
      className={inputCls}
      style={{ colorScheme: 'dark' }}
      name="id_categoria"
      value={value}
      onChange={onChange}
    >
      <option value="">Sin categoría</option>
      {categorias.filter(c => c.activa == 1).map(c => (
        <option key={c.id} value={c.id}>{c.nombre}</option>
      ))}
    </select>
  </>
)

const CampoDependiente = ({ inputCls, dependientes, value, onChange, placeholder }) => (
  <>
    <label className={labelCls}>Dependiente</label>
    <select
      className={inputCls}
      style={{ colorScheme: 'dark' }}
      name="id_dependientes"
      value={value}
      onChange={onChange}
    >
      <option value="">{placeholder}</option>
      {dependientes.map(d => (
        <option key={d.id_dependientes} value={d.id_dependientes}>{d.Nombre}</option>
      ))}
    </select>
  </>
)

export default function ModalNuevoMovimiento({ subtipo, onCerrar, onGuardado }) {
  const cfg   = CONFIG[subtipo]
  const color = COLORES[cfg.color]
  const inputCls = mkInput(color.ring)
  const { mostrarToast } = useToast()
  const { revisarAhora } = useNotificaciones()

  const [form,         setForm]         = useState(INICIAL[subtipo])
  const [categorias,   setCategorias]   = useState([])
  const [dependientes, setDependientes] = useState([])
  const [cargando,     setCargando]     = useState(false)
  const [error,        setError]        = useState(null)

  useEffect(() => {
    getCategorias().then(d => { if (Array.isArray(d)) setCategorias(d) }).catch(() => {})
    if (['Gasto', 'Imprevisto'].includes(subtipo)) {
      getDependientes().then(d => { if (Array.isArray(d)) setDependientes(d) }).catch(() => {})
    }
  }, [subtipo])

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCerrar])

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async () => {
    setError(null)
    const err = validar(subtipo, form)
    if (err) return setError(err)

    setCargando(true)
    try {
      const token = localStorage.getItem('token')
      const res   = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tipo_flujo:     cfg.tipo_flujo,
          subtipo_modulo: subtipo,
          datos:          buildDatos(subtipo, form),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        mostrarToast(`${cfg.label} registrado correctamente`)
        revisarAhora()
        onGuardado?.()
        onCerrar()
      }
      else setError(data.mensaje || 'Error al registrar')
    } catch { setError('Error al conectar con el servidor') }
    finally { setCargando(false) }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && onCerrar()}>

      <div className="w-full sm:max-w-[460px] rounded-t-[24px] sm:rounded-[20px] border border-white/[0.12] shadow-[0_24px_60px_rgba(0,0,0,0.6)] max-h-[92vh] flex flex-col"
        style={{ background: 'rgba(15,23,42,0.97)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.08] shrink-0">
          <div>
            <h4 className={`text-lg font-extrabold ${color.title}`}>
              {cfg.emoji} Registrar {cfg.label}
            </h4>
            <p className="text-xs text-zinc-500 mt-0.5">
              {cfg.tipo_flujo === 'Entrada' ? 'Movimiento de entrada' : 'Movimiento de salida'} — todos los campos marcados con * son obligatorios
            </p>
          </div>
          <button onClick={onCerrar}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.08] transition-colors text-lg leading-none">
            ✕
          </button>
        </div>

        {/* Cuerpo scrollable */}
        <div className="overflow-y-auto px-6 py-4 flex-1">

          {/* Monto — siempre primero y destacado */}
          <label className="block text-[0.72rem] font-bold uppercase tracking-[0.06em] text-zinc-400">
            Monto *
          </label>
          <div className="relative mt-1.5">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">$</span>
            <input
              className={`${inputCls} pl-7 text-base font-bold`}
              type="number" name="monto" min={subtipo === 'Gasto' ? MONTO_MINIMO_GASTO : 0.01} step="0.01"
              placeholder="0" autoFocus
              value={form.monto} onChange={handleChange}
            />
          </div>

          {/* ── Campos por subtipo ── */}

          {subtipo === 'Ingreso' && <>
            <label className={labelCls}>Fuente</label>
            <input className={inputCls} type="text" name="fuente" maxLength={LIMITES.fuente} placeholder="Ej: Salario, Freelance..." value={form.fuente} onChange={handleChange} />
            <CampoCategoria inputCls={inputCls} categorias={categorias} value={form.id_categoria} onChange={handleChange} />
            <label className={labelCls}>Descripción</label>
            <input className={inputCls} type="text" name="descripcion" maxLength={LIMITES.descripcion} placeholder="Descripción opcional" value={form.descripcion} onChange={handleChange} />
            <label className={labelCls}>Fecha</label>
            <input className={inputCls} type="date" name="fecha_registro" max={hoyISO()} value={form.fecha_registro} onChange={handleChange} />
          </>}

          {subtipo === 'Ahorro' && <>
            <label className={labelCls}>Meta u objetivo *</label>
            <input className={inputCls} type="text" name="meta" maxLength={LIMITES.meta} placeholder="Ej: Vacaciones, Fondo de emergencia..." value={form.meta} onChange={handleChange} />
            <CampoCategoria inputCls={inputCls} categorias={categorias} value={form.id_categoria} onChange={handleChange} />
            <label className={labelCls}>Descripción</label>
            <input className={inputCls} type="text" name="descripcion" maxLength={LIMITES.descripcion} placeholder="Descripción opcional" value={form.descripcion} onChange={handleChange} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fecha de registro</label>
                <input className={inputCls} type="date" name="fecha_registro" value={form.fecha_registro} onChange={handleChange} />
              </div>
              <div>
                <label className={labelCls}>Fecha meta</label>
                <input className={inputCls} type="date" name="fecha_meta" min={hoyISO()} value={form.fecha_meta} onChange={handleChange} />
              </div>
            </div>
          </>}

          {subtipo === 'Gasto' && <>
            <CampoCategoria inputCls={inputCls} categorias={categorias} value={form.id_categoria} onChange={handleChange} />
            <CampoDependiente inputCls={inputCls} dependientes={dependientes} value={form.id_dependientes} onChange={handleChange} placeholder="Ninguno (gasto propio)" />
            <label className={labelCls}>Descripción</label>
            <input className={inputCls} type="text" name="descripcion" maxLength={LIMITES.descripcion} placeholder="Descripción opcional" value={form.descripcion} onChange={handleChange} />
            <label className={labelCls}>Fecha</label>
            <input className={inputCls} type="date" name="fecha_registro" max={hoyISO()} value={form.fecha_registro} onChange={handleChange} />
          </>}

          {subtipo === 'Deuda' && <>
            <label className={labelCls}>Fuente *</label>
            <input className={inputCls} type="text" name="fuente" maxLength={LIMITES.fuente} placeholder="Ej: Banco, Tarjeta de crédito..." value={form.fuente} onChange={handleChange} />
            <CampoCategoria inputCls={inputCls} categorias={categorias} value={form.id_categoria} onChange={handleChange} />
            <label className={labelCls}>Número de cuotas</label>
            <input className={inputCls} type="number" name="cuotas_total" min="1" step="1" placeholder="Vacío si es pago único" value={form.cuotas_total} onChange={handleChange} />
            <label className={labelCls}>Descripción</label>
            <input className={inputCls} type="text" name="descripcion" maxLength={LIMITES.descripcion} placeholder="Descripción opcional" value={form.descripcion} onChange={handleChange} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fecha inicio</label>
                <input className={inputCls} type="date" name="fecha_inicio" value={form.fecha_inicio} onChange={handleChange} />
              </div>
              <div>
                <label className={labelCls}>Fecha fin</label>
                <input className={inputCls} type="date" name="fecha_fin" value={form.fecha_fin} onChange={handleChange} />
              </div>
            </div>
          </>}

          {subtipo === 'Imprevisto' && <>
            <label className={labelCls}>Causa *</label>
            <input className={inputCls} type="text" name="causa" maxLength={LIMITES.causa} placeholder="Ej: Reparación, Emergencia médica..." value={form.causa} onChange={handleChange} />
            <CampoCategoria inputCls={inputCls} categorias={categorias} value={form.id_categoria} onChange={handleChange} />
            <CampoDependiente inputCls={inputCls} dependientes={dependientes} value={form.id_dependientes} onChange={handleChange} placeholder="Ninguno (imprevisto propio)" />
            <label className={labelCls}>Fecha</label>
            <input className={inputCls} type="date" name="fecha_registro" max={hoyISO()} value={form.fecha_registro} onChange={handleChange} />
          </>}

          {error && (
            <p className="mt-4 p-[10px_14px] rounded-[10px] bg-red-400/[0.12] border border-red-400/35 text-red-400 text-[0.8rem] font-semibold">
              {error}
            </p>
          )}
        </div>

        {/* Footer fijo */}
        <div className="px-6 py-4 border-t border-white/[0.08] shrink-0 flex justify-end gap-2.5">
          <button onClick={onCerrar}
            className="px-5 py-2.5 rounded-[10px] text-sm font-bold bg-transparent text-zinc-400 border border-white/[0.15] hover:bg-white/[0.07] transition-colors">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={cargando}
            className={`px-5 py-2.5 rounded-[10px] text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${color.btnText ?? 'text-white'}`}
            style={{ background: cargando ? 'rgba(100,100,100,0.3)' : color.btn }}>
            {cargando ? 'Guardando...' : `Registrar ${cfg.label}`}
          </button>
        </div>
      </div>
    </div>
  )
}