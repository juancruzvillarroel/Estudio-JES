"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteButton } from "@/components/ui/delete-button";
import {
  actualizarItemSeccion,
  crearItemEnSeccion,
  eliminarItem,
} from "@/actions/computos";
import {
  esHierro,
  formatCantidad,
  UNIDADES,
  UNIDAD_INFO,
  type ItemOpcion,
  type UnidadComputo,
} from "@/lib/computos";

/**
 * El número que se escribió en el campo de desperdicio.
 *
 * Vacío es null, que no es lo mismo que 0: null es "este ítem no lleva merma" y
 * 0 es "lo pensé y da cero". Se acepta coma o punto, como todas las medidas del
 * módulo, y se rechaza lo que se salga de 0 a 100 —un desperdicio del 150% no
 * es un desperdicio, es un error de tipeo—.
 */
function parsePorcentaje(texto: string): { ok: boolean; valor: number | null } {
  const limpio = texto.trim().replace(",", ".");
  if (!limpio) return { ok: true, valor: null };
  const numero = Number(limpio);
  if (!Number.isFinite(numero) || numero < 0 || numero > 100) {
    return { ok: false, valor: null };
  }
  return { ok: true, valor: numero };
}

/**
 * Un número positivo de un campo de texto, o null si está vacío.
 *
 * Se usa para el rinde y para lo que viene por bulto. Los dos aceptan decimales
 * —hay materiales que rinden 2,5 por metro— y ninguno acepta el 0: un rinde de
 * 0 daría siempre cero material, y un bulto de 0 sería dividir por cero.
 */
function parsePositivo(texto: string): { ok: boolean; valor: number | null } {
  const limpio = texto.trim().replace(",", ".");
  if (!limpio) return { ok: true, valor: null };
  const numero = Number(limpio);
  if (!Number.isFinite(numero) || numero <= 0) return { ok: false, valor: null };
  return { ok: true, valor: numero };
}

/** El texto de un número guardado, o vacío si no hay nada. */
const aTexto = (valor: number | null | undefined) =>
  valor === null || valor === undefined ? "" : formatCantidad(valor);

/**
 * Alta y edición de una columna de la grilla.
 *
 * Son tres campos y los tres se cargan una sola vez, al crear el ítem, porque
 * los tres son del material y no de la pared: cómo se llama, en qué se mide y
 * cuánto se rompe. Un ladrillo se parte siempre en la misma proporción, se lo
 * esté poniendo en planta baja o en la azotea, así que el desperdicio va acá
 * arriba y no repetido en cada celda.
 *
 * La unidad no es un desplegable seco: debajo se lee qué se computa con ella.
 * Elegir mal la unidad es el error que después obliga a rehacer las medidas.
 *
 * No se pregunta el rubro ni la sección: el ítem se crea desde adentro de su
 * grilla, y que quedara en otra no tendría cómo ser cierto.
 */
