import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Dependientes from '../../Frontend/src/pages/ModulosDependientes';

jest.mock('../../Frontend/src/components/HeaderModulos', () => () => null);
jest.mock('../../Frontend/src/context/ToastContext', () => ({ useToast: () => ({ mostrarToast() {} }) }));
jest.mock('../../Frontend/src/context/NotificacionesContext', () => ({
  useNotificaciones: () => ({ revisarAhora() {} }),
}));
jest.mock('../../Frontend/src/services/api', () => ({ API_URL: '/api' }));

const dependiente = {
  id_dependientes: 12,
  Nombre: 'Ana',
  Relacion: 'Hija',
  Ocupacion: 'Estudiante',
  Fecha_nacimiento: '2010-05-10',
  Peso_economico: 3,
};
const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  localStorage.setItem('token', 'token-de-prueba');
  globalThis.fetch = jest.fn().mockResolvedValueOnce({ json: async () => [dependiente] });
});

afterEach(() => {
  localStorage.clear();
  globalThis.fetch = fetchOriginal;
});

async function abrirModulo() {
  const usuario = userEvent.setup();
  render(<MemoryRouter><Dependientes /></MemoryRouter>);
  expect(await screen.findByText('Ana')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith('/api/dependientes', expect.objectContaining({
    headers: { Authorization: 'Bearer token-de-prueba' },
  }));
  return usuario;
}

test('RF-10 registra un dependiente con los datos del formulario', async () => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id_dependientes: 13 }) });
  const usuario = await abrirModulo();
  await usuario.click(screen.getByRole('button', { name: /Agregar Dependiente/i }));
  await usuario.type(screen.getByPlaceholderText('Nombre del dependiente'), '  Mateo  ');
  await usuario.selectOptions(screen.getAllByRole('combobox')[0], 'Hijo');
  await usuario.selectOptions(screen.getAllByRole('combobox')[1], '5');
  fireEvent.change(document.querySelector('input[name="Fecha_nacimiento"]'), {
    target: { value: '2012-05-10' },
  });
  await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

  expect(await screen.findByText('Mateo')).toBeInTheDocument();
  const [url, peticion] = fetch.mock.calls[1];
  expect(url).toBe('/api/dependientes');
  expect(peticion.method).toBe('POST');
  expect(JSON.parse(peticion.body)).toEqual({
    Nombre: 'Mateo', Relacion: 'Hijo', Ocupacion: '',
    Fecha_nacimiento: '2012-05-10', Peso_economico: 5,
  });
});

test('RF-10 edita el registro seleccionado y refleja el cambio', async () => {
  fetch.mockResolvedValueOnce({ ok: true });
  const usuario = await abrirModulo();
  await usuario.click(screen.getByRole('button', { name: 'Editar' }));
  const campo = screen.getByPlaceholderText('Nombre del dependiente');
  expect(campo).toHaveValue('Ana');
  await usuario.clear(campo);
  await usuario.type(campo, 'Ana María');
  await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

  expect(await screen.findByText('Ana María')).toBeInTheDocument();
  expect(fetch).toHaveBeenLastCalledWith('/api/dependientes/12', expect.objectContaining({
    method: 'PUT', body: expect.stringContaining('Ana María'),
  }));
});

test('RF-10 conserva el registro al cancelar y lo elimina al confirmar', async () => {
  fetch.mockResolvedValueOnce({ ok: true });
  jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  const usuario = await abrirModulo();
  const eliminar = screen.getByRole('button', { name: 'Eliminar' });
  await usuario.click(eliminar);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Ana')).toBeInTheDocument();

  await usuario.click(eliminar);
  expect(fetch).toHaveBeenLastCalledWith('/api/dependientes/12', expect.objectContaining({
    method: 'DELETE',
  }));
  await waitFor(() => expect(screen.queryByText('Ana')).not.toBeInTheDocument());
});
