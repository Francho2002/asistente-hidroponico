# Especificación funcional

Estado: borrador vivo  
Última actualización: 8 de agosto de 2026

Este documento consolida las decisiones funcionales tomadas hasta ahora. El caso **Eyeballz — 4 DWC independientes** es una plantilla demostrativa editable, no una configuración fija ni predeterminada de la aplicación.

## 1. Objetivo del producto

El producto será un asistente hidropónico local-first, no solamente un registro de variables.

- No requiere backend ni SaaS para funcionar.
- Los datos pertenecen al usuario y permanecen en el navegador.
- Admite importación, exportación y futuras alternativas de sincronización.
- Cada usuario configura el sistema, equipamiento e instrumentos que realmente posee.
- El asistente adapta mediciones, tareas y avisos a las capacidades disponibles.
- El ejemplo incluido en el programa se importa como cualquier otra plantilla.

## 2. Principios funcionales

### 2.1 Separación de responsabilidades

| Capa | Contenido |
|---|---|
| Configuración del sistema | Espacio, DWC, equipos, instrumentos, capacidades y existencias |
| Plan o receta | Etapas, objetivos, dosificaciones, tareas y frecuencias previstas |
| Registro del ciclo | Mediciones, acciones, incidencias, fotografías y resultados reales |
| Conocimiento y reglas | Interpretación, alertas, procedimientos y recomendaciones |

### 2.2 Fuente de cada variable

Cada variable se encuentra en uno de estos estados:

- **Manual:** el usuario registra el valor; el asistente recuerda medirlo y evalúa el dato cargado.
- **Automática:** se recibe desde un dispositivo; puede evaluarse continuamente.
- **No disponible:** no se exige, no genera recordatorios y se explican las limitaciones cuando sean relevantes.

La posibilidad de automatizar una variable más adelante es una capacidad, no un cuarto estado. Por ejemplo, EC puede ser manual hoy y admitir un sensor automático en el futuro.

Regla fundamental:

> El asistente nunca confunde “sin dato” con “dato incorrecto”.

### 2.3 Estructura de una medición

Todo dato medible tiene:

> variable + valor + unidad + alcance + fuente + fecha/hora

La antigüedad —por ejemplo, “hace 31 horas”— se calcula a partir de la fecha y no se almacena como valor independiente.

### 2.4 Orientación para principiantes

- El asistente pregunta únicamente hechos que solo el usuario puede conocer.
- Ofrece una recomendación cuando existe una práctica razonable para principiantes.
- No inventa instrucciones específicas de fabricantes.
- Distingue dato confirmado, recomendación y dato desconocido.
- Las recomendaciones son editables y no se convierten en reglas universales.

## 3. Objetos conceptuales centrales

```text
Cultivo
├── DWC
├── Plantas
├── Asignaciones Planta ↔ DWC
└── Eventos
    ├── Mediciones
    ├── Acciones
    ├── Cambios de etapa
    ├── Mantenimientos
    └── Incidencias
```

Una medición es un tipo de evento porque puede afectar al cultivo completo, a un DWC o a una planta.

### 3.1 Alcances

**Cultivo completo**

- Variedad, fecha inicial, etapa y receta.
- Ambiente compartido.
- Iluminación y climatización.
- Inventario, tareas y alertas generales.

**Cada DWC**

- Volumen, pH, EC y temperatura de solución.
- Agua y nutrientes añadidos.
- Cambios de solución e incidencias propias.
- Planta asignada en cada periodo.

**Cada planta**

- Identidad, germinación, trasplante y estado observado.
- Fotografías, intervenciones e incidencias.
- Historial de asignaciones a DWC.

## 4. Plantilla de ejemplo

Nombre: **Eyeballz — 4 DWC independientes**

### 4.1 Cultivo y espacio

- Variedad: Eyeballz.
- Banco: Ripper Seeds.
- Cuatro semillas en lana de roca.
- Carpa: 2 m × 1 m × 1 m.
- Temperatura ambiental objetivo: 24 °C fija.

### 4.2 Sistema DWC

- Cuatro DWC independientes.
- Capacidad nominal: 20 L por DWC.
- Volumen de trabajo: 16 L por DWC.
- Volumen total cuando comparten receta: 64 L.
- Relación inicial: una planta por DWC.
- Cuatro macetas rejilla N.º 6.
- Cuatro lanas de roca N.º 6.
- Cuatro piedras difusoras.
- Dos aireadores de doble salida.
- Cuatro metros de microtubo y cuatro ventosas.

### 4.3 Equipamiento

- Panel LED anunciado como 500 W, con controles binarios de potencia/espectro.
- Aire acondicionado configurado permanentemente a 24 °C.
- Sonoff TH Elite THR320D con sensor THS01.
- Humidificador de 4 L controlado por el relé del Sonoff.
- Extractor con filtro de carbón.
- Labymos EZ9902 para pH, EC y temperatura de líquidos.