export function ItemSeccionDialog({
  proyectoId,
  seccionId,
  seccionNombre,
  item,
  trigger,
  onSaved,
  onDeleted,
}: {
  proyectoId: string;
  seccionId: string;
  seccionNombre: string;
  item?: ItemOpcion;
  trigger: React.ReactNode;
  onSaved: (item: ItemOpcion) => void;
  onDeleted?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [unidad, setUnidad] = useState<UnidadComputo>(item?.unidad ?? "M2");
  const [desperdicio, setDesperdicio] = useState(aTexto(item?.desperdicio));
  const [rinde, setRinde] = useState(aTexto(item?.rinde));
  const [rindeUnidad, setRindeUnidad] = useState<UnidadComputo>(
    item?.rindeUnidad ?? "UN"
  );
  const [porBulto, setPorBulto] = useState(aTexto(item?.porBulto));
  const [bultoNombre, setBultoNombre] = useState(item?.bultoNombre ?? "");
  const [modelo, setModelo] = useState(item?.modelo ?? "");
  // Este interruptor es sólo para el hierro: un ítem medido en ML no es hierro
  // por el solo hecho de medirse en metros (un zócalo, una cañería, también se
  // miden así y no vienen en barras de 12 m). Arranca marcado sólo si el ítem
  // ya se había armado así.
  const [esBarraHierro, setEsBarraHierro] = useState(item ? esHierro(item) : false);
  // Las barras de hierro son siempre de 12 m: no hay rinde que elegir ni bulto
  // que nombrar, sólo cuánto pesa cada barra. Ver bloque de abajo.
  const [pesoBarra, setPesoBarra] = useState(
    item && esHierro(item) ? aTexto(item.porBulto) : ""
  );

  const handleOpenChange = (abierto: boolean) => {
    setOpen(abierto);
    if (!abierto) return;
    // Al reabrir se vuelve a lo guardado: un diálogo que se cerró sin guardar no
    // tiene que dejar restos la próxima vez.
    setError(undefined);
    setNombre(item?.nombre ?? "");
    setUnidad(item?.unidad ?? "M2");
    setDesperdicio(aTexto(item?.desperdicio));
    setRinde(aTexto(item?.rinde));
    setRindeUnidad(item?.rindeUnidad ?? "UN");
    setPorBulto(aTexto(item?.porBulto));
    setBultoNombre(item?.bultoNombre ?? "");
    setModelo(item?.modelo ?? "");
    setEsBarraHierro(item ? esHierro(item) : false);
    setPesoBarra(item && esHierro(item) ? aTexto(item.porBulto) : "");
  };

  // El <Select> de Base UI necesita el mapa value → label para mostrar el texto
  // del valor elegido en el trigger.
  const unidadItems = Object.fromEntries(
    UNIDADES.map((u) => [u, `${UNIDAD_INFO[u].nombre} (${UNIDAD_INFO[u].simbolo})`])
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    if (!nombre.trim()) {
      setError("Poné un nombre para el ítem.");
      return;
    }
    const merma = parsePorcentaje(desperdicio);
    if (!merma.ok) {
      setError("El desperdicio tiene que ser un número entre 0 y 100.");
      return;
    }

    // El hierro no tiene rinde para elegir: va siempre en barras de 12 m, así
    // que lo único que hace falta es cuánto pesa cada una. De ahí sale todo lo
    // demás (ver handleSubmit más abajo, rama "ML").
    let conversion: {
      rinde: number | null;
      rindeUnidad: UnidadComputo | null;
      porBulto: number | null;
      bultoNombre: string | null;
    };
    if (unidad === "ML" && esBarraHierro) {
      const peso = parsePositivo(pesoBarra);
      if (!peso.ok) {
        setError("El peso de la barra tiene que ser un número mayor a 0.");
        return;
      }
      conversion =
        peso.valor === null
          ? { rinde: null, rindeUnidad: null, porBulto: null, bultoNombre: null }
          : {
              rinde: peso.valor / 12,
              rindeUnidad: "KG",
              porBulto: peso.valor,
              bultoNombre: "barra",
            };
    } else {
      const cuanto = parsePositivo(rinde);
      if (!cuanto.ok) {
        setError("El rinde tiene que ser un número mayor a 0.");
        return;
      }
      const bulto = parsePositivo(porBulto);
      if (!bulto.ok) {
        setError("Lo que viene por bulto tiene que ser un número mayor a 0.");
        return;
      }
      conversion = {
        rinde: cuanto.valor,
        rindeUnidad: cuanto.valor === null ? null : rindeUnidad,
        porBulto: bulto.valor,
        bultoNombre,
      };
    }

    const datos = {
      nombre,
      unidad,
      desperdicio: merma.valor,
      ...conversion,
      modelo: modelo.trim() || null,
    };

    startTransition(async () => {
      const result = item
        ? await actualizarItemSeccion(proyectoId, item.id, datos)
        : await crearItemEnSeccion(proyectoId, seccionId, datos);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved(result.item);
      setOpen(false);
    });
  };

  const info = UNIDAD_INFO[unidad];
  const cargadas = item?.mediciones.length ?? 0;
  const cambiaUnidad = item && item.unidad !== unidad && cargadas > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {item ? "Editar ítem" : `Nuevo ítem en ${seccionNombre}`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="itemSeccionNombre">Ítem</Label>
            <Input
              id="itemSeccionNombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ladrillo hueco 12"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Va a aparecer como una columna de {seccionNombre}, con una celda por
              nivel.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="itemSeccionModelo">Modelo</Label>
            <Input
              id="itemSeccionModelo"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="FV Siena blanco"
            />
            <p className="text-xs text-muted-foreground">
              La marca y el modelo elegidos, si ya se sabe. No entra en ninguna
              cuenta, es sólo para tenerlo anotado.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="itemSeccionUnidad">Se mide en</Label>
            <Select
              value={unidad}
              onValueChange={(v) => setUnidad(v as UnidadComputo)}
              items={unidadItems}
            >
              <SelectTrigger id="itemSeccionUnidad" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {UNIDAD_INFO[u].nombre} ({UNIDAD_INFO[u].simbolo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{info.ayuda}</p>
            {/* Cambiar la unidad no borra nada (ver actualizarItemSeccion), pero
                sí cambia cómo se lee la columna, y eso conviene decirlo antes. */}
            {cambiaUnidad && (
              <p className="text-xs text-warning">
                Estás cambiando la unidad de un ítem que ya tiene {cargadas}{" "}
                {cargadas === 1 ? "medida cargada" : "medidas cargadas"}. No se borra
                ninguna, pero el total se recalcula.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="itemSeccionDesperdicio">Desperdicio (%)</Label>
            <Input
              id="itemSeccionDesperdicio"
              value={desperdicio}
              onChange={(e) => setDesperdicio(e.target.value)}
              placeholder="10"
              inputMode="decimal"
              className="w-28"
            />
            <p className="text-xs text-muted-foreground">
              Cuánto se rompe o se pierde. La grilla muestra las dos columnas: lo
              medido y lo medido con el desperdicio, que es lo que hay que comprar.
              Vacío es sin desperdicio.
            </p>
          </div>

          {/* Sólo para hierro: medirse en ML no alcanza, un zócalo o una
              cañería también se miden así y no vienen en barras de 12 m. Por
              eso es un interruptor aparte y no algo que se prenda solo con la
              unidad. */}
          {unidad === "ML" && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={esBarraHierro}
                onCheckedChange={(checked) => setEsBarraHierro(checked === true)}
              />
              Es hierro: viene en barras de 12 m
            </label>
          )}

          {unidad === "ML" && esBarraHierro ? (
            // El hierro no necesita el bloque genérico de abajo: la barra
            // comercial es siempre de 12 m, así que no hay rinde que elegir ni
            // bulto que nombrar. Lo único que hace falta saber es cuánto pesa
            // cada barra, y de ahí se derivan las otras dos columnas de la
            // grilla (cantidad de barras y kilos).
            <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Viene en barras de 12 m
                </p>
                <p className="text-xs text-muted-foreground">
                  Cada diámetro pesa distinto. Con el peso de la barra, la
                  grilla calcula sola, por nivel, cuántas barras hacen falta
                  (los metros cargados ÷ 12) y cuántos kilos son. Vacío es que
                  no se convierte: la columna queda sólo en metros.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Cada barra pesa</span>
                <Input
                  aria-label="Peso de la barra"
                  value={pesoBarra}
                  onChange={(e) => setPesoBarra(e.target.value)}
                  placeholder="4,74"
                  inputMode="decimal"
                  className="w-24"
                />
                <span className="text-muted-foreground">kg</span>
              </div>
            </div>
          ) : (
            /* La conversión a material. Está escrita como una frase y no como
               cuatro campos con etiqueta porque es una sola idea partida en
               pedazos —"cada m² rinde 15 unidades, y vienen 198 por palet"— y
               leída de corrido se entiende sin explicación.
               La aclaración de arriba da ejemplos de rubros distintos a propósito:
               esto no es una función para ladrillos, es para cualquier material
               que se mida en una unidad y se compre en otra, que en obra son casi
               todos. Con un solo ejemplo parecía hecho para mampostería. */
            <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Se compra en otra unidad
                </p>
                <p className="text-xs text-muted-foreground">
                  Para todo material que se mide de una forma y se compra de otra: la
                  pared se mide en m² y se piden ladrillos por palet, el contrapiso se
                  mide en m³ y se piden bolsas de cemento. Se carga cuánto material
                  entra en cada {info.simbolo} y, si viene agrupado, cuánto trae cada
                  bulto. Vacío es que se pide igual que se mide.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Cada {info.simbolo} rinde</span>
                <Input
                  aria-label="Rinde"
                  value={rinde}
                  onChange={(e) => setRinde(e.target.value)}
                  placeholder="15"
                  inputMode="decimal"
                  className="w-20"
                />
                <Select
                  value={rindeUnidad}
                  onValueChange={(v) => setRindeUnidad(v as UnidadComputo)}
                  items={unidadItems}
                >
                  <SelectTrigger aria-label="Unidad del material" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u} value={u}>
                        {UNIDAD_INFO[u].nombre} ({UNIDAD_INFO[u].simbolo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* El bulto sin rinde no significa nada: un palet de qué. Por eso la
                  segunda línea aparece recién cuando hay de qué contar palets. */}
              {rinde.trim() !== "" && (
                <div className="flex flex-wrap items-center gap-2 text-sm duration-200 animate-in fade-in slide-in-from-top-1">
                  <span className="text-muted-foreground">Vienen</span>
                  <Input
                    aria-label="Por bulto"
                    value={porBulto}
                    onChange={(e) => setPorBulto(e.target.value)}
                    placeholder="198"
                    inputMode="decimal"
                    className="w-24"
                  />
                  <span className="text-muted-foreground">por</span>
                  <Input
                    aria-label="Nombre del bulto"
                    value={bultoNombre}
                    onChange={(e) => setBultoNombre(e.target.value)}
                    placeholder="palet"
                    className="w-32"
                  />
                </div>
              )}

              {rinde.trim() !== "" && (
                <p className="text-xs text-muted-foreground">
                  La grilla suma una columna con el material por nivel
                  {porBulto.trim() !== "" && (
                    <>
                      , y el pie una fila con los {bultoNombre.trim() || "bultos"} que
                      hay que pedir
                    </>
                  )}
                  .{" "}
                  {desperdicio.trim() !== "" && desperdicio.trim() !== "0" && (
                    <>La cuenta arranca de lo medido con el desperdicio ya aplicado.</>
                  )}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            {item && onDeleted ? (
              <DeleteButton
                action={async () => {
                  const result = await eliminarItem(proyectoId, item.id);
                  if (!result.success) return { error: result.error };
                  return { success: true };
                }}
                confirmMessage={
                  cargadas > 0
                    ? `¿Eliminar "${item.nombre}" y lo medido en ${cargadas} ${cargadas === 1 ? "nivel" : "niveles"}?`
                    : `¿Eliminar "${item.nombre}"?`
                }
                onDeleted={() => {
                  onDeleted(item.id);
                  setOpen(false);
                  toast.success("Ítem eliminado");
                }}
              />
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
