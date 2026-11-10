# Pruebas web de AhorrApp asignadas a David Barrera

Cada subcarpeta contiene la documentación y las pruebas Jest de un requisito web.

| Requisito | Qué se prueba |
| --- | --- |
| [RF-10](RF-10/RF-10.md) | Dependientes económicos |
| [RF-15](RF-15/RF-15.md) | Categorías financieras |
| [RF-16](RF-16/RF-16.md) | Cerrar sesión |

RF-18, RF-19, RF-20 y RF-21 quedan fuera del alcance web. La API de sincronización de RF-19 da soporte al cliente móvil.

## Ejecutar Jest desde la raíz

```powershell
npm ci --prefix Frontend
npm ci --prefix Backend
npm test --prefix Frontend
npm test --prefix Backend
```

Testing Library interactúa con los componentes React en jsdom. Supertest ejercita las rutas reales de Express con PostgreSQL simulado.