El Sonoff registra temperatura y humedad ambiental y el estado del humidificador. El estado real ON/OFF del aire acondicionado no está disponible actualmente.

### 4.4 Fuentes del ejemplo

| Variable | Fuente |
|---|---|
| Temperatura ambiente | Automática · Sonoff THS01 |
| Humedad | Automática · Sonoff THS01 |
| Estado del humidificador | Automática · Sonoff THR320D |
| Estado del aire acondicionado | No disponible |
| pH | Manual · Labymos EZ9902 |
| EC | Manual · Labymos EZ9902 |
| Temperatura de solución | Manual · Labymos EZ9902 |
| PPFD | No disponible; solo referencia del plan |

### 4.5 Inventario inicial

- Nutriente Macro: 2 L.
- Nutriente Micro: 2 L.
- Nutriente Bloom: 2 L.
- Reductor de pH: 600 mL declarados.
- Cuatro lanas de roca y cuatro macetas rejilla instaladas.

## 5. Etapas y receta del ejemplo

La etapa describe el momento general del cultivo. La semana del plan determina los valores concretos dentro de esa etapa.

| Semana | Etapa | Macro | Micro | Bloom | EC objetivo | pH objetivo | Luz | PPFD de referencia | Humedad |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | Enraizado | 1,5 mL/L | 1,5 mL/L | — | 1,4 mS/cm | 5,8 | 18/6 | 450–550 | 70–75 % |
| 1 | Vegetativo temprano | 1,5 mL/L | 1,5 mL/L | — | 1,4 mS/cm | 5,8 | 18/6 | 500–600 | 60–65 % |
| 2 | Vegetativo temprano | 1,6 mL/L | 1,6 mL/L | — | 1,5 mS/cm | 5,8 | 18/6 | 500–600 | 60–65 % |
| 3 | Vegetativo tardío | 1,7 mL/L | 1,7 mL/L | — | 1,6 mS/cm | 5,8 | 18/6 | 600–800 | 60–65 % |
| 4 | Vegetativo tardío | 1,85 mL/L | 1,85 mL/L | — | 1,7 mS/cm | 5,8 | 18/6 | 600–800 | 60–65 % |
| 5 | Preflora | — | 1,5 mL/L | 3 mL/L | 1,8 mS/cm | 5,8 | 12/12 | 600–800 | 50–55 % |
| 6 | Flora–estiramiento | — | 1,5 mL/L | 3 mL/L | 1,8 mS/cm | 6,0 | 12/12 | 800–1000 | 50–55 % |
| 7 | Flora–estiramiento | — | 1,5 mL/L | 3 mL/L | 1,8 mS/cm | 6,2 | 12/12 | 800–1000 | 50–55 % |
| 8 | Flora–engorde | — | 1,5 mL/L | 3 mL/L | 1,8 mS/cm | 6,2 | 12/12 | 800–1000 | 50–55 % |
| 9 | Flora–engorde | — | 1,4 mL/L | 4,2 mL/L | 2,2 mS/cm | 6,4 | 12/12 | 800–1000 | 50–55 % |
| 10 | Flora–engorde | — | 1,4 mL/L | 4,2 mL/L | 2,2 mS/cm | 6,4 | 12/12 | 800–1000 | 50–55 % |
| 11 | Maduración | — | 1,4 mL/L | 4,2 mL/L | 2,2 mS/cm | 6,4 | 12/12 | 800–1000 | 50–55 % |
| 12 | Maduración | — | 1,4 mL/L | 4,2 mL/L | 2,2 mS/cm | 6,4 | 12/12 | 800–1000 | 50–55 % |
| 13 | Lavado | — | — | — | — | — | 12/12 | 800–1000 | 50–55 % |
| 14 | Cosecha | — | — | — | — | — | 12/12 | 800–1000 | 50–55 % |

Una celda vacía significa **no aplicar**, no “dato desconocido”.

El calendario calcula automáticamente la semana transcurrida desde la fecha de inicio. La etapa confirmada, en cambio, no cambia sola: cuando llega una nueva semana, el asistente la propone y el usuario confirma el avance de a una semana. No se puede adelantar una etapa por encima de la semana calendario.

Si se corrige la fecha de inicio, se recalcula el calendario sin reescribir eventos ni retroceder etapas ya confirmadas. Si ambos quedan desfasados, el asistente lo informa para que el usuario lo revise.

Al confirmar una etapa se activan nuevos objetivos, receta, tareas y avisos sin modificar el historial anterior.

## 6. Asignaciones Planta ↔ DWC

