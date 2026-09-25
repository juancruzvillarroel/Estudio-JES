"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronRight, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SeccionGrilla } from "@/components/computos/seccion-grilla";
import { abrirInformeComputo } from "@/components/computos/informe-computo";
import { InformeRubroDialog } from "@/components/computos/informe-rubro-dialog";
import { crearSeccion, eliminarItem } from "@/actions/computos";
import {
  calcularTotales,
  formatCantidad,
  simboloUnidad,
  TIPOS_COMPUTO,
  TIPO_COMPUTO_LABEL,
  type FilaExtraOpcion,
  type ItemOpcion,
  type SeccionOpcion,
  type TipoComputo,
} from "@/lib/computos";
import type { NivelOpcion } from "@/lib/niveles";
import { cn } from "@/lib/utils";

export type RubroComputo = {
  id: string;
  nombre: string;
  /** Sigue viniendo para el informe impreso, que todavía agrupa por subrubro. */
  subrubros: { id: string; nombre: string }[];
};

/**
 * El campo para crear una sección adentro de un rubro.
 *
 * Es un input suelto y no un diálogo porque una sección es un nombre y nada
 * más, y porque se cargan de a varias seguidas: MUROS, REVOQUES, CONTRAPISOS,
 * IMPERMEABILIZACIONES. Al guardar se limpia y el foco se queda donde está,
 * así se escriben las cuatro sin tocar el mouse.
 */
function SeccionNueva({
  proyectoId,
  rubroId,
  tipo,
  onCreada,
}: {
  proyectoId: string;
  rubroId: string;
  /** El lado del switch que está abierto: la sección nace de ese lado. */
  tipo: TipoComputo;
  onCreada: (seccion: SeccionOpcion) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [pending, startTransition] = useTransition();
  const campo = useRef<HTMLInputElement>(null);

  const agregar = () => {
    const limpio = nombre.trim();
    if (limpio === "" || pending) return;
    startTransition(async () => {
      const result = await crearSeccion(proyectoId, rubroId, tipo, limpio);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onCreada(result.seccion);
      setNombre("");
      campo.current?.focus();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        ref={campo}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            agregar();
          }
        }}
        // Dice de qué lado va a caer: el switch está arriba y para cuando se
        // llega al campo ya no se lo está mirando.
        placeholder={`Agregar sección de ${TIPO_COMPUTO_LABEL[tipo].toLowerCase()}…`}
        aria-label="Nombre de la sección nueva"
        className="h-8 max-w-sm px-2 text-sm"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={nombre.trim() === "" || pending}
        onClick={agregar}
      >
        <Plus className="h-3.5 w-3.5" />
        Sección
      </Button>
    </div>
  );
}

/**
 * El switch de un rubro: materiales de un lado, mano de obra del otro.
 *
 * Son dos cómputos distintos y no dos vistas del mismo, así que el control no
 * filtra nada: cambia de grilla.
 *
 * La marca del lado activo es UNA pastilla que se corre, no un fondo que se
 * prende en un botón y se apaga en el otro. Es la misma diferencia que entre una
 * llave y dos botones: el movimiento cuenta que hay un solo estado con dos
 * posiciones, y al ojo le queda claro que nada se está sumando ni filtrando.
 *
 * Las dos columnas son iguales (grid-cols-2) justamente para que la pastilla sea
 * medio ancho exacto y se pueda correr con un translate, sin medir nada en JS.
 */
