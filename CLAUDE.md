@AGENTS.md

# Estudio JES — sistema de gestión de obras

Aplicación interna del estudio para seguir cada obra: proyectos, cómputo, pedidos y
entregas de materiales, proveedores, inventario, trámites municipales, documentación,
tareas y flujo de fondos. Todo (interfaz, código, nombres de variables y comentarios)
está en español rioplatense.

## Stack

- Next.js 16 (App Router). Ojo: `src/proxy.ts` reemplaza al viejo `middleware.ts`.
  Antes de escribir código de Next, leer lo que dice AGENTS.md.
- React 19, TypeScript, Tailwind 4, componentes shadcn sobre `@base-ui/react` (`src/components/ui`).
- Prisma 7 sobre Postgres en Neon (`src/lib/db.ts`). El cliente se genera en
  `src/generated/prisma` (no está en git; lo crea `npm install` vía `prisma generate`).
- Formularios con react-hook-form + zod 4 (`src/lib/validations`). Avisos con sonner.
- Archivos adjuntos en Vercel Blob. Sesión con cookie JWT firmada con jose (`src/lib/session.ts`).

## Forma de trabajo

- Los cambios se hacen y se prueban primero en la copia local (`npm run dev`).
- Recién cuando Juan lo pide se hace commit y push a GitHub. No commitear ni pushear por
  iniciativa propia.

## Comandos

- `npm run dev` — servidor local (la config de `.claude/launch.json` lo levanta en el puerto 3001).
- `npm run lint` — ESLint. No hay tests automáticos: verificar con lint y `npx tsc --noEmit`.
- `npm run db:seed` — datos iniciales. En `scripts/` hay scripts sueltos de backfill e
  importación que se corren a mano con `npx tsx`; tocan la base real, no correrlos sin pedirlo.
- Variables de entorno: ver `.env.example` (DATABASE_URL, SESSION_SECRET, BLOB_READ_WRITE_TOKEN).

## Cómo está organizado

Cada módulo se reparte en las mismas cuatro capas:

| Capa | Dónde | Qué hay |
| --- | --- | --- |
| Datos | `prisma/schema.prisma` | Un único esquema para todo el sistema |
| Lógica | `src/lib/<modulo>.ts` | `include` de Prisma, funciones `map*` y cálculos puros |
| Escritura | `src/actions/<modulo>.ts` | Server Actions (`"use server"`) |
| Pantalla | `src/components/<modulo>/` | Componentes, diálogos e informes imprimibles |

Las páginas viven en `src/app/(protected)/`. El detalle de un proyecto
(`proyectos/[id]/page.tsx`) es el punto de encuentro: trae los datos de todas las
secciones y se los pasa a `ProyectoSecciones`, que muestra una portada con una tarjeta
por sección (Documentación, Tareas, Municipal, Cómputo, Movimientos, Flujo de fondos).

## Módulos

Entre paréntesis, la clave de permiso que piden sus Server Actions (`requireSeccion`).

- **Proyectos** (`proyectos`): datos de la obra, imagen, folleto de venta y niveles
  (`NivelProyecto`: PLANTA BAJA, PLANTA TIPO ×4, AZOTEA…, que se cargan a mano y los usa
  el cómputo; ver `src/lib/niveles.ts`). `Proyecto.cantidadPisos` está en desuso.
  Archivos: `actions/proyectos.ts`, `actions/niveles-proyecto.ts`, `components/proyectos/`.
- **Cómputo** (`proyectos`): mediciones de la obra por rubro, sección y nivel.
  Detalle en `src/components/computos/CLAUDE.md`.
- **Flujo de fondos** (`flujo-fondos`): gastos, aportes, facturas, presupuesto, ventas y
  honorarios. Detalle en `src/components/flujo-fondos/CLAUDE.md`.
- **Pedidos y entregas** (`pedidos`): pedidos de materiales a proveedores y sus entregas.
  El estado del pedido (PENDIENTE, PARCIAL, COMPLETO) se recalcula solo según lo entregado,
  y cada entrega genera movimientos de inventario. Los **acopios** (por monto o por material)
  son compras adelantadas a un proveedor de las que después cuelgan pedidos.
  Archivos: `actions/pedidos.ts`, `actions/entregas.ts`, `actions/acopios.ts`,
  `components/pedidos/`, `components/acopios/`; en el proyecto se ven como "Movimientos".
