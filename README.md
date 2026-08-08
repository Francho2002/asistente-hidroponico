# Raíz — Asistente hidropónico local-first

Aplicación estática para seguir un cultivo DWC localmente. No usa framework, dependencias ni compilación: HTML semántico, CSS nativo y módulos ES del navegador.

## Ejecutar localmente

Desde esta carpeta, iniciá cualquier servidor estático. Por ejemplo:

```bash
python -m http.server 3000
```

Abrí `http://localhost:3000`. No abras `index.html` directamente: la plantilla demostrativa se carga como JSON y los navegadores solo permiten esa lectura a través de HTTP.

## Arquitectura

- `index.html`: documento semántico, metadatos y entrada de la aplicación.
- `styles.css`: diseño responsive claro/oscuro; la preferencia se conserva en `localStorage` y se aplica antes del primer renderizado.
- `js/app.js`: interfaz, formularios, historial, alertas, gráfico Canvas y acciones del cultivo.
- `js/domain.js`: creación del ciclo, tareas iniciales, semanas y exportación de respaldo.
- `js/storage.js`: IndexedDB, la fuente autoritativa de los datos locales.
- `js/template.js`: carga y validación de plantillas JSON sin bundler.

## Funciones incluidas

- Ejemplo e importación de la plantilla Eyeballz con 4 DWC independientes y asignaciones Planta↔DWC.
- Plan confirmado de semanas 0 a 14, tareas, alertas y notificaciones del navegador.
- Mediciones agrupadas de pH, EC y temperatura por DWC; reposición, cambio de solución, observaciones y nutrición con descuento de inventario.
- Historial, inventario, configuración de sistema/asignaciones/fuentes de datos, importación SonoffLAN y gráfico Canvas de humedad.
- Importación de plantillas o copias, exportación de backup y eliminación explícita de datos locales.

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
