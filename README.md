# Raíz — Asistente hidropónico local-first

Aplicación para configurar un sistema hidropónico real, seguir el ciclo completo y convertir mediciones y acciones en historial, tareas y avisos contextuales. No requiere cuenta ni backend: el estado autoritativo se guarda en IndexedDB y puede importarse o exportarse como JSON.

## Qué incluye

- Plantilla importable **“Eyeballz — 4 DWC independientes”**, editable y separada del programa.
- Relación histórica Planta ↔ DWC, sin duplicar el estado actual.
- Registro agrupado de pH, EC y temperatura de solución por DWC.
- Reposición de agua, cambios de solución, nutrición, observaciones e inventario.
- Plan de semanas 0–14 con dosis, pH, EC, humedad, luz y temperatura objetivo.
- Tareas recurrentes, evaluación de valores, avisos y notificaciones del navegador.
- Historial ambiental importable desde una integración local SonoffLAN.
- Copias de seguridad y plantillas JSON portables.
- Interfaz adaptable a escritorio y móvil.

## Ejecutar localmente

Requiere Node.js 22.13 o posterior y pnpm.

```bash
pnpm install
pnpm dev
```

La aplicación queda disponible en `http://localhost:3000`.

## Verificar

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
```

## Importar lecturas de Sonoff

En **Configuración → SonoffLAN → Importar lecturas**, pegá una lectura o un arreglo JSON. Se aceptan nombres de campo en español o inglés:

```json
[
  {
    "fecha": "2026-08-08T12:00:00.000Z",
    "temperatura": 24.2,
    "humedad": 72,
    "humidificadorEncendido": true
  }
]
```

La importación mantiene las credenciales de eWeLink fuera de la aplicación. Una conexión LAN continua requiere un puente SonoffLAN local que pueda ser consultado por el navegador con CORS habilitado.

## Documentación

- [Especificación funcional](docs/especificacion-funcional.md)
- [Plantilla Eyeballz](examples/eyeballz-4-dwc.example.json)
