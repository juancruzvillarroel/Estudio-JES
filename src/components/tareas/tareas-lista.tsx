"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, FileDown, Pencil, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TareaDialog } from "@/components/tareas/tarea-dialog";
import { abrirInformeTarea } from "@/components/tareas/informe-tarea";
import {
  cambiarEstadoItemTarea,
  cambiarEstadoTarea,
  mandarACorregirTarea,
} from "@/actions/tareas";
import { cn, formatFecha } from "@/lib/utils";
import {
  avanceItems,
  colorPersona,
  PRIORIDAD_BADGE,
  PRIORIDAD_LABELS,
  type EstadoTarea,
  type OpcionSimple,
  type TareaItemOpcion,
  type TareaOpcion,
} from "@/lib/tareas";

/**
 * Un renglón tildable del checklist. Se usa igual para los sub ítems sueltos y
 * para los que están dentro de una sección: lo único que cambia es dónde se
 * dibuja.
 */
function ItemCheck({
  item,
  disabled,
  onToggle,
}: {
  item: TareaItemOpcion;
  disabled: boolean;
  onToggle: (itemId: string, completado: boolean) => void;
}) {
  return (
    <li>
      <label className="flex cursor-default items-start gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-accent hover:text-accent-foreground">
        <Checkbox
          checked={item.completado}
          disabled={disabled}
          onCheckedChange={(checked) => onToggle(item.id, checked === true)}
          className="mt-0.5"
        />
        <span className={cn("min-w-0", item.completado && "text-muted-foreground line-through")}>
          {item.texto}
        </span>
      </label>
    </li>
  );
}

/**
 * Cuánto tarda una tarea tildada en terminar de irse. Tiene que coincidir con
 * la animación `.tarea-saliendo` de globals.css: acá se usa para esperar a que
 * termine antes de avisarle al padre, que es quien la saca de la lista.
 */
const MS_SALIDA = 520;

/**
 * Lista de tareas compartida por la pestaña de un proyecto y la vista global
 * de todas las obras. No maneja estado propio: quien la usa es el dueño de la
 * lista y recibe los cambios por `onSaved` / `onDeleted`.
 */
