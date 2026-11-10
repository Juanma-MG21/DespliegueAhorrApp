import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import ModalNuevoMovimiento from '../components/Modalnuevomovimiento'
import { getCategorias } from '../services/api'
import HeaderModulos from '../components/HeaderModulos'
import { useToast } from '../context/ToastContext'
import { useNotificaciones } from '../context/NotificacionesContext'
import { validarMonto, validarLongitud, validarNoFutura, primerError, LIMITES, hoyISO } from '../utils/validaciones'

// const API = 'http://localhost:3000/api/movimientos'
const API = '/api/movimientos'

const fmt    = (n)   => `$${Number(n).toLocaleString('es-CO')}`
const fmtFecha = (f) => {
  if (!f) return '—'
  const [y, m, d] = f.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const inputCls = 'mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.07] px-3.5 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-red-400/60 focus:ring-2 focus:ring-red-400/20'
const selectCls = inputCls 
const labelCls = 'mt-3.5 block text-[0.72rem] font-bold uppercase tracking-[0.06em] text-zinc-400'

export default function ModuloIngresos() {
  const navigate  = useNavigate()
  const usuario   = useMemo(() => { try { return JSON.parse(localStorage.getItem('usuario')) } catch { return null } }, [])
  const { mostrarToast } = useToast()
  const { revisarAhora } = useNotificaciones()

  const [ingresos,    setIngresos]    = useState([])
  const [cargando,    setCargando]    = useState(true)
  const [modalNuevo,  setModalNuevo]  = useState(false)
  const [categorias,  setCategorias]  = useState([])
  const [modalEditar, setModalEditar] = useState(null)
  const [confirmarId, setConfirmarId] = useState(null)
  const [guardando,   setGuardando]   = useState(false)
  const [eliminando,  setEliminando]  = useState(false)
  const [errorModal,  setErrorModal]  = useState(null)

  const cargar = () => {
    setCargando(true)
    const token = localStorage.getItem('token')
    fetch(`${API}/ingresos`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setIngresos(d) })
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargar()
    getCategorias().then(d => { if (Array.isArray(d)) setCategorias(d) }).catch(() => {})
  }, [])

  const total = useMemo(() => ingresos.reduce((a, i) => a + Number(i.monto || 0), 0), [ingresos])

  const abrirEditar = (i) => {
    setErrorModal(null)
    setModalEditar({
      id: i.id, monto: String(i.monto),
      fuente: i.fuente || '', descripcion: i.descripcion || '',
      fecha_registro: i.fecha ? i.fecha.slice(0, 10) : '',
      id_categoria: i.id_categoria || '',
    })
  }

  const handleChange = (e) => setModalEditar(p => ({ ...p, [e.target.name]: e.target.value }))

  const guardar = async () => {
    setErrorModal(null)
    const err = primerError(
      validarMonto(modalEditar.monto),
      validarLongitud(modalEditar.fuente, LIMITES.fuente, 'La fuente'),
      validarLongitud(modalEditar.descripcion, LIMITES.descripcion, 'La descripción'),
      validarNoFutura(modalEditar.fecha_registro, 'La fecha'),
    )
    if (err) return setErrorModal(err)
    setGuardando(true)
    const token = localStorage.getItem('token')
    try {
      const res  = await fetch(`${API}/ingresos/${modalEditar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          monto: Number(modalEditar.monto),
          fuente: modalEditar.fuente || null,
          descripcion: modalEditar.descripcion || null,
          fecha_registro: modalEditar.fecha_registro || null,
          id_categoria: modalEditar.id_categoria || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        mostrarToast('Ingreso actualizado correctamente')
        revisarAhora()
        setModalEditar(null)
        cargar()
      }
      else setErrorModal(data.mensaje || 'Error al guardar')
    } catch { setErrorModal('Error al conectar con el servidor') }
    finally { setGuardando(false) }
  }

  const eliminar = async () => {
    setEliminando(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API}/ingresos/${confirmarId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        mostrarToast('Ingreso eliminado correctamente')
        revisarAhora()
        setConfirmarId(null)
        cargar()
      }
    } catch {}
    finally { setEliminando(false) }
  }

  return (
    <div className="min-h-screen w-full flex flex-col text-white overflow-x-hidden"
      style={{ background: 'radial-gradient(ellipse at 30% 20%, #1e3a5f 10%, #0f172a 60%, #1a0f2e 100%)' }}>

      <HeaderModulos section="Ingresos" />
      <hr className="my-1 h-px border-0 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

      <main className="flex-1 flex flex-col w-full max-w-[1400px] mx-auto px-4 py-5 sm:px-6 sm:py-6 md:p-8 gap-6">

        <div>
          <p className="text-sm text-zinc-400">Bienvenido de vuelta</p>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">{usuario?.nombre || 'Usuario'} <span>👋</span></h2>
        </div>

        {/* Stat card */}
        <article className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 sm:px-8 py-5 sm:py-6 rounded-2xl border border-white/10"
          style={{ background: 'radial-gradient(ellipse at left, rgba(34,197,94,0.35), rgba(16,185,129,0.04))' }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">💰 Total Ingresos</p>
            <p className="text-3xl sm:text-4xl font-black text-white">{fmt(total)}</p>
            <p className="text-xs text-zinc-500 mt-1">{ingresos.length} registro{ingresos.length !== 1 ? 's' : ''} en total</p>
          </div>
          <button onClick={() => setModalNuevo(true)}
            className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-sm text-slate-900 transition-all duration-300 hover:-translate-y-px"
            style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>
            ➕ Agregar Ingreso
          </button>
        </article>

        {/* Tabla */}
        <section className="w-full rounded-2xl border border-white/10 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)' }}>

          <div className="flex items-center justify-between px-5 sm:px-7 py-4 sm:py-5 border-b border-white/[0.08]">
            <h3 className="text-base font-extrabold text-amber-400">📋 Módulo de Ingresos</h3>
            <span className="text-xs text-zinc-600">{ingresos.length} registro{ingresos.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="p-4 sm:p-5">
            {cargando ? (
              <p className="py-8 text-center text-sm italic text-zinc-500 animate-pulse">⏳ Cargando ingresos...</p>
            ) : ingresos.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3 text-center">
                <span className="text-4xl opacity-30">💰</span>
                <p className="text-zinc-400 text-sm">No hay ingresos registrados aún.</p>
                <button onClick={() => setModalNuevo(true)}
                  className="mt-2 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-900"
                  style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>
                  Registrar primer ingreso
                </button>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="flex flex-col gap-3 md:hidden">
                  {ingresos.map(i => (
                    <article key={i.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{i.fuente || 'Sin fuente'}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{fmtFecha(i.fecha)}</p>
                          {i.descripcion && <p className="text-xs text-zinc-400 mt-1 truncate">{i.descripcion}</p>}
                          {i.categoria && <p className="text-xs text-zinc-500 mt-1">📂 {i.categoria}</p>}
                        </div>
                        <p className="shrink-0 text-base font-black text-emerald-400">{fmt(i.monto)}</p>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button onClick={() => abrirEditar(i)} className="rounded-lg border border-emerald-400/50 bg-emerald-400/10 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-400/20 transition-colors">Editar</button>
                        <button onClick={() => setConfirmarId(i.id)} className="rounded-lg border border-red-400/50 bg-red-400/10 py-2 text-xs font-bold text-red-400 hover:bg-red-400/20 transition-colors">Eliminar</button>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[750px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-white/10">
                        {['Fecha', 'Fuente', 'Categoría', 'Descripción', 'Monto', 'Acciones'].map(col => (
                          <th key={col} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ingresos.map(i => (
                        <tr key={i.id} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors">
                          <td className="px-4 py-3 text-sm text-zinc-300">{fmtFecha(i.fecha)}</td>
                          <td className="px-4 py-3 text-sm text-zinc-300">{i.fuente || '—'}</td>
                          <td className="px-4 py-3 text-sm text-zinc-300">{i.categoria || '—'}</td>
                          <td className="px-4 py-3 text-sm text-zinc-300 max-w-[200px] truncate">{i.descripcion || '—'}</td>
                          <td className="px-4 py-3 text-sm font-extrabold text-emerald-400">{fmt(i.monto)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => abrirEditar(i)} className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-emerald-400/50 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 transition-colors">Editar</button>
                              <button onClick={() => setConfirmarId(i.id)} className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-red-400/50 bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors">Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="w-full px-4 py-6 text-center font-mono text-[0.7rem] text-zinc-600">
        <p>© <strong className="text-amber-400">2026 Ahorrapp</strong>. Todos los derechos reservados.</p>
      </footer>

      {/* Modal Editar */}
      {modalEditar && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md">
          <div className="w-full max-w-[460px] rounded-[20px] p-7 border border-white/[0.12] shadow-[0_24px_60px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto"
            style={{ background: 'rgba(15,23,42,0.95)' }}>
            <h4 className="text-lg font-extrabold text-emerald-400 mb-1">✏️ Editar Ingreso</h4>
            <p className="text-xs text-zinc-500 mb-2">Modifica los campos que necesites y guarda.</p>

            <label className={labelCls}>Monto *</label>
            <input className={inputCls} type="number" name="monto" min="0.01" step="0.01" value={modalEditar.monto} onChange={handleChange} />

            <label className={labelCls}>Fuente</label>
            <input className={inputCls} type="text" name="fuente" maxLength={LIMITES.fuente} placeholder="Ej: Salario, Freelance..." value={modalEditar.fuente} onChange={handleChange} />

            <label className={labelCls}>Categoría</label>
            <select
              className={selectCls}
              style={{ colorScheme: 'dark' }}
              name="id_categoria"
              value={modalEditar.id_categoria}
              onChange={handleChange}
            >
              <option value="" style={{ backgroundColor: '#1f2937', color: '#f4f4f5' }}>Sin categoría</option>
              {categorias.filter(c => c.activa == 1).map(c => (
                <option key={c.id} value={c.id} style={{ backgroundColor: '#1f2937', color: '#f4f4f5' }}>
                  {c.nombre}
                </option>
              ))}
            </select>

            <label className={labelCls}>Descripción</label>
            <input className={inputCls} type="text" name="descripcion" maxLength={LIMITES.descripcion} placeholder="Descripción opcional" value={modalEditar.descripcion} onChange={handleChange} />

            <label className={labelCls}>Fecha</label>
            <input className={inputCls} type="date" name="fecha_registro" max={hoyISO()} value={modalEditar.fecha_registro} onChange={handleChange} />

            {errorModal && <p className="mt-3 p-[10px_14px] rounded-[10px] bg-red-400/[0.12] border border-red-400/35 text-red-400 text-[0.8rem] font-semibold">{errorModal}</p>}

            <div className="mt-6 flex justify-end gap-2.5">
              <button onClick={() => setModalEditar(null)} className="px-5 py-2.5 rounded-[10px] text-sm font-bold bg-transparent text-zinc-400 border border-white/[0.15] hover:bg-white/[0.07] transition-colors">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="px-5 py-2.5 rounded-[10px] text-sm font-bold text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{ background: guardando ? 'rgba(52,211,153,0.4)' : 'linear-gradient(135deg, #34d399, #10b981)' }}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar */}
      {confirmarId && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md">
          <div className="w-full max-w-[380px] rounded-[20px] p-7 border border-red-400/25 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
            style={{ background: 'rgba(15,23,42,0.95)' }}>
            <h4 className="text-lg font-extrabold text-red-400 mb-2">🗑️ ¿Eliminar ingreso?</h4>
            <p className="text-sm text-zinc-400">Esta acción no se puede deshacer.</p>
            <div className="mt-6 flex justify-end gap-2.5">
              <button onClick={() => setConfirmarId(null)} className="px-5 py-2.5 rounded-[10px] text-sm font-bold bg-transparent text-zinc-400 border border-white/[0.15] hover:bg-white/[0.07] transition-colors">Cancelar</button>
              <button onClick={eliminar} disabled={eliminando} className="px-5 py-2.5 rounded-[10px] text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{ background: eliminando ? 'rgba(248,113,113,0.4)' : 'linear-gradient(135deg, #f87171, #ef4444)' }}>
                {eliminando ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalNuevo && (
        <ModalNuevoMovimiento
          subtipo="Ingreso"
          onCerrar={() => setModalNuevo(false)}
          onGuardado={() => cargar()}
        />
      )}
    </div>
  )
}