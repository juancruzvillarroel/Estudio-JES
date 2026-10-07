import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { TareasGlobal } from "@/components/tareas/tareas-global";
import { mapTarea, tareaInclude } from "@/lib/tareas";

export default async function TareasPage() {
  // Las tareas no están detrás de un permiso de sección: las ve cualquier
  // usuario logueado (ver NAV_ITEMS, la entrada va sin `key`).
  await verifySession();

  const [tareasRaw, proyectos, rubros, usuarios] = await Promise.all([
    prisma.tarea.findMany({ include: tareaInclude, orderBy: { createdAt: "desc" } }),
    prisma.proyecto.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    prisma.rubro.findMany({ orderBy: { orden: "asc" }, select: { id: true, nombre: true } }),
    prisma.user.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);

  // El encabezado se le pasa a `TareasGlobal` en vez de dibujarse acá porque el
  // botón de "Nueva tarea" va en ese mismo renglón, y ese botón necesita el
  // `onSaved` que vive adentro del componente cliente. Igual que en Pedidos, la
  // acción principal de la pantalla va arriba a la derecha.
  //
  // El título va con el mismo marcado de siempre y no con <PageHeader />: ese
  // componente le mide el ancho al <h1> y le recorta el subtítulo a esa medida,
  // que acá dejaba el encabezado irreconocible.
  return (
    <TareasGlobal
      encabezado={
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tareas</h1>
          <p className="text-sm text-muted-foreground">
            Pendientes de todas las obras. Filtrá por obra, rubro o persona asignada.
          </p>
        </div>
      }
      tareas={tareasRaw.map(mapTarea)}
      proyectos={proyectos}
      rubros={rubros}
      usuarios={usuarios}
    />
  );
}
