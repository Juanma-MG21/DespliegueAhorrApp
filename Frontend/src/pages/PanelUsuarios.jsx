import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { actualizarRolUsuario } from '../services/api';

const ROLES = [
  { id: 1, nombre: 'user' },
  { id: 2, nombre: 'admin' },
  { id: 3, nombre: 'superuser' },
];

// Solo letras (con tildes/ñ), espacios, apóstrofes y guiones. Nada de números o símbolos raros.
const NOMBRE_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/;
// Validación de formato de correo razonable (no verifica que el dominio exista realmente).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

// Evita que se puedan escribir dígitos u otros símbolos no permitidos mientras se tipea
const limpiarTextoNombre = (valor) => valor.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'-]/g, '');

export default function PanelUsuarios() {
  const { user } = useAuth();
  const esSuperusuario = user?.roles?.includes('superuser');

  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [rolId, setRolId] = useState('');
  const [cargandoModal, setCargandoModal] = useState(false);

  useEffect(() => {
    getUsuarios();
  }, []);

  const getUsuarios = async () => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        // "http://localhost:3000/api/auth/PanelUsuarios",
        "/api/auth/PanelUsuarios",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }
      );

      console.log("Status:", response.status);

      const data = await response.json();
      console.log("Respuesta JSON:", data);

      if (data.ok && data.usuarios) {
        setUsuarios(data.usuarios);
      } else {
        setError(data.mensaje || "Error al procesar los usuarios");
      }

    } catch (err) {
      console.error(err);
      setError("Error al obtener usuarios");
    } finally {
      setCargando(false);
    }
  };

  const handleEditar = (usuario) => {
    setUsuarioSeleccionado(usuario);
    setNombre(usuario.Nombre);
    setApellido(usuario.Apellido);
    setEmail(usuario.Email);
    setRolId(usuario.ID_rol || '');
    setModalAbierto(true);
  };

  const handleGuardarCambios = async (e) => {
    e.preventDefault();
    setError(null);

    if (!nombre || !apellido || !email) {
      setError('Completa todos los campos');
      return;
    }

    if (!NOMBRE_REGEX.test(nombre.trim())) {
      setError('El nombre solo puede contener letras');
      return;
    }

    if (!NOMBRE_REGEX.test(apellido.trim())) {
      setError('El apellido solo puede contener letras');
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Ingresa un correo electrónico válido');
      return;
    }

    setCargandoModal(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        // `http://localhost:3000/api/auth/PanelUsuarios/${usuarioSeleccionado.ID_usuario}`,
        `/api/auth/PanelUsuarios/${usuarioSeleccionado.ID_usuario}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            Nombre: nombre,
            Apellido: apellido,
            Email: email
          })
        }
      );

      const data = await response.json();

      if (data.ok) {
        // Solo un superusuario puede tocar el rol, y solo si realmente cambió
        if (esSuperusuario && rolId && rolId !== usuarioSeleccionado.ID_rol) {
          await actualizarRolUsuario(usuarioSeleccionado.ID_usuario, rolId);
        }

        setUsuarios(usuarios.map(u =>
          u.ID_usuario === usuarioSeleccionado.ID_usuario
            ? { ...u, Nombre: nombre, Apellido: apellido, Email: email, ID_rol: rolId || u.ID_rol }
            : u
        ));
        setModalAbierto(false);
      } else {
        setError(data.mensaje);
      }
    } catch (err) {
      setError('Error al actualizar el usuario');
      console.error(err);
    } finally {
      setCargandoModal(false);
    }
  };

  const handleBorrar = async (id) => {
    if (window.confirm('¿Seguro deseas eliminar a este usuario?')) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          // `http://localhost:3000/api/auth/PanelUsuarios/${id}`,
          `/api/auth/PanelUsuarios/${id}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        const data = await response.json();

        if (data.ok) {
          setUsuarios(usuarios.filter(u => u.ID_usuario !== id));
        } else {
          setError(data.mensaje);
        }
      } catch (err) {
        setError('Error al eliminar al usuario');
        console.error(err);
      }
    }
  };

  // Helper para iniciales del avatar, ej: "Maria Rodriguez" -> "MR"
  const getIniciales = (nombre, apellido) => {
    const inicialNombre = nombre ? nombre.charAt(0) : '';
    const inicialApellido = apellido ? apellido.charAt(0) : '';
    return `${inicialNombre}${inicialApellido}`.toUpperCase();
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#080c18] flex items-center justify-center">
        <p className="text-[#9aa6c4] text-sm">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c18]">

      {/* HEADER */}
      <header className="flex items-center gap-4 p-6 border-b border-[#1c2942]">
        <Link to="/PanelAdmin">
          <button className="flex items-center gap-2 bg-[#0d1526] border border-[#1c2942] text-[#9aa6c4] hover:text-[#e0b855] hover:border-[#e0b855]/40 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Volver al panel
          </button>
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-[#f4f1e8]">Usuarios registrados</h1>
          <p className="text-sm text-[#7d8aa8] mt-1">{usuarios.length} cuentas activas</p>
        </div>

        {error && (
          <p className="ml-auto text-sm text-red-300 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-1.5">
            {error}
          </p>
        )}
      </header>

      {/* MAIN */}
      <main className="p-6">
  {usuarios.length === 0 ? (
    <p className="text-[#9aa6c4] text-sm">
      No hay usuarios registrados.
    </p>
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {usuarios.map((usuario) => (
        <div
          key={usuario.ID_usuario}
          className="bg-[#0d1526] border border-[#1c2942] rounded-xl p-5 flex flex-col gap-4"
        >
          {/* Encabezado */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium bg-[#85b7eb]/10 text-[#85b7eb]">
              {getIniciales(usuario.Nombre, usuario.Apellido)}
            </div>

            <div>
              <p className="text-sm font-medium text-[#f4f1e8]">
                {usuario.Nombre} {usuario.Apellido || ""}
              </p>
              <p className="text-xs text-[#7d8aa8]">
                ID {usuario.ID_usuario} · {usuario.Cargo || 'sin rol'}
              </p>
            </div>
          </div>

          {/* Email */}
          <div className="border-t border-[#1c2942] pt-3 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-[#7d8aa8]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 6-10 7L2 6" />
            </svg>

            <span className="text-sm text-[#9aa6c4] truncate">
              {usuario.Email}
            </span>
          </div>

          {/* Acciones */}
          <div className="flex gap-2">
            <button
              onClick={() => handleEditar(usuario)}
              className="flex-1 flex items-center justify-center gap-2 border border-[#1c2942] text-[#9aa6c4] hover:text-[#e0b855] hover:border-[#e0b855]/40 rounded-lg py-2 text-sm font-medium transition-colors duration-200"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Editar
            </button>

            <button
              onClick={() => handleBorrar(usuario.ID_usuario)}
              className="flex-1 flex items-center justify-center gap-2 border border-red-900/40 text-red-300 hover:bg-red-900/20 rounded-lg py-2 text-sm font-medium transition-colors duration-200"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Borrar
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</main>

      {/* MODAL */}
      {modalAbierto && (
        <div
          className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4"
          onClick={() => setModalAbierto(false)}
        >
          <div
            className="bg-[#0d1526] border border-[#1c2942] rounded-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-[#f4f1e8]">Editar usuario</h2>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-[#7d8aa8] hover:text-[#f4f1e8] text-2xl leading-none transition-colors duration-200"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-900/40 text-red-300 text-sm font-medium text-center rounded-lg py-2 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleGuardarCambios} className="flex flex-col gap-4">
              <div>
                <label className="block mb-1.5 text-sm font-medium text-[#9aa6c4]">Nombre</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(limpiarTextoNombre(e.target.value))}
                  className="w-full px-3 py-2 border border-[#1c2942] bg-[#080c18] rounded-lg text-sm text-[#f4f1e8] focus:outline-none focus:border-[#e0b855]/50"
                />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-medium text-[#9aa6c4]">Apellido</label>
                <input
                  type="text"
                  value={apellido}
                  onChange={(e) => setApellido(limpiarTextoNombre(e.target.value))}
                  className="w-full px-3 py-2 border border-[#1c2942] bg-[#080c18] rounded-lg text-sm text-[#f4f1e8] focus:outline-none focus:border-[#e0b855]/50"
                />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-medium text-[#9aa6c4]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1c2942] bg-[#080c18] rounded-lg text-sm text-[#f4f1e8] focus:outline-none focus:border-[#e0b855]/50"
                />
              </div>

              {esSuperusuario && (
                <div>
                  <label className="block mb-1.5 text-sm font-medium text-[#9aa6c4]">Rol</label>
                  <select
                    value={rolId}
                    onChange={(e) => setRolId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#1c2942] bg-[#080c18] rounded-lg text-sm text-[#f4f1e8] focus:outline-none focus:border-[#e0b855]/50"
                  >
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="border border-[#1c2942] text-[#9aa6c4] hover:text-[#f4f1e8] rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoModal}
                  className="bg-[#e0b855] hover:bg-[#c9a84c] text-[#0d1526] rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 disabled:opacity-60"
                >
                  {cargandoModal ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}