La relación inicial es 1:1, pero no permanente.

```text
DWC 1 ── Planta A
DWC 2 ── Planta B
DWC 3 ── Planta C
DWC 4 ── Planta D
```

Mover una planta cierra la asignación anterior y abre una nueva:

```text
Planta A
├── DWC 1 · fecha inicial → fecha del traslado
└── DWC 3 · fecha del traslado → presente
```

No se guardan simultáneamente referencias duplicadas como `planta.dwcActual` y `dwc.plantaActual`; ambas vistas consultan la misma asignación.

## 7. Eventos y acciones registrables

Todos los eventos incluyen fecha/hora, alcance, etapa activa, fuente y notas opcionales.

### 7.1 Medición de solución

- Alcance: un DWC.
- Valores agrupados: pH, EC y temperatura.
- Fuente inicial: manual, Labymos EZ9902.
- Una acción produce las tres variables con la misma fecha y alcance.

### 7.2 Lectura ambiental

- Alcance: cultivo completo.
- Temperatura, humedad y estado del humidificador.
- Fuente: automática, Sonoff.

### 7.3 Otras acciones

- Reponer agua.
- Añadir nutrientes.
- Corregir pH.
- Preparar o renovar solución.
- Observar una planta.
- Mover una planta entre DWC.
- Confirmar un cambio de etapa.
- Abrir, actualizar o resolver una incidencia.
- Cambiar fotoperiodo o modo del LED.
- Calibrar un instrumento.
- Limpiar, mantener o reemplazar equipamiento.
- Recibir, consumir, ajustar o descartar inventario.

### 7.4 Tarea, evento y alerta

- **Tarea:** algo que debe hacerse.
- **Evento:** algo que ya ocurrió.
- **Alerta:** reacción del asistente ante datos o tareas.

Completar una tarea crea el evento correspondiente y agenda la siguiente cuando aplique. El consumo de inventario se genera desde las acciones y no se registra dos veces.

## 8. Rutina del ejemplo

### Diaria

- Revisar el nivel de agua de cada DWC.
- Reponer agua según consumo.
- Observar plantas, raíces, olor y claridad.
- Consultar temperatura, humedad, tareas y avisos.

### Cada 48 horas

- Medir pH, EC y temperatura de cada DWC.
- Comparar con la semana activa.
- Registrar cualquier corrección.

### Cada siete días

- Renovar completamente la solución.
- Registrar cantidades utilizadas.
- Actualizar inventario.
- Revisar el cambio de semana o etapa.

### Al cambiar de etapa

- Confirmar el cambio.
- Activar la nueva receta y objetivos.
- Revisar humedad, fotoperiodo y LED.
- Generar las tareas aplicables.

## 9. Preparación de la solución

Para las cuatro plantas con la misma receta se recomienda preparar una única solución final de 64 L, comprobarla y repartir 16 L por DWC. Esta es una recomendación del ejemplo, no un requisito universal.

Un recipiente limpio, opaco y graduado de aproximadamente 70–80 L es una comodidad recomendada, no un elemento obligatorio. Si no está disponible, se ofrecen cuatro preparaciones de 16 L.

Procedimiento funcional guiado:

1. Comenzar con el agua.
2. Calcular las dosis de la semana activa.
3. Añadir cada producto al agua individualmente.
4. Mezclar completamente antes de añadir el siguiente.
5. Nunca juntar Macro, Micro y Bloom concentrados entre sí.
6. Medir EC después de incorporar los nutrientes.
7. Ajustar después el pH.
8. Registrar pH, EC y temperatura finales.
9. Repartir 16 L por DWC.
10. Gestionar después cada DWC independientemente.

La plantilla no inventará el orden específico Macro–Micro–Bloom. Se remitirá al envase o QR de Verdeagua hasta disponer de una instrucción oficial inequívoca.

## 10. Avisos y alertas

### 10.1 Tipos

- **Tarea:** acción planificada.
- **Aviso:** situación que conviene revisar.
- **Alerta:** situación que requiere atención.
- **Información:** explicación contextual sin exigir una acción.

### 10.2 Ambiente

- Humedad fuera del rango de la etapa durante 15 minutos.
- Temperatura menor a 22 °C o mayor a 26 °C durante 15 minutos.
- Sonoff sin enviar datos durante el periodo esperado.
- Humidificador encendido sin mejora apreciable de humedad.
- Humidificador encendido por encima del máximo de humedad.

### 10.3 Solución

- Recordatorio a las 48 horas desde la última medición.
- Aviso de medición atrasada a las 72 horas.
- Alerta de pH fuera del rango general 5,5–6,5 después de una medición manual.
- Información si el pH difiere del objetivo semanal pero continúa dentro del rango general.
- Aviso si EC está por encima o debajo del objetivo semanal.
- Renovación pendiente después de siete días.
- Comprobación sugerida después de añadir nutrientes o corregir pH.

