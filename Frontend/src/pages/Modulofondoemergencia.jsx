import { useState, useEffect } from 'react'
import HeaderModulos from '../components/HeaderModulos'
import { useToast } from '../context/ToastContext'
import { validarMonto, validarLongitud, primerError, LIMITES } from '../utils/validaciones'
import {
  getFondoEmergencia,
  crearFondoEmergencia,
  actualizarMetaFondoEmergencia,
  registrarAporteFondo,
  registrarRetiroFondo,
  getMovimientosFondoEmergencia,
} from '../services/api'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`
const fmtFecha = (f) => {
  if (!f) return '—'
  const [y, m, d] = f.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const inputCls = 'mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.07] px-3.5 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20'
const labelCls = 'mt-3.5 block text-[0.72rem] font-bold uppercase tracking-[0.06em] text-zinc-400'

export default function ModuloFondoEmergencia() {
  const { mostrarToast } = useToast()

  const [fondo, setFondo] = useState(null)       // null = todavía no se sabe / no existe
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState(null)

  // Modales
  const [modalCrear, setModalCrear] = useState(false)
  const [modalMeta, setModalMeta] = useState(false)
  const [modalAporte, setModalAporte] = useState(false)
  const [modalRetiro, setModalRetiro] = useState(false)

  const [metaInput, setMetaInput] = useState('')
  const [montoInput, setMontoInput] = useState('')
  const [descInput, setDescInput] = useState('')

  const cargar = async () => {
    setCargando(true)
    try {
      const [resFondo, resMov] = await Promise.all([
        getFondoEmergencia().catch((e) => (e.status === 404 ? { ok: false, noExiste: true } : Promise.reject(e))),
        getMovimientosFondoEmergencia().catch(() => ({ ok: false, datos: [] })),
      ])
      if (resFondo?.ok) setFondo(resFondo.datos)
      else setFondo(null)
      setMovimientos(resMov?.datos || [])
    } catch (e) {
      console.error('Error cargando fondo de emergencia:', e)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const abrirModal = (setter) => { setErrorModal(null); setMontoInput(''); setDescInput(''); setter(true) }
  const cerrarModales = () => { setModalCrear(false); setModalMeta(false); setModalAporte(false); setModalRetiro(false); setErrorModal(null) }

  // ── Crear fondo ──
  const handleCrear = async () => {
    const meta = Number(metaInput)
    const errMeta = validarMonto(metaInput, { nombre: 'La meta', permitirCero: true })
    if (errMeta) return setErrorModal(errMeta)
    setGuardando(true)
    try {
      const data = await crearFondoEmergencia(meta)
      if (data.ok) {
        mostrarToast('Fondo de emergencia creado')
        setModalCrear(false)
        cargar()
      } else setErrorModal(data.mensaje || 'Error al crear el fondo')
    } catch { setErrorModal('Error al conectar con el servidor') }
    finally { setGuardando(false) }
  }

  // ── Editar meta ──
  const handleEditarMeta = async () => {
    const meta = Number(metaInput)
    const errMeta = validarMonto(metaInput, { nombre: 'La meta', permitirCero: true })
    if (errMeta) return setErrorModal(errMeta)
    setGuardando(true)
    try {
      const data = await actualizarMetaFondoEmergencia(meta)
      if (data.ok) {
        mostrarToast('Meta actualizada')
        setModalMeta(false)
        cargar()
      } else setErrorModal(data.mensaje || 'Error al actualizar la meta')
    } catch { setErrorModal('Error al conectar con el servidor') }
    finally { setGuardando(false) }
  }

  // ── Aportar ──
  const handleAporte = async () => {
    const monto = Number(montoInput)
    const errAporte = primerError(
      validarMonto(montoInput),
      validarLongitud(descInput, LIMITES.descripcion, 'La descripción'),
    )
    if (errAporte) return setErrorModal(errAporte)
    setGuardando(true)
    try {
      const data = await registrarAporteFondo(monto, descInput.trim() || null)
      if (data.ok) {
        mostrarToast('Aporte registrado')
        setModalAporte(false)
        cargar()
      } else setErrorModal(data.mensaje || 'Error al registrar el aporte')
    } catch { setErrorModal('Error al conectar con el servidor') }
    finally { setGuardando(false) }
  }

  // ── Retirar ──
  const handleRetiro = async () => {
    const monto = Number(montoInput)
    const errRetiro = primerError(
      validarMonto(montoInput),
      validarLongitud(descInput, LIMITES.descripcion, 'La descripción'),
    )
    if (errRetiro) return setErrorModal(errRetiro)
    if (fondo && monto > Number(fondo.saldo_actual)) return setErrorModal('El retiro no puede ser mayor al saldo disponible')
    setGuardando(true)
    try {
      const data = await registrarRetiroFondo(monto, descInput.trim() || null)
      if (data.ok) {
        mostrarToast('Retiro registrado')
        setModalRetiro(false)
        cargar()
      } else setErrorModal(data.mensaje || 'Error al registrar el retiro')
    } catch { setErrorModal('Error al conectar con el servidor') }
    finally { setGuardando(false) }
  }

  const saldo = Number(fondo?.saldo_actual || 0)
  const meta = Number(fondo?.meta || 0)
  const porcentaje = meta > 0 ? Math.min(100, (saldo / meta) * 100) : 0

  return (
    <div className="min-h-screen w-full flex flex-col text-white overflow-x-hidden"
      style={{ background: 'radial-gradient(ellipse at 30% 20%, #1e3a5f 10%, #0f172a 60%, #1a0f2e 100%)' }}>

      <HeaderModulos section="Fondo de Emergencia" />
      <hr className="my-1 h-px border-0 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

      <main className="flex-1 flex flex-col w-full max-w-[1400px] mx-auto px-4 py-5 sm:px-6 sm:py-6 md:p-8 gap-6">

        {cargando ? (
          <p className="text-sm text-zinc-400">Cargando...</p>

        ) : !fondo ? (
          // ── Sin fondo configurado todavía ──
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <p className="text-4xl mb-3">🛡️</p>
            <h2 className="text-lg font-extrabold text-zinc-100">Todavía no tienes un fondo de emergencia</h2>
            <p className="mt-2 text-sm text-zinc-400 max-w-md mx-auto">
              Un fondo de emergencia es dinero apartado para imprevistos grandes (pérdida de trabajo, salud, reparaciones urgentes).
              Definí una meta de ahorro para empezar.
            </p>
            <button
              onClick={() => abrirModal(setModalCrear)}
              className="mt-5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 px-6 py-2.5 text-sm font-bold text-slate-900"
            >
              Crear fondo de emergencia
            </button>
          </div>

        ) : (
          <>
            {/* ── Resumen ── */}
            <section className="rounded-2xl border border-white/10 p-6"
              style={{ background: 'radial-gradient(ellipse at left, rgba(251,191,36,0.25), rgba(251,191,36,0.03))' }}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Saldo actual</p>
                  <p className="mt-1 text-3xl font-black text-amber-300">{fmt(saldo)}</p>
                  <p className="mt-1 text-xs text-zinc-500">Meta: {fmt(meta)} · Creado el {fmtFecha(fondo.fecha_creacion)}</p>
                </div>
                <button
                  onClick={() => { setMetaInput(String(meta)); abrirModal(setModalMeta) }}
                  className="rounded-lg border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-zinc-300 hover:bg-white/10"
                >
                  Editar meta
                </button>
              </div>

              <div className="mt-4 h-3 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-zinc-400">{porcentaje.toFixed(1)}% de la meta</p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => abrirModal(setModalAporte)}
                  className="rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-900"
                >
                  + Aportar
                </button>
                <button
                  onClick={() => abrirModal(setModalRetiro)}
                  disabled={saldo <= 0}
                  className="rounded-xl border border-red-400/50 bg-red-400/10 px-5 py-2.5 text-sm font-bold text-red-400 hover:bg-red-400/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  − Retirar
                </button>
              </div>
            </section>

            {/* ── Historial de movimientos ── */}
            <section>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                Movimientos ({movimientos.length})
              </p>

              {movimientos.length === 0 ? (
                <p className="text-sm text-zinc-500">Todavía no registraste aportes ni retiros.</p>
              ) : (
                <div className="grid gap-2.5">
                  {movimientos.map((m) => (
                    <div
                      key={m.id_movimiento_fondo}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                          m.tipo === 'aporte' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'
                        }`}>
                          {m.tipo === 'aporte' ? '+' : '−'}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-zinc-100 capitalize">{m.tipo}</p>
                          <p className="text-xs text-zinc-500">{m.descripcion || 'Sin descripción'} · {fmtFecha(m.fecha_registro)}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-bold ${m.tipo === 'aporte' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {m.tipo === 'aporte' ? '+' : '−'}{fmt(m.monto)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* ── Modal: Crear fondo ── */}
      {modalCrear && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl sm:p-7">
            <h4 className="text-lg font-extrabold text-amber-400">🛡️ Crear Fondo de Emergencia</h4>
            <label className={labelCls}>Meta de ahorro *</label>
            <input className={inputCls} type="number" min="0" step="0.01" placeholder="Ej: 3000000"
              value={metaInput} onChange={(e) => setMetaInput(e.target.value)} disabled={guardando} />
            {errorModal && <p className="mt-3 text-xs font-semibold text-red-400">{errorModal}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={cerrarModales} disabled={guardando}
                className="rounded-xl border border-white/15 bg-transparent px-5 py-2.5 text-sm font-bold text-zinc-400 hover:bg-white/10 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleCrear} disabled={guardando}
                className="rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-slate-900 disabled:opacity-50">
                {guardando ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Editar meta ── */}
      {modalMeta && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl sm:p-7">
            <h4 className="text-lg font-extrabold text-amber-400">✏️ Editar meta</h4>
            <label className={labelCls}>Nueva meta *</label>
            <input className={inputCls} type="number" min="0" step="0.01"
              value={metaInput} onChange={(e) => setMetaInput(e.target.value)} disabled={guardando} />
            {errorModal && <p className="mt-3 text-xs font-semibold text-red-400">{errorModal}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={cerrarModales} disabled={guardando}
                className="rounded-xl border border-white/15 bg-transparent px-5 py-2.5 text-sm font-bold text-zinc-400 hover:bg-white/10 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleEditarMeta} disabled={guardando}
                className="rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-slate-900 disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Aportar ── */}
      {modalAporte && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl sm:p-7">
            <h4 className="text-lg font-extrabold text-emerald-400">+ Registrar aporte</h4>
            <label className={labelCls}>Monto *</label>
            <input className={inputCls} type="number" min="0.01" step="0.01" placeholder="Ej: 100000"
              value={montoInput} onChange={(e) => setMontoInput(e.target.value)} disabled={guardando} />
            <label className={labelCls}>Descripción</label>
            <input className={inputCls} type="text" maxLength={LIMITES.descripcion} placeholder="Opcional"
              value={descInput} onChange={(e) => setDescInput(e.target.value)} disabled={guardando} />
            {errorModal && <p className="mt-3 text-xs font-semibold text-red-400">{errorModal}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={cerrarModales} disabled={guardando}
                className="rounded-xl border border-white/15 bg-transparent px-5 py-2.5 text-sm font-bold text-zinc-400 hover:bg-white/10 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleAporte} disabled={guardando}
                className="rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-900 disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Aportar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Retirar ── */}
      {modalRetiro && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl sm:p-7">
            <h4 className="text-lg font-extrabold text-red-400">− Registrar retiro</h4>
            <p className="mt-1 text-xs text-zinc-500">Saldo disponible: {fmt(saldo)}</p>
            <label className={labelCls}>Monto *</label>
            <input className={inputCls} type="number" min="0.01" step="0.01" max={saldo} placeholder="Ej: 50000"
              value={montoInput} onChange={(e) => setMontoInput(e.target.value)} disabled={guardando} />
            <label className={labelCls}>Descripción</label>
            <input className={inputCls} type="text" maxLength={LIMITES.descripcion} placeholder="Opcional"
              value={descInput} onChange={(e) => setDescInput(e.target.value)} disabled={guardando} />
            {errorModal && <p className="mt-3 text-xs font-semibold text-red-400">{errorModal}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={cerrarModales} disabled={guardando}
                className="rounded-xl border border-white/15 bg-transparent px-5 py-2.5 text-sm font-bold text-zinc-400 hover:bg-white/10 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleRetiro} disabled={guardando}
                className="rounded-xl border border-red-400/50 bg-red-400/10 px-5 py-2.5 text-sm font-bold text-red-400 hover:bg-red-400/20 disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Retirar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}