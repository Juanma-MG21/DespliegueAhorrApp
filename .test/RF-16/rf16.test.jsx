import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from '@jest/globals';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../Frontend/src/context/AuthContext';
import { ProtectedRoute } from '../../Frontend/src/components/ProtectedRoute';

function AreaPrivada() {
  const { logout } = useAuth();
  return <button onClick={logout}>Cerrar sesión</button>;
}

function abrirRutaPrivada() {
  render(
    <MemoryRouter initialEntries={['/privado']}>
      <AuthProvider>
        <Routes>
          <Route path="/privado" element={<ProtectedRoute><AreaPrivada /></ProtectedRoute>} />
          <Route path="/Login" element={<h1>Iniciar sesión</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  for (const storage of [localStorage, sessionStorage]) {
    storage.setItem('user', JSON.stringify({ id: 7 }));
    storage.setItem('usuario', 'perfil anterior');
    storage.setItem('token', 'token-de-prueba');
    storage.setItem('preferencia', 'oscuro');
  }
});

test('RF-16 limpia las credenciales y redirige desde la ruta protegida', async () => {
  abrirRutaPrivada();
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();

  for (const storage of [localStorage, sessionStorage]) {
    for (const key of ['user', 'usuario', 'token']) {
      expect(storage.getItem(key)).toBeNull();
    }
    expect(storage.getItem('preferencia')).toBe('oscuro');
  }
});

test('RF-16 impide abrir una ruta protegida con un perfil sin token', async () => {
  localStorage.removeItem('token');
  abrirRutaPrivada();
  expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
});

test.each(['storage', 'pageshow'])('RF-16 revalida la sesión con el evento %s', async (evento) => {
  abrirRutaPrivada();
  expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  localStorage.removeItem('token');
  act(() => window.dispatchEvent(
    evento === 'storage' ? new StorageEvent('storage', { key: 'token' }) : new Event(evento)
  ));
  expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
});
