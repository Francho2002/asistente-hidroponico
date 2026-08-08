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
- `js/core/sonoff-connection.js`: configuración local y segura de la conexión con Home Assistant.
- `js/features/`: registros, ciclo, ambiente, importación/exportación, plantilla con IA y conexión Home Assistant + SonoffLAN.
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
- Historial, inventario, configuración de sistema/asignaciones/fuentes de datos y gráfico Canvas de humedad.
- Prompt copiable para pedir a una IA una plantilla JSON importable, a partir del equipamiento y preferencias de cada persona.
- Conexión automática a Home Assistant + SonoffLAN para temperatura, humedad y estado del humidificador; también admite JSON como respaldo manual.
- Importación de plantillas o copias, exportación de backup y eliminación explícita de datos locales.
- Navegación SPA sin recargar: cada página se desmonta y entra con transición, incluyendo Atrás y Adelante del navegador.

## Publicación

La versión pública se publica con GitHub Pages: [francho2002.github.io/asistente-hidroponico](https://francho2002.github.io/asistente-hidroponico/).

## Plantillas JSON e IA

La plantilla demostrativa está en [examples/eyeballz-4-dwc.example.json](examples/eyeballz-4-dwc.example.json). En la bienvenida o en **Configuración**, elegí **Crear plantilla con IA**: el botón copia un prompt que pide una respuesta JSON estricta y usa Eyeballz solo como referencia de estructura. Revisá el JSON antes de importarlo.

Las lecturas JSON son un respaldo manual: se importan desde **Configuración** y pueden ser una lectura, un arreglo, o un objeto con `readings`; cada lectura usa `temperatura`/`temperature`, `humedad`/`humidity` y una fecha opcional.

## Home Assistant + SonoffLAN

La app no puede ni debe llamar directamente al puerto interno del THR320D: SonoffLAN es una integración de Home Assistant, no una API web abierta. Para lecturas automáticas:

1. Integrá el THR320D en Home Assistant con SonoffLAN.
2. En **Configuración → Conectar / Configurar SonoffLAN**, ingresá la URL base de Home Assistant, un *Long-Lived Access Token* y las entidades de temperatura, humedad y switch del humidificador.
3. La app consulta las entidades al conectar y después en el intervalo elegido (60 segundos por defecto).

El token queda únicamente en el almacenamiento local de ese navegador, nunca en una plantilla o backup, y se borra al eliminar los datos locales. Desde GitHub Pages la URL de Home Assistant debe usar HTTPS y permitir CORS para `https://francho2002.github.io`; una IP o URL `http://` local será bloqueada por el navegador. Consultá la [API REST de Home Assistant](https://developers.home-assistant.io/docs/api/rest/) y la configuración de [CORS](https://www.home-assistant.io/integrations/http/#cors_allowed_origins).

## Sincronizar sin nube

La sincronización funciona con un archivo, sin cuenta, servidor ni conexión entre dispositivos:

1. En el primer dispositivo, abrí **Configuración → Sincronizar entre dispositivos → Exportar para otro dispositivo**.
2. Transferí el archivo por el medio que prefieras y, en el segundo dispositivo, elegí **Fusionar copia**.
3. Revisá la previsualización, resolvé los conflictos y aplicá la fusión. Luego exportá el resultado y fusionálo de vuelta en el primer dispositivo.

Solo se puede fusionar un archivo cuyo `cultivoUid` coincide exactamente con el cultivo abierto. Los registros ausentes no se borran. Cada dispositivo usa una identidad opaca local y relojes vectoriales por registro; cambios simultáneos se muestran para elegir, no se pisan silenciosamente. La conexión/token de Home Assistant no viaja en archivos. **Deshacer última sincronización** permanece disponible hasta el siguiente cambio local.

## Pruebas

```bash
npm test
```

Las pruebas solo usan Node nativo y verifican la estructura estática, la plantilla, los módulos de navegador y la ausencia del stack anterior.

## Documentación

- [Especificación funcional](docs/especificacion-funcional.md)