export function TareasLista({
  tareas,
  rubros,
  usuarios,
  mostrarObra = false,
  onSaved,
  onDeleted,
  vacio,
}: {
  tareas: TareaOpcion[];
  rubros: OpcionSimple[];
  usuarios: OpcionSimple[];
  /** Muestra el nombre de la obra en cada fila (vista global). */
  mostrarObra?: boolean;
  onSaved: (tarea: TareaOpcion) => void;
  onDeleted: (id: string) => void;
  vacio: string;
}) {
  const [pending, startTransition] = useTransition();
  // Qué checklists están abiertos. Arranca todo cerrado para que la lista se
  // lea de un vistazo; el avance ya se ve en el "3/5" del encabezado.
  const [abiertas, setAbiertas] = useState<string[]>([]);
  /**
   * Tareas que se están yendo, con el tilde que hay que mostrarles mientras
   * dura la animación.
   *
   * Tildar una tarea siempre la saca de la lista que se está mirando (las dos
   * vistas muestran un solo estado a la vez), así que sin esto desaparecía en
   * el mismo instante del clic y no se llegaba a ver el cuadrado llenarse. El
   * tilde se pinta acá, sin esperar al servidor, y la tarea se saca recién
   * cuando la animación terminó.
   */
  const [saliendo, setSaliendo] = useState<Record<string, boolean>>({});
  /**
   * La tarea que se acaba de dar por hecha y está esperando que se elija qué
   * hacer con ella: mandarla a revisión o darla por terminada.
   *
   * Es la misma pregunta se llegue por donde se llegue —tildando la tarea
   * entera o tildando el último paso del checklist—, así que hay un solo
   * diálogo y las dos puertas de entrada lo abren.
   */
  const [decidiendo, setDecidiendo] = useState<TareaOpcion | null>(null);
  /** La tarea que se está devolviendo de la revisión, con su nota. */
  const [devolviendo, setDevolviendo] = useState<TareaOpcion | null>(null);
  const [nota, setNota] = useState("");

  const dejarDeSalir = (id: string) =>
    setSaliendo((prev) => {
      // Devolver el mismo objeto cuando la tarea no estaba saliendo evita un
      // render de toda la lista al pedo (pasa si el servidor falla dos veces).
      if (!(id in prev)) return prev;
      const resto = { ...prev };
      delete resto[id];
      return resto;
    });

  const toggleAbierta = (id: string) =>
    setAbiertas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /**
   * Saca la tarea de la lista con la animación de salida y recién después le
   * avisa al padre.
   *
   * Sirve para cualquier movimiento del circuito porque todos tienen el mismo
   * efecto acá: cada solapa muestra un solo estado, así que cambiar de estado
   * es siempre irse de la lista que se está mirando. `marcado` es el tilde que
   * se pinta mientras dura la animación, que es el del estado al que va y no el
   * que tiene guardado: es justamente lo que se quiere ver antes de que se vaya.
   */
  const moverTarea = (
    tarea: TareaOpcion,
    marcado: boolean,
    accion: () => Promise<Awaited<ReturnType<typeof cambiarEstadoTarea>>>
  ) => {
    setSaliendo((prev) => ({ ...prev, [tarea.id]: marcado }));

    startTransition(async () => {
      const result = await accion();
      if (!result.success) {
        toast.error(result.error);
        // No se guardó: la tarea se queda y vuelve a su tilde de antes.
        dejarDeSalir(tarea.id);
        return;
      }
      // El `setTimeout` va afuera de la transición: si la espera ocurriera
      // adentro, `pending` seguiría en true toda la animación y apagaría los
      // tildes del resto de la lista.
      //
      // No se descuenta lo que tardó el servidor a propósito. La animación
      // termina con `forwards`, así que pasados los MS_SALIDA la fila ya quedó
      // colapsada e invisible: esperar de más no se ve, y medir el tiempo acá
      // obligaría a llamar a `Date.now()` durante el render.
      setTimeout(() => {
        onSaved(result.item);
        dejarDeSalir(tarea.id);
      }, MS_SALIDA);
    });
  };

  const aplicarEstado = (tarea: TareaOpcion, estado: EstadoTarea) => {
    setDecidiendo(null);
    moverTarea(tarea, estado !== "PENDIENTE", () => cambiarEstadoTarea(tarea.id, estado));
  };

  const devolver = (tarea: TareaOpcion) => {
    const motivo = nota;
    setDevolviendo(null);
    setNota("");
    // Vuelve a pendiente, así que el tilde se apaga mientras se va.
    moverTarea(tarea, false, () => mandarACorregirTarea(tarea.id, motivo));
  };

  /**
   * Tilde de la tarea entera. Tildar no completa: abre la pregunta, que es la
   * que después decide a qué estado va. Destildar sí es directo, porque
   * reabrir no tiene alternativas.
   */
  const handleToggle = (tarea: TareaOpcion, marcada: boolean) => {
    if (marcada) {
      setDecidiendo(tarea);
      return;
    }
    aplicarEstado(tarea, "PENDIENTE");
  };

  const handleToggleItem = (tarea: TareaOpcion, itemId: string, completado: boolean) => {
    startTransition(async () => {
      const result = await cambiarEstadoItemTarea(itemId, completado);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onSaved(result.item);
      // Tildar el último paso es dar la tarea por hecha, así que hace la misma
      // pregunta que tildar la tarea entera. El servidor ya no la completa
      // solo: si lo hiciera, el paso por revisión se saltearía justo en el caso
      // más común, que es ir tildando el checklist hasta el final.
      const avance = avanceItems(result.item);
      if (
        completado &&
        result.item.estado === "PENDIENTE" &&
        avance !== null &&
        avance.hechos === avance.total
      ) {
        setDecidiendo(result.item);
      }
    });
  };

  // Los dos diálogos van afuera de la lista y no adentro de cada fila: la fila
  // que los abrió puede estar yéndose (o haber quedado vacía la lista) justo
  // mientras están abiertos, y colgados de ella se desmontarían en el medio.
  const dialogos = (
    <>
      <Dialog
        open={decidiendo !== null}
        onOpenChange={(open) => {
          if (!open) setDecidiendo(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Va a revisión?</DialogTitle>
            <DialogDescription>
              {decidiendo?.titulo}
              {" — "}
              mandala a revisión para que alguien la controle antes de darla por
              cerrada, o dala por completada ahora mismo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button
              type="button"
              variant="outline"
              onClick={() => decidiendo && aplicarEstado(decidiendo, "COMPLETADA")}
            >
              Completada
            </Button>
            <Button
              type="button"
              onClick={() => decidiendo && aplicarEstado(decidiendo, "EN_REVISION")}
            >
              Mandar a revisión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={devolviendo !== null}
        onOpenChange={(open) => {
          if (!open) setDevolviendo(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mandar a corregir</DialogTitle>
            <DialogDescription>
              {devolviendo?.titulo}
              {" — "}
              vuelve a la lista de pendientes con el cartelito de corregir. El
              checklist queda como está.
            </DialogDescription>
          </DialogHeader>
          {/* La nota es opcional a propósito: muchas devoluciones se hablan en
              el momento y obligar a escribir algo sólo agrega un trámite. */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="correccionNota">Qué hay que corregir (opcional)</Label>
            <Textarea
              id="correccionNota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej.: faltan las cotas del plano de planta baja."
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="button" onClick={() => devolviendo && devolver(devolviendo)}>
              Devolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (tareas.length === 0) {
    return (
      <>
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {vacio}
        </div>
        {dialogos}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tareas.map((tarea) => {
        const completada = tarea.estado === "COMPLETADA";
        const enRevision = tarea.estado === "EN_REVISION";
        // Todo lo que ya se dio por hecho: completada o esperando el visto
        // bueno. Es lo que decide el tilde y el tachado, que no distinguen
        // entre las dos.
        const hecha = tarea.estado !== "PENDIENTE";
        const avance = avanceItems(tarea);
        // Una sección todavía sin sub ítems no suma al avance, pero igual hay
        // algo que desplegar: si no, el usuario la carga y parece que se perdió.
        const tieneChecklist = avance !== null || tarea.secciones.length > 0;
        const abierta = abiertas.includes(tarea.id);
        // Mientras se va, el tilde muestra el estado nuevo aunque la tarea que
        // llega por props siga siendo la vieja: es justamente lo que se quiere
        // ver antes de que la fila se vaya.
        const saliendoComo = saliendo[tarea.id];
        const seVa = saliendoComo !== undefined;
        const marcada = saliendoComo ?? hecha;

        return (
          <div
            key={tarea.id}
            className={cn(
              "flex items-start gap-3 rounded-md border bg-background px-3 py-2.5",
              // Sin pointer-events la fila sigue siendo clickeable mientras se
              // desvanece y se puede volver a tildar algo que ya no está.
              seVa && "tarea-saliendo pointer-events-none"
            )}
          >
            <Checkbox
              checked={marcada}
              disabled={seVa}
              onCheckedChange={(checked) => handleToggle(tarea, checked === true)}
              aria-label={hecha ? "Reabrir la tarea" : "Dar la tarea por hecha"}
              // El Checkbox ya trae transition-colors; acá se le alarga la
              // duración para que el relleno se lea como un gesto y no como un
              // salto. Va sólo en el de la tarea: es el único que arranca una
              // animación de salida y necesita que se vea.
              className="mt-0.5 duration-300"
            />

            {/* Contenido de la tarea.
                En móvil es una sola columna y se lee de arriba a abajo: de qué
                se trata, después las acciones y la persona, y al final las
                fechas. Así el título y la descripción usan todo el ancho del
                bloque en vez de pelearlo con la columna de acciones, que en
                pantallas angostas los dejaba en una tira de dos o tres palabras
                por renglón.
                De `sm` para arriba es una grilla de dos columnas y queda como
                venía: descripción y fechas apiladas a la izquierda, acciones
                arriba a la derecha. Cada caja dice en qué celda va, así que el
                mismo marcado sirve para las dos formas y no hay nada duplicado. */}
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-3 sm:gap-y-1">
              {/* De qué se trata, en tres renglones de menor a mayor detalle:
                  la tarea, la obra y el rubro. El título va arriba y con más
                  peso porque es lo que distingue una fila de otra; la obra y el
                  rubro lo ubican y por eso quedan en letra chica. */}
              <div className="flex min-w-0 flex-col sm:col-start-1">
                {/* Tachado según `marcada` y no según el estado guardado: al
                    tildarla se tacha en el acto, junto con el cuadrado. */}
                <span
                  className={cn(
                    "text-base font-semibold transition-colors",
                    marcada && "text-muted-foreground line-through"
                  )}
                >
                  {tarea.titulo}
                </span>
                {/* La obra y, al lado, la prioridad. En la pestaña de una obra
                    el nombre no se repite y el badge queda solo en este
                    renglón, que es donde se lo busca en las dos vistas.

                    La obra va en negrita para poder barrer la lista buscando
                    una, pero en gris y más chica que el título, así no le
                    compite. */}
                <div className="flex flex-wrap items-center gap-2">
                  {mostrarObra && (
                    <span
                      className={cn(
                        "text-sm font-semibold text-muted-foreground",
                        marcada && "line-through"
                      )}
                    >
                      {tarea.proyectoNombre}
                    </span>
                  )}
                  {/* La prioridad solo aplica a lo que falta hacer: en una
                      tarea ya completada no dice nada y se esconde. */}
                  {!completada && (
                    <Badge variant={PRIORIDAD_BADGE[tarea.prioridad]}>
                      {PRIORIDAD_LABELS[tarea.prioridad]}
                    </Badge>
                  )}
                  {/* El cartelito que pidió el usuario: la tarea volvió de la
                      revisión y hay que retocarla. Es la misma tarea de
                      siempre, de vuelta entre las pendientes, sólo que
                      señalada. */}
                  {tarea.aCorregir && <Badge variant="error">Corregir</Badge>}
                  {enRevision && <Badge variant="warning">En revisión</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {tarea.rubroNombre ?? "Sin rubro"}
                </span>
              </div>

              {tarea.descripcion && (
                <p className="text-sm whitespace-pre-line text-muted-foreground sm:col-start-1">
                  {tarea.descripcion}
                </p>
              )}

              {/* Lo que pidió quien la revisó. Va junto al cartelito y no
                  escondido en el checklist: es la razón por la que la tarea
                  volvió a la lista y sin leerla no se sabe qué hay que hacer.
                  La nota es opcional, así que puede no haber ninguna. */}
              {tarea.aCorregir && tarea.correccionNota && (
                <p className="rounded-md border border-error/30 bg-error-bg/40 px-2 py-1.5 text-sm whitespace-pre-line text-foreground sm:col-start-1">
                  <span className="font-medium">A corregir: </span>
                  {tarea.correccionNota}
                </p>
              )}

              {/* Primero los sueltos y después cada sección con su título, en
                  el mismo orden en que se cargaron en el formulario. */}
              {tieneChecklist && abierta && (
                <div className="mt-1 flex flex-col gap-2 border-l pl-3 sm:col-start-1">
                  {tarea.items.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {tarea.items.map((sub) => (
                        <ItemCheck
                          key={sub.id}
                          item={sub}
                          disabled={pending}
                          onToggle={(itemId, hecho) => handleToggleItem(tarea, itemId, hecho)}
                        />
                      ))}
                    </ul>
                  )}
                  {tarea.secciones.map((seccion) => (
                    <div key={seccion.id} className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-2 px-1">
                        <span className="text-xs font-semibold tracking-wide uppercase">
                          {seccion.titulo}
                        </span>
                        {seccion.items.length > 0 && (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {seccion.items.filter((i) => i.completado).length}/
                            {seccion.items.length}
                          </span>
                        )}
                      </div>
                      <ul className="flex flex-col gap-1">
                        {seccion.items.map((sub) => (
                          <ItemCheck
                            key={sub.id}
                            item={sub}
                            disabled={pending}
                            onToggle={(itemId, hecho) => handleToggleItem(tarea, itemId, hecho)}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {/* Lo que se hace con la tarea y de quién es. Todo lo que la
                  describe (título, obra, rubro, fechas, prioridad) queda afuera
                  de esta caja.

                  En móvil va en el medio del bloque, entre la descripción y las
                  fechas: los íconos a la izquierda y la persona a la derecha,
                  siempre en el mismo lugar para poder barrer la lista buscando
                  de quién es cada cosa. En pantallas anchas se corre a la
                  columna de la derecha y se apila, que es como venía. */}
              <div className="flex flex-wrap items-center justify-between gap-2 max-sm:mt-1 sm:col-start-2 sm:row-start-1 sm:flex-col sm:items-end sm:self-start">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Las dos salidas de la revisión, y sólo aparecen mientras
                      la tarea está esperando que la miren. Van primeras y con
                      texto en vez de ícono porque en esta solapa son lo único
                      que se viene a hacer. */}
                  {enRevision && (
                    <>
                      <Button
                        type="button"
                        size="xs"
                        disabled={seVa}
                        onClick={() => aplicarEstado(tarea, "COMPLETADA")}
                      >
                        Aprobar
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={seVa}
                        onClick={() => {
                          setNota("");
                          setDevolviendo(tarea);
                        }}
                      >
                        <RotateCcw />
                        Corregir
                      </Button>
                    </>
                  )}
                  {tieneChecklist && (
                    <button
                      type="button"
                      onClick={() => toggleAbierta(tarea.id)}
                      aria-expanded={abierta}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <ChevronRight
                        className={cn("h-3.5 w-3.5 transition-transform", abierta && "rotate-90")}
                      />
                      <span className="tabular-nums">
                        {avance ? `${avance.hechos}/${avance.total}` : "Ver checklist"}
                      </span>
                    </button>
                  )}
                  {/* Abre el informe imprimible en una pestaña aparte; de ahí se
                      guarda como PDF para mandárselo a quien tiene que hacerla. */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Descargar informe de la tarea"
                    title="Descargar informe"
                    onClick={() => abrirInformeTarea(tarea)}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                  </Button>
                  <TareaDialog
                    rubros={rubros}
                    usuarios={usuarios}
                    item={tarea}
                    onSaved={onSaved}
                    onDeleted={onDeleted}
                    trigger={
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar tarea">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                </div>

                {/* Quién la tiene que hacer. El ancho se limita sólo en
                    escritorio, donde esta caja es una columna angosta y varios
                    nombres largos se comerían el título; en móvil tiene el
                    renglón entero y no hace falta. */}
                <div className="flex flex-wrap justify-end gap-1 sm:max-w-48">
                  {tarea.asignados.length > 0 ? (
                    tarea.asignados.map((a) => (
                      <Badge key={a.id} className={colorPersona(a.id)}>
                        {a.nombre}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin asignar</span>
                  )}
                </div>
              </div>

              {/* Al final del bloque, lo que ubica a la tarea en el tiempo. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:col-start-1">
                {/* La fecha de creación es la que manda el orden de la lista,
                    así que conviene tenerla a la vista para entender por qué
                    cada tarea está donde está. */}
                <span>Creada el {formatFecha(tarea.createdAt)}</span>
                {enRevision && tarea.enRevisionEl && (
                  <span className="text-warning">
                    En revisión desde el {formatFecha(tarea.enRevisionEl)}
                  </span>
                )}
                {completada && tarea.completadaEl && (
                  <span className="text-success">
                    Completada el {formatFecha(tarea.completadaEl)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {dialogos}
    </div>
  );
}