### 10.4 Cultivo y mantenimiento

- Cambio de semana o etapa.
- Cambio de dosis, fotoperiodo o iluminación.
- Nutrientes insuficientes para la próxima preparación.
- Planta sin DWC asignado.
- Incidencia abierta sin seguimiento.
- Revisión diaria de agua.
- Calibración y mantenimiento recomendados.

### 10.5 Notificaciones del navegador

Se reservan para desviaciones ambientales persistentes, Sonoff desconectado, medición muy atrasada, renovación pendiente, cambios de etapa/fotoperiodo e incidencias importantes. Las variaciones pequeñas permanecen dentro de la aplicación.

## 11. Resumen principal

El resumen responde:

- ¿En qué etapa y semana está el cultivo?
- ¿Cómo está el ambiente?
- ¿Cómo está cada DWC?
- ¿Qué debe hacerse hoy?
- ¿Hay algo que requiera atención?

Contenido inicial:

- Etapa, semana y días transcurridos.
- Temperatura, humedad y humidificador.
- Cuatro tarjetas DWC con planta, última medición y objetivos.
- Tareas de hoy.
- Avisos y alertas.
- Acciones rápidas para medir, reponer, nutrir, renovar, observar o informar un problema.

Los gráficos de temperatura y humedad tienen una vista propia. El resumen no se convierte en un tablero saturado de gráficos.

## 12. Plantilla y copia de seguridad

Se distinguen dos archivos:

- **Plantilla:** configuración, plan, tareas y reglas para crear un cultivo nuevo; no contiene historial.
- **Copia de seguridad:** cultivo existente con configuración, historial y registros.

Nombre provisional de la plantilla:

`eyeballz-4-dwc.example.json`

### 12.1 Importación

1. El usuario selecciona la plantilla.
2. Se muestra un resumen corto.
3. Al confirmar, se crea una copia completamente editable.
4. La fecha y hora de importación se convierten en el inicio del ciclo.
5. Se crean las plantas A, B, C y D, ya como semillas en lana de roca.
6. Se crean las cuatro asignaciones iniciales.
7. Se activa Enraizado, semana 0.
8. Se generan las tareas iniciales y se abre el resumen.

Importar otra vez crea un cultivo independiente y nunca sobrescribe uno existente.

### 12.2 Contenido excluido

La plantilla no contiene:

- Mediciones o historial del Sonoff.
- Fotografías o incidencias.
- Tareas completadas.
- Credenciales, direcciones de red o claves de eWeLink.
- Identificadores personales.
- Fechas históricas.

La conexión con el Sonoff queda pendiente después de importar. Mientras no se vincule, sus variables aparecen como pendientes de conexión, no como errores.

### 12.3 Edición

Todo lo importado es editable: nombre, variedad, DWC, plantas, volúmenes, equipos, fuentes, etapas, receta, tareas, alertas, inventario y asignaciones.

La única referencia conservada es:

> Creado desde “Eyeballz — 4 DWC independientes”.

## 13. Inicio sin barreras artificiales

No existe una lista rígida de aprobación previa. Al importar, el cultivo puede iniciarse inmediatamente.

- La fecha de importación es la fecha inicial.
- Las cuatro semillas ya están en lana de roca.
- Los cuatro DWC y sus asignaciones ya existen.
- La etapa inicial es Enraizado, semana 0.
- La información adicional se solicita únicamente cuando resulte relevante.

## 14. Decisiones todavía abiertas

- Combinaciones físicas exactas de los controles binarios del LED.
- Orden oficial de incorporación de Macro, Micro y Bloom indicado por envase/QR.
- Confirmación de presentación comercial y stock real del reductor de pH.
- Forma concreta de vincular SonoffLAN, asunto reservado para arquitectura técnica.
- Comportamiento de notificaciones cuando la aplicación está cerrada, reservado para arquitectura técnica.
- Formato técnico definitivo, versionado y validación de los archivos importables.

## 15. Fuentes de orientación registradas

- Verdeagua Nutrients: https://www.verdeagua.com.ar/nutrients/
- University of Missouri Extension, preparación y control de soluciones: https://extension.missouri.edu/publications/g6984
- Oklahoma State University, gestión de pH y EC: https://extension.okstate.edu/fact-sheets/electrical-conductivity-and-ph-guide-for-hydroponics
- Virginia Tech, DWC y frecuencia de control: https://ext.vt.edu/content/dam/pubs_ext_vt_edu/spes/spes-464/SPES-464.pdf
- SonoffLAN, soporte local de THR316D/THR320D: https://github.com/AlexxIT/SonoffLAN