function SwitchTipo({
  valor,
  onCambio,
}: {
  valor: TipoComputo;
  onCambio: (tipo: TipoComputo) => void;
}) {
  const indice = Math.max(0, TIPOS_COMPUTO.indexOf(valor));
  return (
    <div
      role="group"
      aria-label="Materiales o mano de obra"
      className="relative inline-grid w-fit grid-cols-2 rounded-md border bg-muted/60 p-0.5"
    >
      {/* inset-y-0.5 / left-0.5 dejan el padding del contenedor; el ancho es
          medio menos ese padding, así translateX(100%) cae justo en la segunda
          columna. */}
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-sm bg-background shadow-sm transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${indice * 100}%)` }}
      />
      {TIPOS_COMPUTO.map((tipo) => {
        const activo = tipo === valor;
        return (
          <button
            key={tipo}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambio(tipo)}
            className={cn(
              "relative z-10 rounded-sm px-3 py-1 text-center text-xs font-medium transition-colors duration-200",
              activo ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {TIPO_COMPUTO_LABEL[tipo]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Los ítems que quedaron sin sección.
 *
 * Son de antes: el cómputo se organizaba por subrubro (MANO DE OBRA /
 * MATERIALES) y los ítems colgaban del rubro directamente. No se migran solos a
 * ninguna sección porque no hay forma de adivinar a cuál: el nombre no lo dice.
 * Se listan para poder borrarlos, y el bloque desaparece cuando no queda
 * ninguno.
 */
function SinSeccion({
  proyectoId,
  items,
  totales,
  onDeleted,
}: {
  proyectoId: string;
  items: ItemOpcion[];
  totales: Map<string, number>;
  onDeleted: (id: string) => void;
}) {
  const [, startTransition] = useTransition();

  return (
    <div className="rounded-md border border-dashed bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">
        Estos ítems se cargaron antes de que existieran las secciones, así que no
        están en ninguna grilla. Borralos y volvé a crearlos adentro de la sección
        que corresponda.
      </p>
      <div className="mt-2 flex flex-col gap-1">
        {items.map((item) => {
          const total = totales.get(item.id) ?? 0;
          return (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-sm bg-background px-2 py-1"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{item.nombre}</span>
              <span className="shrink-0 text-sm tabular-nums">
                {item.mediciones.length === 0 ? "—" : formatCantidad(total)}
              </span>
              <span className="w-8 shrink-0 text-xs text-muted-foreground">
                {simboloUnidad(item.unidad)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Eliminar ${item.nombre}`}
                onClick={() =>
                  startTransition(async () => {
                    const result = await eliminarItem(proyectoId, item.id);
                    if (!result.success) {
                      toast.error(result.error);
                      return;
                    }
                    onDeleted(item.id);
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Cómputo de una obra: qué se va a hacer, qué hace falta comprar y cuánto.
 *
 * Se lee como se trabaja: rubro → sección → grilla. Los rubros de obra están
 * todos, siempre, aunque estén vacíos, y ese es el punto: la lista de rubros es
 * el índice de lo que hay que computar, y un rubro que desaparece por no tener
 * nada cargado es justamente el que hay que mirar. Arrancan cerrados porque un
 * cómputo terminado son diecinueve rubros y doscientos ítems, y abrirlo todo de
 * una no es una pantalla, es un muro.
 *
 * Las secciones (MUROS, REVOQUES, CONTRAPISOS) se escriben a mano, obra por
 * obra. No salen de una plantilla compartida porque al empezar no se le puede
 * acertar a todas las obras de una: se arman mirando ésta, y cuando sirven se
 * copian a las demás.
 *
 * Adentro, la grilla: los niveles como filas, los ítems como columnas. La obra
 * se mide, se contrata y se paga por planta, así que el cómputo se lee igual.
 *
 * No hay un total general en ningún lado a propósito: sumar m² con kg y
 * unidades da un número que no significa nada. Cada columna tiene el suyo, en
 * su unidad, que es el que se manda a cotizar.
 */
export function ComputoBoard({
  proyectoId,
  proyectoNombre,
  niveles,
  rubros,
  secciones: seccionesProp,
  filasExtra: filasExtraProp,
  items: itemsProp,
}: {
  proyectoId: string;
  proyectoNombre: string;
  /** Los niveles de la obra, de abajo hacia arriba, de "Editar datos". */
  niveles: NivelOpcion[];
  /** Sólo los rubros que se computan (Rubro.seComputa). */
  rubros: RubroComputo[];
  secciones: SeccionOpcion[];
  /** Las filas puntuales de cada sección, todas juntas: cada grilla toma las suyas. */
  filasExtra: FilaExtraOpcion[];
  items: ItemOpcion[];
}) {
  const [items, setItems] = useState(itemsProp);
  const [prevItems, setPrevItems] = useState(itemsProp);
  const [secciones, setSecciones] = useState(seccionesProp);
  const [prevSecciones, setPrevSecciones] = useState(seccionesProp);
  const [filasExtra, setFilasExtra] = useState(filasExtraProp);
  const [prevFilasExtra, setPrevFilasExtra] = useState(filasExtraProp);
  const [rubrosAbiertos, setRubrosAbiertos] = useState<Set<string>>(new Set());
  /**
   * De qué lado está parado cada rubro. Se guarda por rubro y no uno solo para
   * toda la pantalla porque son dos trabajos distintos: se computa el material
   * de la estructura y la mano de obra de la albañilería en la misma sesión, y
   * un switch global obligaría a ir y volver todo el tiempo.
   *
   * Lo que no está acá arranca en MATERIALES, que es con lo que se empieza.
   */
  const [tipoPorRubro, setTipoPorRubro] = useState<Record<string, TipoComputo>>({});

  if (itemsProp !== prevItems) {
    setPrevItems(itemsProp);
    setItems(itemsProp);
  }
  if (seccionesProp !== prevSecciones) {
    setPrevSecciones(seccionesProp);
    setSecciones(seccionesProp);
  }
  if (filasExtraProp !== prevFilasExtra) {
    setPrevFilasExtra(filasExtraProp);
    setFilasExtra(filasExtraProp);
  }

  const toggleRubro = (id: string) =>
    setRubrosAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /**
   * Un ítem que llega del servidor: puede ser uno que ya estaba (se le editó el
   * nombre, o se le guardó una celda) o uno recién creado. La grilla usa el
   * mismo callback para los dos casos, así que acá se decide si reemplaza o
   * suma en vez de hacérselo distinguir a quien llama.
   */
  const reemplazarItem = (i: ItemOpcion) =>
    setItems((prev) =>
      prev.some((x) => x.id === i.id)
        ? prev.map((x) => (x.id === i.id ? i : x))
        : [...prev, i]
    );

  const sacarItem = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));

  const reemplazarSeccion = (s: SeccionOpcion) =>
    setSecciones((prev) => prev.map((x) => (x.id === s.id ? s : x)));

  const agregarSeccion = (s: SeccionOpcion) => {
    setSecciones((prev) => [...prev, s]);
    // La sección nueva se acaba de crear para cargarle columnas: si su rubro
    // estuviera cerrado habría que abrirlo a mano para ver lo que uno mismo
    // acaba de hacer. Lo mismo con el lado: se deja parado donde nació.
    setRubrosAbiertos((prev) => new Set(prev).add(s.rubroId));
    setTipoPorRubro((prev) => ({ ...prev, [s.rubroId]: s.tipo }));
  };

  const sacarSeccion = (id: string) => {
    setSecciones((prev) => prev.filter((x) => x.id !== id));
    setItems((prev) => prev.filter((x) => x.seccionId !== id));
    // Las filas puntuales son de la sección: en la base se van con ella
    // (Cascade), así que acá tampoco pueden quedar.
    setFilasExtra((prev) => prev.filter((x) => x.seccionId !== id));
  };

  /** Igual que con los ítems: puede ser una fila nueva o una que se renombró. */
  const reemplazarFilaExtra = (f: FilaExtraOpcion) =>
    setFilasExtra((prev) =>
      prev.some((x) => x.id === f.id)
        ? prev.map((x) => (x.id === f.id ? f : x))
        : [...prev, f]
    );

  const sacarFilaExtra = (id: string) =>
    setFilasExtra((prev) => prev.filter((x) => x.id !== id));

  /**
   * Los totales salen de TODOS los ítems de la obra y no de los de cada grilla,
   * porque una fila puede salir de una cuenta sobre un ítem de otro rubro (los
   * ladrillos salen de los m² de mampostería). Con el cómputo partido por
   * sección esa cuenta no se podría resolver.
   */
  const totales = calcularTotales(items);

  const sinSeccion = items.filter((i) => i.seccionId === null);
  const conMedidas = items.filter((i) => i.mediciones.length > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {items.length === 0
            ? "Creá una sección adentro de un rubro y cargale los ítems que lleva."
            : `${items.length} ${items.length === 1 ? "ítem" : "ítems"} en ${secciones.length} ${secciones.length === 1 ? "sección" : "secciones"}, ${conMedidas} con medidas`}
        </p>

        <Button
          type="button"
          variant="outline"
          disabled={items.length === 0}
          onClick={() => abrirInformeComputo({ proyectoNombre, rubros, items, niveles })}
        >
          <Printer className="h-4 w-4" />
          Informe
        </Button>
      </div>

      {/* Sin niveles cargados no hay grilla: las filas son los niveles. Se dice
          una vez dónde se cargan y no se insiste. */}
      {niveles.length === 0 && (
        <p className="text-xs text-warning">
          Esta obra no tiene niveles cargados, así que las grillas no tienen filas.
          Se cargan con el botón &quot;Editar datos&quot; de la portada del proyecto,
          con el nombre que cada uno tenga en obra.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {rubros.map((rubro) => {
          const tipo = tipoPorRubro[rubro.id] ?? "MATERIALES";
          const todas = secciones.filter((s) => s.rubroId === rubro.id);
          // Sólo las del lado abierto: el otro lado es otro cómputo, no está
          // escondido detrás de un filtro.
          const delRubro = todas
            .filter((s) => s.tipo === tipo)
            .sort((a, b) => a.orden - b.orden);
          const sueltos = sinSeccion.filter((i) => i.rubroId === rubro.id);
          const cuantos = items.filter((i) => i.rubroId === rubro.id).length;
          const abierto = rubrosAbiertos.has(rubro.id);

          return (
            // Dónde termina un rubro y empieza el otro se lee por el fondo, no
            // por un marco: el rubro abierto se hunde en gris y las grillas
            // quedan blancas encima. Antes esto era un borde negro de 2px, que
            // resolvía lo mismo gritando y dejaba la pantalla llena de cajas.
            <div
              key={rubro.id}
              className={cn(
                "overflow-hidden rounded-lg border transition-colors duration-200",
                abierto && "border-border/80 bg-muted/30 shadow-sm"
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-2 p-2 pl-3 transition-colors duration-200",
                  abierto ? "border-b bg-muted/70" : "bg-muted/30 hover:bg-muted/50"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleRubro(rubro.id)}
                  aria-expanded={abierto}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      abierto && "rotate-90"
                    )}
                  />
                  <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                    {rubro.nombre}
                  </span>
                  {/* Cerrado cuenta el rubro entero, los dos lados: es el resumen
                      de lo que hay adentro, no el de la grilla que quedó abierta.
                      Un rubro vacío no dice "0 secciones": dice nada, y el
                      silencio ya significa que está sin empezar. */}
                  {todas.length > 0 && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {todas.length} {todas.length === 1 ? "sección" : "secciones"}
                      {cuantos > 0 && ` · ${cuantos} ${cuantos === 1 ? "ítem" : "ítems"}`}
                    </span>
                  )}
                </button>

                {/* El botón de bajar el PDF va acá afuera y no adentro del que
                    abre: un botón dentro de otro botón no es HTML válido, y
                    además se querría bajar el rubro sin tener que abrirlo. */}
                {todas.length > 0 && (
                  <InformeRubroDialog
                    proyectoNombre={proyectoNombre}
                    rubroNombre={rubro.nombre}
                    niveles={niveles}
                    secciones={todas}
                    filasExtra={filasExtra}
                    items={items.filter((i) => i.rubroId === rubro.id)}
                    totales={totales}
                  />
                )}
              </div>

              {abierto && (
                <div className="flex flex-col gap-3 p-2 duration-200 animate-in fade-in slide-in-from-top-1">
                  <SwitchTipo
                    valor={tipo}
                    onCambio={(t) =>
                      setTipoPorRubro((prev) => ({ ...prev, [rubro.id]: t }))
                    }
                  />

                  {delRubro.map((seccion) => (
                    <SeccionGrilla
                      key={seccion.id}
                      proyectoId={proyectoId}
                      seccion={seccion}
                      niveles={niveles}
                      filasExtra={filasExtra
                        .filter((f) => f.seccionId === seccion.id)
                        .sort((a, b) => a.orden - b.orden)}
                      items={items
                        .filter((i) => i.seccionId === seccion.id)
                        .sort((a, b) => a.orden - b.orden)}
                      totales={totales}
                      onItemSaved={reemplazarItem}
                      onItemDeleted={sacarItem}
                      onSeccionSaved={reemplazarSeccion}
                      onSeccionDeleted={sacarSeccion}
                      onFilaExtraSaved={reemplazarFilaExtra}
                      onFilaExtraDeleted={sacarFilaExtra}
                    />
                  ))}

                  {/* Los huérfanos son de antes del switch y no son de ningún
                      lado: se muestran en Materiales y no en los dos, que sería
                      el mismo ítem listado dos veces. */}
                  {sueltos.length > 0 && tipo === "MATERIALES" && (
                    <SinSeccion
                      proyectoId={proyectoId}
                      items={sueltos}
                      totales={totales}
                      onDeleted={sacarItem}
                    />
                  )}

                  <SeccionNueva
                    proyectoId={proyectoId}
                    rubroId={rubro.id}
                    tipo={tipo}
                    onCreada={agregarSeccion}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
