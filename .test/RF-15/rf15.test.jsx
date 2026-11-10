import { beforeEach, expect, jest, test } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Categorias from '../../Frontend/src/pages/ModulosCategorias';
import * as api from '../../Frontend/src/services/api';

jest.mock('../../Frontend/src/components/HeaderModulos', () => () => null);
jest.mock('../../Frontend/src/context/ToastContext', () => ({ useToast: () => ({ mostrarToast() {} }) }));
jest.mock('../../Frontend/src/context/NotificacionesContext', () => ({
  useNotificaciones: () => ({ revisarAhora() {} }),
}));
jest.mock('../../Frontend/src/services/api', () => ({
  getGastosPorCategoria: jest.fn(),
  getIngresosPorCategoria: jest.fn(),
  getAhorrosPorCategoria: jest.fn(),
  getImprevistosPorCategoria: jest.fn(),
  getDeudasPorCategoria: jest.fn(),
  crearCategoria: jest.fn(),
  editarCategoria: jest.fn(),
  deshabilitarCategoria: jest.fn(),
  habilitarCategoria: jest.fn(),
  eliminarCategoria: jest.fn(),
}));

beforeEach(() => {
  api.getGastosPorCategoria.mockResolvedValue([
    { id: 1, nombre: 'Mercado', activa: true, es_global: true },
    { id: 2, nombre: 'Mascotas', activa: true },
    { id: 3, nombre: 'Viajes', activa: false },
  ]);
  api.getIngresosPorCategoria.mockResolvedValue([]);
  api.getAhorrosPorCategoria.mockResolvedValue([]);
  api.getImprevistosPorCategoria.mockResolvedValue([]);
  api.getDeudasPorCategoria.mockResolvedValue([]);
});

async function abrirModulo() {
  const usuario = userEvent.setup();
  render(<Categorias />);
  await screen.findAllByText('Mercado');
  return usuario;
}

function fila(nombre) {
  return within(screen.getAllByText(nombre).find(texto => texto.closest('tr')).closest('tr'));
}

test('RF-15 consulta los cinco módulos y protege la categoría global en pantalla', async () => {
  await abrirModulo();
  for (const consulta of [
    api.getGastosPorCategoria, api.getIngresosPorCategoria, api.getAhorrosPorCategoria,
    api.getImprevistosPorCategoria, api.getDeudasPorCategoria,
  ]) {
    expect(consulta).toHaveBeenCalledTimes(1);
  }
  expect(fila('Mercado').queryByRole('button', { name: /Editar|Deshabilitar|Eliminar/ })).toBeNull();
  expect(fila('Mascotas').getByRole('button', { name: 'Editar' })).toBeInTheDocument();
});

test('RF-15 rechaza un nombre duplicado y permite crear uno nuevo', async () => {
  const alerta = jest.spyOn(window, 'alert').mockImplementation(() => {});
  api.crearCategoria.mockResolvedValue({ ok: true, id: 4 });
  const usuario = await abrirModulo();
  await usuario.click(screen.getByRole('button', { name: /Agregar Categoría/i }));
  const nombre = screen.getByPlaceholderText('Ej: Ropa, Mascotas...');
  const guardar = screen.getByRole('button', { name: 'Guardar' });
  await usuario.type(nombre, '  MASCOTAS ');
  await usuario.click(guardar);
  expect(alerta).toHaveBeenCalledWith(expect.stringMatching(/Ya existe/));
  expect(api.crearCategoria).not.toHaveBeenCalled();

  await usuario.clear(nombre);
  await usuario.type(nombre, '  Educación  ');
  await usuario.click(guardar);
  expect(api.crearCategoria).toHaveBeenCalledWith({ nombre: 'Educación', descripcion: '' });
  expect(await screen.findAllByText('Educación')).not.toHaveLength(0);
});

test('RF-15 permite editar una categoría personalizada', async () => {
  api.editarCategoria.mockResolvedValue({ ok: true });
  const usuario = await abrirModulo();
  await usuario.click(fila('Mascotas').getByRole('button', { name: 'Editar' }));
  const nombre = screen.getByDisplayValue('Mascotas');
  await usuario.clear(nombre);
  await usuario.type(nombre, 'Veterinaria');
  await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(api.editarCategoria).toHaveBeenCalledWith(2, { nombre: 'Veterinaria', descripcion: '' });
  expect(await screen.findAllByText('Veterinaria')).not.toHaveLength(0);
});

test('RF-15 permite deshabilitar, volver a habilitar y eliminar con confirmación', async () => {
  const confirmar = jest.spyOn(window, 'confirm').mockReturnValue(true);
  api.deshabilitarCategoria.mockResolvedValue({ ok: true });
  api.habilitarCategoria.mockResolvedValue({ ok: true });
  api.eliminarCategoria.mockResolvedValue({ ok: true });
  const usuario = await abrirModulo();

  await usuario.click(fila('Mascotas').getByRole('button', { name: 'Deshabilitar' }));
  expect(api.deshabilitarCategoria).toHaveBeenCalledWith(2);
  await usuario.click(fila('Mascotas').getByRole('button', { name: 'Habilitar' }));
  expect(api.habilitarCategoria).toHaveBeenCalledWith(2);
  expect(fila('Mascotas').queryByRole('button', { name: 'Eliminar' })).toBeNull();

  confirmar.mockReturnValueOnce(false);
  await usuario.click(fila('Viajes').getByRole('button', { name: 'Eliminar' }));
  expect(api.eliminarCategoria).not.toHaveBeenCalled();
  await usuario.click(fila('Viajes').getByRole('button', { name: 'Eliminar' }));
  expect(api.eliminarCategoria).toHaveBeenCalledWith(3);
  expect(screen.queryAllByText('Viajes')).toHaveLength(0);
});
