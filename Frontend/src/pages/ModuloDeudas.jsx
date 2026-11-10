import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCategorias, abonarDeuda } from '../services/api'
import ModalNuevoMovimiento from '../components/Modalnuevomovimiento'
import HeaderModulos from '../components/HeaderModulos'
import { useToast } from '../context/ToastContext'
import { useNotificaciones } from '../context/NotificacionesContext'
import { validarMonto, validarLongitud, validarCuotas, primerError, LIMITES } from '../utils/validaciones'

// const API = 'http://localhost:3000/api/movimientos'
const API = '/api/movimientos'


const fmt = (n) => `$${Math.round(Number(n)).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
const fmtFecha = (f) => {
  if (!f) return '—'
  const [y, m, d] = f.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const inputCls = 'mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.07] px-3.5 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-red-400/60 focus:ring-2 focus:ring-red-400/20'
const selectCls = inputCls 
const labelCls = 'mt-3.5 block text-[0.72rem] font-bold uppercase tracking-[0.06em] text-zinc-400'

const costoPorCuota  = (monto, ct) => ct ? Number(monto) / Number(ct) : Number(monto)
const montoPagado    = (monto, cp, ct) => ct ? costoPorCuota(monto, ct) * Number(cp) : 0
const montoPendiente = (monto, cp, ct) => ct ? costoPorCuota(monto, ct) * (Number(ct) - Number(cp)) : Number(monto)

const formatCOP = (valor) =>
  Math.round(Number(valor)).toLocaleString('es-CO', { maximumFractionDigits: 0 })

const BadgeEstado = ({ estado }) => estado === 'pagada'
  ? <span className="px-2.5 py-1 rounded-full text-[0.8rem] font-bold bg-emerald-400/15 text-emerald-400 border border-emerald-400/35">Pagada</span>
  : <span className="px-2.5 py-1 rounded-full text-[0.8rem] font-bold bg-blue-400/15 text-blue-400 border border-blue-400/35">Pendiente</span>

const BadgeVencimiento = ({ fecha_fin, estado }) => {
  if (!fecha_fin || estado === 'pagada') return null
  const diffDias = Math.ceil((new Date(fecha_fin) - new Date()) / (1000 * 60 * 60 * 24))
  if (diffDias < 0)
    return <span className="px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-red-400/20 text-red-400 border border-red-400/35">⚠ Vencida</span>
  if (diffDias <= 7)
    return <span className="px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-amber-400/20 text-amber-400 border border-amber-400/35">⏰ Vence en {diffDias}d</span>
  return null
}

const BarraCuotas = ({ monto, cuotas_pagadas: cp, cuotas_total: ct }) => {
  if (!ct) return <p className="text-xs text-zinc-500 mt-1">Pago único</p>
  const pct = Math.min(100, (Number(cp) / Number(ct)) * 100)
  return (
    <div className="mt-2 w-full">
      <div className="flex justify-between text-[0.7rem] mb-1">
        <span className="text-zinc-400 font-semibold">{cp}/{ct} cuotas</span>
        <span className="text-zinc-500">{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: pct >= 100 ? 'linear-gradient(90deg,#34d399,#10b981)' : 'linear-gradient(90deg,#c084fc,#a855f7)' }} />
      </div>
      <div className="flex justify-between mt-1.5 text-[0.68rem] flex-wrap gap-x-3">
        <span className="text-zinc-500">Por cuota: <span className="text-zinc-300 font-semibold">{fmt(costoPorCuota(monto, ct))}</span></span>
        <span className="text-emerald-400/80">Pagado: {fmt(montoPagado(monto, cp, ct))}</span>
        <span className="text-red-400/80">Pendiente: {fmt(montoPendiente(monto, cp, ct))}</span>
      </div>
    </div>
  )
}

export default function ModuloDeudas() {
  const navigate = useNavigate()
  const usuario  = useMemo(() => { try { return JSON.parse(localStorage.getItem('usuario')) } catch { return null } }, [])
  const { mostrarToast } = useToast()
  const { revisarAhora } = useNotificaciones()

  const [deudas,         setDeudas]         = useState([])
  const [cargando,       setCargando]       = useState(true)
  const [modalNuevo,     setModalNuevo]     = useState(false)
  const [categorias,     setCategorias]     = useState([])
  const [modalEditar,    setModalEditar]    = useState(null)
  const [modalAbonar,    setModalAbonar]    = useState(null)
  const [confirmarId,    setConfirmarId]    = useState(null)
  const [guardando,      setGuardando]      = useState(false)
  const [eliminando,     setEliminando]     = useState(false)
  const [abonando,       setAbonando]       = useState(false)
  const [cuotasAbono,    setCuotasAbono]    = useState('1')
  const [errorModal,     setErrorModal]     = useState(null)
  const [mostrarPagadas, setMostrarPagadas] = useState(false)

  const cargar = () => {
    setCargando(true)
    const token = localStorage.getItem('token')
    fetch(`${API}/deudas`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setDeudas(d) })
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargar()
    getCategorias().then(d => { if (Array.isArray(d)) setCategorias(d) }).catch(() => {})
  }, [])

  const pendientes     = useMemo(() => deudas.filter(d => d.estado !== 'pagada'), [deudas])
  const pagadas        = useMemo(() => deudas.filter(d => d.estado === 'pagada'),  [deudas])
  const totalDeuda     = useMemo(() => deudas.reduce((a, d) => a + Number(d.monto || 0), 0), [deudas])
  const totalPendiente = useMemo(() => pendientes.reduce((a, d) => a + montoPendiente(d.monto, d.cuotas_pagadas, d.cuotas_total), 0), [pendientes])

  const abrirEditar = (d) => {
    setErrorModal(null)
    setModalEditar({
      id: d.id, monto: String(d.monto), fuente: d.fuente || '',
      descripcion: d.descripcion || '', estado: d.estado || 'pendiente',
      cuotas_pagadas: String(d.cuotas_pagadas ?? 0),
      cuotas_total: d.cuotas_total ? String(d.cuotas_total) : '',
      fecha_inicio: d.fecha_inicio ? d.fecha_inicio.slice(0, 10) : '',
      fecha_fin: d.fecha_fin ? d.fecha_fin.slice(0, 10) : '',
      id_categoria: d.id_categoria || '',
    })
  }

  const abrirAbonar = (d) => { setErrorModal(null); setCuotasAbono('1'); setModalAbonar(d) }
  const handleChange = (e) => setModalEditar(p => ({ ...p, [e.target.name]: e.target.value }))

  const guardar = async () => {
    setErrorModal(null)
    const errCampos = primerError(
      validarMonto(modalEditar.monto),
      !modalEditar.fuente.trim() ? 'La fuente es obligatoria' : null,
      validarLongitud(modalEditar.fuente, LIMITES.fuente, 'La fuente'),
      validarLongitud(modalEditar.descripcion, LIMITES.descripcion, 'La descripción'),
      validarCuotas(modalEditar.cuotas_total),
      (!Number.isInteger(Number(modalEditar.cuotas_pagadas)) || Number(modalEditar.cuotas_pagadas) < 0)
        ? 'Las cuotas pagadas deben ser un entero mayor o igual a 0' : null,
    )
    if (errCampos) return setErrorModal(errCampos)
    if (modalEditar.fecha_fin && modalEditar.fecha_inicio && modalEditar.fecha_fin < modalEditar.fecha_inicio)
      return setErrorModal('La fecha fin no puede ser anterior a la de inicio')
    const cp = Number(modalEditar.cuotas_pagadas)
    const ct = modalEditar.cuotas_total ? Number(modalEditar.cuotas_total) : null
    if (ct !== null && cp > ct) return setErrorModal('Las cuotas pagadas no pueden superar el total')

    // Si hay cuotas_total definido, el estado se deriva de las cuotas (fuente de verdad),
    // ignorando lo que diga el select manual de Estado.
    const estadoFinal = ct !== null
      ? (cp >= ct ? 'pagada' : 'pendiente')
      : (cp >= 1 ? 'pagada' : modalEditar.estado) // pago único: 1 cuota pagada = pagada

    setGuardando(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API}/deudas/${modalEditar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          monto: Number(modalEditar.monto), fuente: modalEditar.fuente.trim(),
          descripcion: modalEditar.descripcion || null, estado: estadoFinal,
          cuotas_pagadas: cp, cuotas_total: ct,
          fecha_inicio: modalEditar.fecha_inicio || null,
          fecha_fin: modalEditar.fecha_fin || null,
          id_categoria: modalEditar.id_categoria || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        mostrarToast('Deuda actualizada correctamente')
        revisarAhora()
        setModalEditar(null)
        cargar()
      }
      else setErrorModal(data.mensaje || 'Error al guardar')
    } catch { setErrorModal('Error al conectar con el servidor') }
    finally { setGuardando(false) }
  }

  const hacerAbono = async () => {
    setErrorModal(null)
    const cuotas = parseInt(cuotasAbono)
    if (!cuotas || cuotas < 1) return setErrorModal('El número de cuotas debe ser al menos 1')
    // Pago único (sin cuotas_total) equivale a 1 cuota. Mismo mensaje que el móvil y el backend.
    const pendientesAbono = (modalAbonar.cuotas_total ?? 1) - (modalAbonar.cuotas_pagadas ?? 0)
    if (cuotas > pendientesAbono) return setErrorModal(`Quedan ${pendientesAbono} cuota(s) por pagar.`)
    setAbonando(true)
    try {
      const data = await abonarDeuda(modalAbonar.id, cuotas)
      if (data.ok) {
        mostrarToast(data.estado === 'pagada' ? 'Deuda pagada completamente' : 'Abono registrado correctamente')
        revisarAhora()
        setModalAbonar(null)
        cargar()
      }
      else setErrorModal(data.mensaje || 'Error al abonar')
    } catch { setErrorModal('Error al conectar con el servidor') }
    finally { setAbonando(false) }
  }

  const eliminar = async () => {
    setEliminando(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API}/deudas/${confirmarId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        mostrarToast('Deuda eliminada correctamente')
        revisarAhora()
        setConfirmarId(null)
        cargar()
      }
    } catch {}
    finally { setEliminando(false) }
  }

  const renderCard = (d) => (
    <article key={d.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white truncate">{d.fuente || 'Sin fuente'}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{fmtFecha(d.fecha_inicio)}</p>
          {d.descripcion && <p className="text-xs text-zinc-400 mt-1 truncate">{d.descripcion}</p>}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <BadgeEstado estado={d.estado} />
            <BadgeVencimiento fecha_fin={d.fecha_fin} estado={d.estado} />
          </div>
          <BarraCuotas monto={d.monto} cuotas_pagadas={d.cuotas_pagadas} cuotas_total={d.cuotas_total} />
        </div>
        <p className="shrink-0 text-base font-black text-purple-400">{fmt(d.monto)}</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {d.estado !== 'pagada' && (
          <button onClick={() => abrirAbonar(d)} className="rounded-lg border border-purple-400/50 bg-purple-400/10 py-2 text-xs font-bold text-purple-400 hover:bg-purple-400/20 transition-colors">Abonar</button>
        )}
        <button onClick={() => abrirEditar(d)} className={`rounded-lg border border-blue-400/50 bg-blue-400/10 py-2 text-xs font-bold text-blue-400 hover:bg-blue-400/20 transition-colors ${d.estado === 'pagada' ? 'col-span-2' : ''}`}>Editar</button>
        <button onClick={() => setConfirmarId(d.id)} className="rounded-lg border border-red-400/50 bg-red-400/10 py-2 text-xs font-bold text-red-400 hover:bg-red-400/20 transition-colors">Eliminar</button>
      </div>
    </article>
  )

  const renderFila = (d) => (
    <tr key={d.id} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-white">{d.fuente || '—'}</p>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          <BadgeVencimiento fecha_fin={d.fecha_fin} estado={d.estado} />
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-zinc-300">{d.categoria || '—'}</td>
      <td className="px-4 py-3 text-sm text-zinc-300 max-w-[150px] truncate">{d.descripcion || '—'}</td>
      <td className="px-4 py-3 min-w-[200px]">
        <BarraCuotas monto={d.monto} cuotas_pagadas={d.cuotas_pagadas} cuotas_total={d.cuotas_total} />
      </td>
      <td className="px-4 py-3 text-sm text-zinc-300">{fmtFecha(d.fecha_fin)}</td>
      <td className="px-4 py-3"><BadgeEstado estado={d.estado} /></td>
      <td className="px-4 py-3 text-sm font-extrabold text-purple-400">{fmt(d.monto)}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {d.estado !== 'pagada' && (
            <button onClick={() => abrirAbonar(d)} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-purple-400/50 bg-purple-400/10 text-purple-400 hover:bg-purple-400/20 transition-colors">Abonar</button>
          )}
          <button onClick={() => abrirEditar(d)} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-400/50 bg-blue-400/10 text-blue-400 hover:bg-blue-400/20 transition-colors">Editar</button>
          <button onClick={() => setConfirmarId(d.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-400/50 bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors">Eliminar</button>
        </div>
      </td>
    </tr>
  )

  const cols = ['Fuente', 'Categoría', 'Descripción', 'Progreso', 'Vence', 'Estado', 'Monto', 'Acciones']

  return (
    <div className="min-h-screen w-full flex flex-col text-white overflow-x-hidden"
      style={{ background: 'radial-gradient(ellipse at 30% 20%, #1e3a5f 10%, #0f172a 60%, #1a0f2e 100%)' }}>

      <HeaderModulos section="Deudas" />
      <hr className="my-1 h-px border-0 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

      <main className="flex-1 flex flex-col w-full max-w-[1400px] mx-auto px-4 py-5 sm:px-6 sm:py-6 md:p-8 gap-6">

        <div>
          <p className="text-sm text-zinc-400">Bienvenido de vuelta</p>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">{usuario?.nombre || 'Usuario'} <span>👋</span></h2>
        </div>

        {/* Stat card */}
        <article className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 sm:px-8 py-5 sm:py-6 rounded-2xl border border-white/10"
          style={{ background: 'radial-gradient(ellipse at left, rgba(168,85,247,0.35), rgba(147,51,234,0.04))' }}>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-purple-400">💳 Resumen de Deudas</p>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-3xl sm:text-4xl font-black text-white">{fmt(totalDeuda)}</p>
              {pendientes.length > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-400/15 text-blue-400 border border-blue-400/30 font-bold">
                  {pendientes.length} pendiente{pendientes.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {totalPendiente > 0 && (
              <p className="text-sm text-zinc-400">Por pagar: <span className="text-red-400 font-bold">{fmt(totalPendiente)}</span></p>
            )}
          </div>
          <button onClick={() => setModalNuevo(true)}
            className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-sm text-white transition-all duration-300 hover:-translate-y-px"
            style={{ background: 'linear-gradient(135deg, #c084fc, #a855f7)' }}>
            ➕ Nueva Deuda
          </button>
        </article>

        {/* Deudas pendientes */}
        <section className="w-full rounded-2xl border border-white/10 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center justify-between px-5 sm:px-7 py-4 sm:py-5 border-b border-white/[0.08]">
            <h3 className="text-base font-extrabold text-amber-400">📋 Deudas Pendientes</h3>
            <span className="text-xs text-zinc-600">{pendientes.length} registro{pendientes.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="p-4 sm:p-5">
            {cargando ? (
              <p className="py-8 text-center text-sm italic text-zinc-500 animate-pulse">⏳ Cargando deudas...</p>
            ) : pendientes.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-3 text-center">
                <span className="text-4xl opacity-30">✅</span>
                <p className="text-zinc-400 text-sm">No tienes deudas pendientes.</p>
                <button onClick={() => setModalNuevo(true)} className="mt-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #c084fc, #a855f7)' }}>Registrar deuda</button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 md:hidden">{pendientes.map(renderCard)}</div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[1000px] border-collapse text-left">
                    <thead><tr className="border-b border-white/10">{cols.map(col => <th key={col} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">{col}</th>)}</tr></thead>
                    <tbody>{pendientes.map(renderFila)}</tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Deudas pagadas (colapsable) */}
        {pagadas.length > 0 && (
          <section className="w-full rounded-2xl border border-white/10 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
            style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)' }}>
            <button onClick={() => setMostrarPagadas(p => !p)}
              className="w-full flex items-center justify-between px-5 sm:px-7 py-4 sm:py-5 border-b border-white/[0.08] hover:bg-white/[0.03] transition-colors">
              <h3 className="text-base font-extrabold text-emerald-400">✓ Deudas Pagadas</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-600">{pagadas.length} registro{pagadas.length !== 1 ? 's' : ''}</span>
                <span className="text-zinc-500 text-sm">{mostrarPagadas ? '▲' : '▼'}</span>
              </div>
            </button>
            {mostrarPagadas && (
              <div className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 md:hidden">{pagadas.map(renderCard)}</div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[1000px] border-collapse text-left">
                    <thead><tr className="border-b border-white/10">{cols.map(col => <th key={col} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">{col}</th>)}</tr></thead>
                    <tbody>{pagadas.map(renderFila)}</tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="w-full px-4 py-6 text-center font-mono text-[0.7rem] text-zinc-600">
        <p>© <strong className="text-amber-400">2026 Ahorrapp</strong>. Todos los derechos reservados.</p>
      </footer>

      {/* Modal Abonar */}
      {modalAbonar && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md">
          <div className="w-full max-w-[420px] rounded-[20px] p-7 border border-purple-400/20 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
            style={{ background: 'rgba(15,23,42,0.95)' }}>
            <h4 className="text-lg font-extrabold text-purple-400 mb-1">💳 Abonar cuota</h4>
            <p className="text-xs text-zinc-400 mb-3 font-semibold">{modalAbonar.fuente}</p>
            {modalAbonar.cuotas_total
              ? <div className="mb-4"><BarraCuotas monto={modalAbonar.monto} cuotas_pagadas={modalAbonar.cuotas_pagadas} cuotas_total={modalAbonar.cuotas_total} /></div>
              : <p className="text-xs text-zinc-500 mb-4">Pago único — {fmt(modalAbonar.monto)}</p>
            }
            <label className={labelCls}>Número de cuotas a pagar *</label>
            <input className={inputCls} type="number" min="1" step="1" placeholder="1"
              value={cuotasAbono} onChange={e => setCuotasAbono(e.target.value)} />
            {modalAbonar.cuotas_total && Number(cuotasAbono) > 0 && (
              <p className="mt-2 text-xs text-zinc-400">Monto a registrar: <span className="text-purple-400 font-bold">{fmt(costoPorCuota(modalAbonar.monto, modalAbonar.cuotas_total) * Number(cuotasAbono))}</span></p>
            )}
            {errorModal && <p className="mt-3 p-[10px_14px] rounded-[10px] bg-red-400/[0.12] border border-red-400/35 text-red-400 text-[0.8rem] font-semibold">{errorModal}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button onClick={() => setModalAbonar(null)} className="px-5 py-2.5 rounded-[10px] text-sm font-bold bg-transparent text-zinc-400 border border-white/[0.15] hover:bg-white/[0.07] transition-colors">Cancelar</button>
              <button onClick={hacerAbono} disabled={abonando} className="px-5 py-2.5 rounded-[10px] text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{ background: abonando ? 'rgba(192,132,252,0.4)' : 'linear-gradient(135deg, #c084fc, #a855f7)' }}>
                {abonando ? 'Procesando...' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {modalEditar && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md">
          <div className="w-full max-w-[480px] rounded-[20px] p-7 border border-white/[0.12] shadow-[0_24px_60px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto"
            style={{ background: 'rgba(15,23,42,0.95)' }}>
            <h4 className="text-lg font-extrabold text-amber-400 mb-1">✏️ Editar Deuda</h4>
            <p className="text-xs text-zinc-500 mb-2">Modifica los campos que necesites y guarda.</p>

            <label className={labelCls}>Fuente *</label>
            <input className={inputCls} type="text" name="fuente" maxLength={LIMITES.fuente} placeholder="Ej: Banco, Tarjeta..." value={modalEditar.fuente} onChange={handleChange} />

            <label className={labelCls}>Monto *</label>
            <input className={inputCls} type="number" name="monto" min="0.01" step="0.01" value={modalEditar.monto} onChange={handleChange} />

            <label className={labelCls}>Categoría</label>
            <select
              className={selectCls}
              style={{ colorScheme: 'dark' }}
              name="id_categoria"
              value={modalEditar.id_categoria}
              onChange={handleChange}
            >
              <option value="" style={{ backgroundColor: '#1f2937', color: '#f4f4f5' }}>Sin categoría</option>
              {categorias.filter(c => c.activa).map(c => (
                <option key={c.id} value={c.id} style={{ backgroundColor: '#1f2937', color: '#f4f4f5' }}>
                  {c.nombre}
                </option>
              ))}
            </select>

            <label className={labelCls}>Descripción</label>
            <input className={inputCls} type="text" name="descripcion" maxLength={LIMITES.descripcion} placeholder="Descripción opcional" value={modalEditar.descripcion} onChange={handleChange} />

            {/* <label className={labelCls}>Estado</label>
            <select
              className={selectCls}
              style={{ colorScheme: 'dark' }}
              name="estado"
              value={modalEditar.estado}
              onChange={handleChange}
            >
              <option value="pendiente" style={{ backgroundColor: '#1f2937', color: '#f4f4f5' }}>Pendiente</option>
              <option value="pagada" style={{ backgroundColor: '#1f2937', color: '#f4f4f5' }}>Pagada</option>
            </select> */}

            <label className={labelCls}>Cuotas pagadas</label>
            <input className={inputCls} type="number" name="cuotas_pagadas" min="0" step="1" value={modalEditar.cuotas_pagadas} onChange={handleChange} />

            <label className={labelCls}>Total de cuotas</label>
            <input className={inputCls} type="number" name="cuotas_total" min="1" step="1" placeholder="Vacío si es pago único" value={modalEditar.cuotas_total} onChange={handleChange} />

            <label className={labelCls}>Fecha de inicio</label>
            <input className={inputCls} type="date" name="fecha_inicio" value={modalEditar.fecha_inicio} onChange={handleChange} />

            <label className={labelCls}>Fecha de fin</label>
            <input className={inputCls} type="date" name="fecha_fin" value={modalEditar.fecha_fin} onChange={handleChange} />

            {errorModal && <p className="mt-3 p-[10px_14px] rounded-[10px] bg-red-400/[0.12] border border-red-400/35 text-red-400 text-[0.8rem] font-semibold">{errorModal}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button onClick={() => setModalEditar(null)} className="px-5 py-2.5 rounded-[10px] text-sm font-bold bg-transparent text-zinc-400 border border-white/[0.15] hover:bg-white/[0.07] transition-colors">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="px-5 py-2.5 rounded-[10px] text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{ background: guardando ? 'rgba(192,132,252,0.4)' : 'linear-gradient(135deg, #c084fc, #a855f7)' }}>
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
            <h4 className="text-lg font-extrabold text-red-400 mb-2">🗑️ ¿Eliminar deuda?</h4>
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
        <ModalNuevoMovimiento subtipo="Deuda" onCerrar={() => setModalNuevo(false)} onGuardado={() => cargar()} />
      )}
    </div>
  )
}