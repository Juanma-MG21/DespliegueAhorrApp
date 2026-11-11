import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { eliminarDependienteAdmin } from '../services/api';

export default function PanelDependientes() {
  const [dependientes, setDependientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDependientes();
  }, []);

  const getDependientes = async () => {
    try {
      const token = localStorage.getItem('token');

      // const response = await fetch('http://localhost:3000/api/auth/PanelDependientes', {
      const response = await fetch ('/api/auth/PanelDependientes', {  
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.ok) {
        setDependientes(data.dependientes);
      } else {
        setError(data.mensaje || 'No se pudieron obtener los dependientes');
      }
    } catch (err) {
      setError('Error al obtener dependientes');
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  // Helper para iniciales del avatar, ej: "Lucas" -> "L"
  const getIniciales = (nombre) => {
    return nombre ? nombre.charAt(0).toUpperCase() : '?';
  };

  // Helper para mostrar solo día/mes/año, sin la hora ni la 'Z' del ISO string
  const formatearFecha = (fechaISO) => {
    if (!fechaISO) return 'N/A';
    return fechaISO.slice(0, 10).split('-').reverse().join('/');
  };

  const handleBorrar = async (id) => {
    if (!window.confirm('¿Seguro deseas eliminar a este dependiente?')) return;

    try {
      await eliminarDependienteAdmin(id);
      setDependientes((prev) => prev.filter((d) => d.id_dependientes !== id));
    } catch (err) {
      console.error(err);
      setError('Error al eliminar el dependiente');
    }
  };

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
          <h1 className="text-xl font-semibold text-[#f4f1e8]">Lista de dependientes</h1>
          <p className="text-sm text-[#7d8aa8] mt-1">{dependientes.length} registrados</p>
        </div>
      </header>

      {/* MAIN */}
      <main className="p-6">

        {cargando && (
          <p className="text-[#9aa6c4] text-sm text-center mt-10">Cargando dependientes...</p>
        )}

        {error && (
          <p className="text-red-300 text-sm text-center mt-10 bg-red-900/20 border border-red-900/40 rounded-lg py-2 max-w-md mx-auto">
            {error}
          </p>
        )}

        {!cargando && !error && (
          dependientes.length === 0 ? (
            <p className="text-[#9aa6c4] text-sm">No hay dependientes registrados.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dependientes.map((dependiente) => (
                <div
                  key={dependiente.id_dependientes}
                  className="bg-[#0d1526] border border-[#1c2942] rounded-xl p-5 flex flex-col gap-4"
                >
                  {/* Encabezado de la card: avatar, nombre, relación */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#e0b855]/10 text-[#e0b855] flex items-center justify-center text-sm font-medium">
                      {getIniciales(dependiente.Nombre)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#f4f1e8]">{dependiente.Nombre}</p>
                      <p className="text-xs text-[#7d8aa8]">ID {dependiente.id_dependientes}</p>
                    </div>
                    <span className="ml-auto text-xs font-medium px-2.5 py-1 rounded-md bg-[#85b7eb]/10 text-[#85b7eb]">
                      {dependiente.Relacion}
                    </span>
                  </div>

                  {/* Detalles */}
                  <div className="border-t border-[#1c2942] pt-3 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#7d8aa8] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <span className="text-sm text-[#9aa6c4]">
                        Dependiente de{' '}
                        <span className="text-[#f4f1e8]">{dependiente.usuario_nombre}</span>
                        {' '}
                        <span className="text-[#7d8aa8]">(ID {dependiente.ID_usuario})</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#7d8aa8] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="7" width="20" height="14" rx="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                      </svg>
                      <span className="text-sm text-[#9aa6c4]">
                        {dependiente.Ocupacion || 'Sin ocupacion registrada'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#7d8aa8] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span className="text-sm text-[#9aa6c4]">
                        {formatearFecha(dependiente.Fecha_nacimiento)}
                      </span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="border-t border-[#1c2942] pt-3">
                    <button
                      onClick={() => handleBorrar(dependiente.id_dependientes)}
                      className="w-full flex items-center justify-center gap-2 border border-red-900/40 text-red-300 hover:bg-red-900/20 rounded-lg py-2 text-sm font-medium transition-colors duration-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Borrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}