- **Proveedores y materiales** (`proveedores`): proveedores, catálogo de materiales y el
  catálogo de rubros y subrubros que usa todo el sistema. Los códigos automáticos (rubro 05,
  material 05-01, proveedor PROV-0001) se arman en `src/lib/codigos.ts`. Los tildes de cada
  rubro (`seComputa`, `pagaHonorarios`, `esHonorarios`) se editan acá.
  Archivos: `actions/proveedores.ts`, `materiales.ts`, `rubros.ts`, `subrubros.ts` y
  `components/proveedores/`, `materiales/`, `rubros/`.
- **Inventario** (`inventario`): stock de materiales por movimientos de entrada y salida.
  `actions/inventario.ts`, `components/inventario/`.
- **Municipal** (`proyectos`): trámites por categoría y etapa. El estado pasa a PRESENTADO
  solo al adjuntar el archivo, no se edita a mano. `actions/municipal.ts`,
  `etapas-municipales.ts`, `categorias-municipales.ts`, `components/municipal/`.
- **Documentación** (`proyectos`): planos y documentos por proyecto, con la misma regla del
  estado por archivo adjunto. Hay un catálogo compartido entre obras: para renombrar en una
  obra se saca una copia propia (`reemplazaTipoId`) en vez de editar el original. Desde un
  documento se puede crear una tarea. `actions/documentos.ts`, `components/documentacion/`.
- **Tareas** (sin permiso propio: las ve cualquier usuario logueado): pendientes de obra
  con prioridad, asignados, checklist por secciones y circuito de revisión ("A corregir").
  Se ven en el proyecto y en `/tareas`; los cambios tienen que refrescar las dos vistas.
  `actions/tareas.ts`, `src/lib/tareas.ts`, `components/tareas/`.
- **Usuarios** (solo administradores): alta de usuarios y permisos por sección. Se entra con
  nombre de usuario, no con email (`src/lib/usuarios.ts`). `actions/usuarios.ts`,
  `actions/auth.ts`, `components/usuarios/`.
- **Inicio** (`dashboard`): `src/app/(protected)/dashboard/page.tsx`.

## Convenciones

- **Server Actions**: empiezan con `await requireSeccion("<clave>")` (`src/lib/dal.ts`),
  validan la entrada, escriben con Prisma, llaman a `revalidatePath` y devuelven
  `{ success: true, ... } | { success: false, error: string }` con el error en español,
  listo para mostrar al usuario. No tiran excepciones hacia el cliente.
- **Tipos "Opción"**: lo que viaja al cliente son objetos planos (`MovimientoFondoOpcion`,
  `ItemOpcion`, etc.) armados con funciones `map*` en `src/lib`. Decimal pasa a `number` y
  Date a string ISO. No pasar modelos de Prisma directo a componentes cliente.
- **Lo calculado no se guarda**: totales, montos mensuales del presupuesto, honorarios y
  cantidades de compra se derivan en funciones puras de `src/lib`. No agregar columnas para
  guardar resultados que se pueden calcular.
- **Fechas**: las fechas "de calendario" (facturas, inicio de obra) se guardan al mediodía UTC
  para que ningún huso horario las corra de día (ver `src/lib/facturas.ts`).
- **Comentarios**: el código explica el *por qué* de cada decisión, en prosa y en español. Al
  cambiar algo, actualizar el comentario que lo justifica en lugar de dejarlo desactualizado.
- **Permisos**: el catálogo de secciones habilitables por usuario está en `src/lib/paginas.ts`.
  Los administradores (`esAdmin`) ven todo. Flujo de fondos es un permiso aparte porque es
  información financiera sensible.
- Las Server Actions aceptan hasta 4 MB de cuerpo (`next.config.ts`) por los adjuntos;
  Vercel corta en ~4,5 MB.

## Partes compartidas entre módulos (cuidado al tocarlas)

Varias sesiones pueden trabajar en paralelo sobre módulos distintos. Estos archivos son
de todos, así que conviene cambiarlos en una tarea propia y mergearla antes de seguir:

- `prisma/schema.prisma`, sobre todo `Rubro`, `Subrubro`, `Proyecto` y `Proveedor`, que usan
  cómputo, flujo de fondos, pedidos y tareas a la vez.
- `src/app/(protected)/proyectos/[id]/page.tsx` y `src/components/proyectos/proyecto-secciones.tsx`.
- `src/lib/utils.ts`, `src/lib/niveles.ts`, `src/lib/dal.ts`, `src/lib/paginas.ts` y `src/components/ui/`.

## Pendiente de completar

- Cómo se aplican los cambios del esquema a la base: la carpeta `prisma/migrations` tiene solo
  las tres migraciones de julio, pero el esquema creció mucho desde entonces. Hasta aclararlo,
  no crear ni correr migraciones sin preguntar.
