# Raíz — Asistente hidropónico local-first

Aplicación estática para seguir un cultivo DWC localmente. No usa framework, dependencias ni compilación: HTML semántico, CSS nativo y módulos ES del navegador.

## Usar la aplicación

En GitHub Pages no hay nada que instalar ni ejecutar: abrí [francho2002.github.io/asistente-hidroponico](https://francho2002.github.io/asistente-hidroponico/) y los datos seguirán guardándose en ese navegador.

## Desarrollo local

Solo hace falta un servidor estático cuando se trabaja con los archivos fuente desde una carpeta local. Por ejemplo:

```bash
python -m http.server 3000
```

Abrí `http://localhost:3000`. No abras `index.html` directamente: la plantilla demostrativa se carga como JSON y los navegadores solo permiten esa lectura a través de HTTP.

## Arquitectura

- `index.html`: documento semántico, metadatos y entrada de la aplicación.
- `styles.css`: sistema visual responsive claro/oscuro, con una paleta neutral y acento azul.
- `js/app.js`: punto de arranque y coordinación de la aplicación.
- `js/core/store.js`: estado local del cultivo, restauración y persistencia.
- `js/features/`: registros, ciclo, ambiente e importación/exportación.
- `js/ui/router.js`: rutas hash, historial del navegador y transiciones entre páginas.
- `js/ui/pages/`: páginas independientes de panel, historial, inventario y configuración.
- `js/ui/modal.js` y `js/ui/shared.js`: diálogo seguro y componentes compartidos.
- `js/domain.js`: creación del ciclo, tareas iniciales, semanas y exportación de respaldo.
- `js/storage.js`: IndexedDB, la fuente autoritativa de los datos locales.
- `js/template.js`: carga y validación de plantillas JSON sin bundler.

## Funciones incluidas

- Ejemplo e importación de la plantilla Eyeballz con 4 DWC independientes y asignaciones Planta↔DWC.
- Plan confirmado de semanas 0 a 14, tareas, alertas y notificaciones del navegador.
- Mediciones agrupadas de pH, EC y temperatura por DWC; reposición, cambio de solución, observaciones y nutrición con descuento de inventario.
- Historial, inventario, configuración de sistema/asignaciones/fuentes de datos, importación SonoffLAN y gráfico Canvas de humedad.
- Importación de plantillas o copias, exportación de backup y eliminación explícita de datos locales.
- Navegación SPA sin recargar: cada página se desmonta y entra con transición, incluyendo Atrás y Adelante del navegador.

## Publicación

La versión pública se publica con GitHub Pages: [francho2002.github.io/asistente-hidroponico](https://francho2002.github.io/asistente-hidroponico/).

## Archivos JSON

La plantilla demostrativa está en [examples/eyeballz-4-dwc.example.json](examples/eyeballz-4-dwc.example.json). Para SonoffLAN se acepta una lectura, un arreglo, o un objeto con `readings`; cada lectura usa `temperatura`/`temperature`, `humedad`/`humidity` y una fecha opcional.

La aplicación no almacena credenciales de eWeLink. Una futura conexión LAN continua deberá pasar por un puente SonoffLAN local accesible para el navegador.

## Pruebas

```bash
npm test
```

Las pruebas solo usan Node nativo y verifican la estructura estática, la plantilla, los módulos de navegador y la ausencia del stack anterior.

## Documentación

- [Especificación funcional](docs/especificacion-funcional.md)
