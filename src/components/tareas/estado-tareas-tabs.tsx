"use client";

import { Tabs, TabsList, TabsTrigger, TabsIndicator, TabsContent } from "@/components/ui/tabs";
import { ESTADO_TAREA_LABELS, type EstadoTarea } from "@/lib/tareas";

/** El orden del circuito: se hace, se revisa, se cierra. */
const ESTADOS: EstadoTarea[] = ["PENDIENTE", "EN_REVISION", "COMPLETADA"];

/**
 * Las tres solapas de tareas, iguales en la pestaña de una obra y en la vista
 * de todas juntas.
 *
 * Reemplazan al tilde de "Ver completadas", que servía cuando había dos listas
 * pero se queda corto con tres: había que adivinar dónde fue a parar una tarea
 * que se mandó a revisar. Acá los tres destinos están siempre a la vista, cada
 * uno con cuántas tiene, así se ve de un vistazo si hay algo esperando que lo
 * miren sin tener que entrar a buscarlo.
 *
 * El contenido va adentro de la solapa activa y no debajo: así el panel queda
 * asociado a su solapa para el lector de pantalla. Se dibuja una sola —la
 * elegida— porque las tres muestran lo mismo con otra lista, y el `key` la
 * hace montar de nuevo en cada cambio, que es lo que dispara la animación de
 * entrada.
 */
export function EstadoTareasTabs({
  value,
  onChange,
  conteos,
  children,
}: {
  value: EstadoTarea;
  onChange: (estado: EstadoTarea) => void;
  conteos: Record<EstadoTarea, number>;
  children: React.ReactNode;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as EstadoTarea)}>
      {/* Mismo criterio que las solapas de Flujo de fondos: ocupan todo el
          ancho y se reparten en partes iguales. En móvil los tres nombres con
          su número no entran en un renglón, así que envuelven y cada una vuelve
          a medir lo que dice, en vez de quedar cortadas contra el borde.

          El `!` en `h-auto`: el alto fijo lo pone `group-data-horizontal/tabs:h-8`
          en ui/tabs.tsx, que es un selector de descendiente y le gana en
          especificidad a una utilidad suelta. Ver el comentario largo en
          flujo-fondos-section.tsx. */}
      <TabsList
        variant="indicator"
        className="w-full max-sm:h-auto! max-sm:flex-wrap max-sm:gap-1 max-sm:[&_[data-slot=tabs-trigger]]:h-7 max-sm:[&_[data-slot=tabs-trigger]]:flex-none"
      >
        <TabsIndicator />
        {ESTADOS.map((estado) => (
          <TabsTrigger key={estado} value={estado}>
            {ESTADO_TAREA_LABELS[estado]}
            {/* El número va aparte y en tabular para que no baile de ancho al
                pasar de 9 a 10 y mueva el nombre de lugar. */}
            <span className="tabular-nums opacity-70">{conteos[estado]}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent
        key={value}
        value={value}
        className="mt-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
      >
        {children}
      </TabsContent>
    </Tabs>
  );
}
