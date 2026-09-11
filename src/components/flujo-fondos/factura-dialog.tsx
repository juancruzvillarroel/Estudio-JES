"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, Paperclip, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteButton } from "@/components/ui/delete-button";
import { NuevoProveedorDialog } from "@/components/proveedores/nuevo-proveedor-dialog";
import { createFactura, deleteFactura, updateFactura } from "@/actions/facturas";
import { obtenerCotizacionDolarBlue } from "@/actions/cotizaciones";
import { MONEDA_LABELS } from "@/lib/flujo-fondos";
import type { FacturaOpcion } from "@/lib/facturas";
import { formatMontoInicial, formatMontoWhileTyping, parseMontoTexto } from "@/lib/monto-input";
import { formatNumeroPedido } from "@/lib/utils";

type SubrubroOpcion = { id: string; nombre: string };
export type RubroFacturaOpcion = { id: string; nombre: string; subrubros: SubrubroOpcion[] };
export type ProveedorFacturaOpcion = { id: string; nombre: string; rubroIds: string[] };

/**
 * Un pedido de la obra, para poder marcar cuáles respalda la factura.
 *
 * Viaja `facturaId` para no ofrecer los que ya están cubiertos por otra: si el
 * mismo pedido colgara de dos facturas, se pagaría dos veces sin que nada lo
 * avise.
 */
export type PedidoFacturaOpcion = {
  id: string;
  numero: number;
  proveedorId: string;
  facturaId: string | null;
};

type FormValues = {
  proveedorId: string;
  numero: string;
  fecha: string;
  fechaVencimiento: string;
  moneda: "ARS" | "USD";
  tipoCambio: string;
  rubroId: string;
  subrubroId: string;
  notas: string;
  pedidoIds: string[];
};

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function valoresPorDefecto(
  item: FacturaOpcion | undefined,
  pedidoInicial: PedidoFacturaOpcion | undefined
): FormValues {
  return {
    proveedorId: item?.proveedorId ?? pedidoInicial?.proveedorId ?? "",
    numero: item?.numero ?? "",
    fecha: item?.fecha ?? hoyISO(),
    fechaVencimiento: item?.fechaVencimiento ?? "",
    moneda: item?.moneda ?? "ARS",
    tipoCambio: item?.tipoCambio ? String(item.tipoCambio) : "",
    rubroId: item?.rubroId ?? "",
    subrubroId: item?.subrubroId ?? "",
    notas: item?.notas ?? "",
    pedidoIds: item ? item.pedidos.map((p) => p.id) : pedidoInicial ? [pedidoInicial.id] : [],
  };
}

/**
 * Alta y edición de una factura de proveedor.
 *
 * El formulario se maneja con estado propio y no con react-hook-form porque
 * casi todos los campos son reactivos entre sí —el rubro filtra los
 * proveedores, el proveedor filtra los pedidos, la moneda decide si hace falta
 * el tipo de cambio— y en ese caso el formulario controlado a mano es más
 * corto que la misma pantalla llena de `Controller`.
 *
 * Se abre desde dos lados: desde la solapa Facturas (sin pedido) y desde la
 * pantalla de un pedido (con `pedidoInicial`, que llega ya marcado).
 */
export function FacturaDialog({
  proyectoId,
  rubros,
  proveedores,
  pedidos,
  item,
  pedidoInicial,
  abrirAlMontar,
  trigger,
  onSaved,
  onDeleted,
}: {
  proyectoId: string;
  rubros: RubroFacturaOpcion[];
  proveedores: ProveedorFacturaOpcion[];
  pedidos: PedidoFacturaOpcion[];
  item?: FacturaOpcion;
  pedidoInicial?: PedidoFacturaOpcion;
  /**
   * Abre el diálogo apenas se monta, sin esperar el click en el trigger.
   *
   * Lo usa el pedido recién creado cuando se pidió cargarle la factura: el
   * pedido tiene que existir antes de poder colgarle una, así que la carga
   * "en el mismo momento" es, en los hechos, guardar el pedido y encontrarse
   * el formulario de la factura abierto.
   */
  abrirAlMontar?: boolean;
  trigger: React.ReactNode;
  onSaved?: (factura: FacturaOpcion) => void;
  onDeleted?: (id: string) => void;
}) {
  const [open, setOpen] = useState(abrirAlMontar ?? false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormValues>(() => valoresPorDefecto(item, pedidoInicial));
  const [montoTexto, setMontoTexto] = useState(() => formatMontoInicial(item?.monto ?? 0));
  const [proveedoresCreados, setProveedoresCreados] = useState<ProveedorFacturaOpcion[]>([]);
  const [archivoNuevo, setArchivoNuevo] = useState<File | null>(null);
  const [quitarArchivo, setQuitarArchivo] = useState(false);
  // La cotización se guarda junto con la fecha para la que se pidió. Así el
  // texto que se muestra y el "buscando…" salen de comparar esa clave con la
  // fecha actual, en vez de tener que blanquearlos a mano desde el efecto: los
  // setState sincrónicos dentro de un efecto encadenan renders y el compilador
  // de React los rechaza.
  const [cotizacion, setCotizacion] = useState<{ clave: string; texto: string } | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const inputCamaraRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormValues>(campo: K, valor: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const subrubrosDelRubro = rubros.find((r) => r.id === form.rubroId)?.subrubros ?? [];
  const rubroItems = Object.fromEntries(rubros.map((r) => [r.id, r.nombre]));
  const subrubroItems = Object.fromEntries([
    ["", "Sin subrubro"],
    ...subrubrosDelRubro.map((s) => [s.id, s.nombre]),
  ]);

  // Igual que en el diálogo de gastos: se ofrecen los proveedores del rubro
  // elegido, más el que ya estuviera seleccionado por si el rubro cambió
  // después de cargar la factura.
  const proveedorItems = [...proveedores, ...proveedoresCreados]
    .filter((p) => p.rubroIds.includes(form.rubroId) || p.id === form.proveedorId)
    .map((p) => ({ value: p.id, label: p.nombre }));

  // Los pedidos que se pueden vincular: los del proveedor elegido que todavía
  // no tienen factura, más los que ya son de esta (para poder destildarlos).
  const pedidosDisponibles = pedidos
    .filter(
      (p) =>
        p.proveedorId === form.proveedorId &&
        (p.facturaId === null || p.facturaId === item?.id || form.pedidoIds.includes(p.id))
    )
    .sort((a, b) => b.numero - a.numero);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setForm(valoresPorDefecto(item, pedidoInicial));
      setMontoTexto(formatMontoInicial(item?.monto ?? 0));
      setError(undefined);
      setArchivoNuevo(null);
      setQuitarArchivo(false);
      if (inputArchivoRef.current) inputArchivoRef.current.value = "";
      if (inputCamaraRef.current) inputCamaraRef.current.value = "";
    }
  };

  // Autocompleta el tipo de cambio con el dólar blue de la fecha de la factura,
  // igual que en el diálogo de gastos. Se puede pisar a mano después: solo
  // vuelve a buscar si cambia la fecha o la moneda.
  const { fecha, moneda } = form;
  const claveCotizacion = `${moneda}|${fecha}`;
  const cotizacionInfo = cotizacion?.clave === claveCotizacion ? cotizacion.texto : undefined;
  const cotizando = moneda === "ARS" && !!fecha && !cotizacionInfo;

  useEffect(() => {
    if (!open || moneda !== "ARS" || !fecha) return;
    let cancelado = false;
    obtenerCotizacionDolarBlue(fecha).then((cot) => {
      if (cancelado) return;
      if (cot) {
        setForm((prev) => ({ ...prev, tipoCambio: String(cot.venta) }));
        setCotizacion({
          clave: `ARS|${fecha}`,
          texto: `Dólar blue (venta) del ${fecha.split("-").reverse().join("/")}: $${cot.venta}`,
        });
      } else {
        setCotizacion({
          clave: `ARS|${fecha}`,
          texto: "No se encontró la cotización de esa fecha. Ingresá el tipo de cambio a mano.",
        });
      }
    });
    return () => {
      cancelado = true;
    };
  }, [open, moneda, fecha]);

  const handleProveedorCreado = (proveedor: { id: string; nombre: string; codigo: string }) => {
    setProveedoresCreados((prev) => [
      ...prev,
      { id: proveedor.id, nombre: proveedor.nombre, rubroIds: form.rubroId ? [form.rubroId] : [] },
    ]);
    set("proveedorId", proveedor.id);
  };

  /**
   * Cambiar de rubro solo suelta al proveedor si el que estaba elegido no
   * trabaja el rubro nuevo —ahí desaparece de la lista y dejarlo seleccionado
   * guardaría una factura de un proveedor que no se ve en pantalla—. Si sigue
   * siendo válido se queda, junto con los pedidos marcados: cuando la factura
   * se carga desde un pedido, el proveedor ya viene puesto y volver a elegirlo
   * después de tocar el rubro es trabajo al pedo.
   */
  const cambiarRubro = (rubroId: string) => {
    const proveedor = [...proveedores, ...proveedoresCreados].find(
      (p) => p.id === form.proveedorId
    );
    const sigueSirviendo = proveedor?.rubroIds.includes(rubroId) ?? false;
    setForm((prev) => ({
      ...prev,
      rubroId,
      subrubroId: "",
      proveedorId: sigueSirviendo ? prev.proveedorId : "",
      pedidoIds: sigueSirviendo ? prev.pedidoIds : [],
    }));
  };

  const togglePedido = (pedidoId: string) => {
    setForm((prev) => ({
      ...prev,
      pedidoIds: prev.pedidoIds.includes(pedidoId)
        ? prev.pedidoIds.filter((id) => id !== pedidoId)
        : [...prev.pedidoIds, pedidoId],
    }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    const monto = parseMontoTexto(montoTexto);
    if (!monto || monto <= 0) {
      setError("Ingresá un monto válido.");
      return;
    }
    if (!form.rubroId) {
      setError("Elegí un rubro.");
      return;
    }
    if (!form.proveedorId) {
      setError("Elegí un proveedor.");
      return;
    }
    if (!form.numero.trim()) {
      setError("Ingresá el número de factura.");
      return;
    }
    if (form.fechaVencimiento && form.fechaVencimiento < form.fecha) {
      setError("El vencimiento no puede ser anterior a la fecha de la factura.");
      return;
    }

    const tipoCambio = form.tipoCambio ? Number(form.tipoCambio) : undefined;
    const input = {
      proyectoId,
      proveedorId: form.proveedorId,
      numero: form.numero.trim(),
      fecha: form.fecha,
      fechaVencimiento: form.fechaVencimiento || undefined,
      monto,
      moneda: form.moneda,
      tipoCambio: tipoCambio && tipoCambio > 0 ? tipoCambio : undefined,
      rubroId: form.rubroId,
      subrubroId: form.subrubroId || undefined,
      notas: form.notas || undefined,
      pedidoIds: form.pedidoIds,
    };

    startTransition(async () => {
      const result = item
        ? await updateFactura(item.id, input, archivoNuevo ?? undefined, quitarArchivo)
        : await createFactura(input, archivoNuevo ?? undefined);

      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved?.(result.factura);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      {/* El diálogo por defecto mide 384px y adentro hay filas de dos y tres
          campos: a ese ancho las etiquetas se cortan y los selects se pisan.
          Con `sm:max-w-2xl` cada columna queda con unos 200px, que es lo que
          necesita el tipo de cambio. El alto se limita porque el formulario es
          largo y en un notebook no entra entero. */}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Editar factura" : "Nueva factura"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="factura-fecha">Fecha de la factura</Label>
              <Input
                id="factura-fecha"
                type="date"
                value={form.fecha}
                onChange={(e) => set("fecha", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="factura-vencimiento">Vencimiento (opcional)</Label>
              <Input
                id="factura-vencimiento"
                type="date"
                value={form.fechaVencimiento}
                onChange={(e) => set("fechaVencimiento", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="factura-rubroId">Rubro</Label>
              <Select
                value={form.rubroId}
                onValueChange={(value) => cambiarRubro(String(value))}
                items={rubroItems}
              >
                <SelectTrigger id="factura-rubroId" className="w-full">
                  <SelectValue placeholder="Elegí un rubro" />
                </SelectTrigger>
                <SelectContent>
                  {rubros.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="factura-subrubroId">Subrubro</Label>
              <Select
                value={form.subrubroId}
                onValueChange={(value) => set("subrubroId", String(value))}
                disabled={subrubrosDelRubro.length === 0}
                items={subrubroItems}
              >
                <SelectTrigger id="factura-subrubroId" className="w-full">
                  <SelectValue
                    placeholder={subrubrosDelRubro.length ? "Sin subrubro" : "Sin subrubros"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin subrubro</SelectItem>
                  {subrubrosDelRubro.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="factura-proveedorId">Proveedor</Label>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Combobox
                    id="factura-proveedorId"
                    value={form.proveedorId}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, proveedorId: value, pedidoIds: [] }))
                    }
                    items={proveedorItems}
                    disabled={!form.rubroId}
                    placeholder={form.rubroId ? "Buscá un proveedor" : "Elegí un rubro primero"}
                  />
                </div>
                <NuevoProveedorDialog
                  rubroId={form.rubroId}
                  onCreated={handleProveedorCreado}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Nuevo proveedor"
                      disabled={!form.rubroId}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="factura-numero">Número de factura</Label>
              <Input
                id="factura-numero"
                placeholder="A-0001-00012345"
                value={form.numero}
                onChange={(e) => set("numero", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="factura-monto">Monto total</Label>
              <Input
                id="factura-monto"
                inputMode="decimal"
                placeholder="—"
                value={montoTexto}
                onChange={(e) => setMontoTexto(formatMontoWhileTyping(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="factura-moneda">Moneda</Label>
              <Select
                value={form.moneda}
                onValueChange={(value) => set("moneda", value as "ARS" | "USD")}
                items={MONEDA_LABELS}
              >
                <SelectTrigger id="factura-moneda" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MONEDA_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="factura-tipoCambio">Tipo de cambio</Label>
              <Input
                id="factura-tipoCambio"
                type="number"
                step="0.01"
                min="0"
                placeholder="—"
                value={form.tipoCambio}
                onChange={(e) => set("tipoCambio", e.target.value)}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {/* El monto va a mano porque los precios del pedido no traen ni el
                IVA ni los descuentos que termina teniendo el papel. */}
            El total tal como figura en la factura, con IVA y descuentos ya aplicados.
            {form.moneda === "ARS" &&
              (cotizando
                ? " Buscando la cotización del dólar blue para esa fecha…"
                : cotizacionInfo
                  ? ` ${cotizacionInfo}`
                  : " El tipo de cambio es lo que permite ver la deuda en dólares.")}
          </p>

          {form.proveedorId && (
            <div className="flex flex-col gap-2">
              <Label>Pedidos que respalda (opcional)</Label>
              {pedidosDisponibles.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Este proveedor no tiene pedidos sin factura en la obra. La factura se guarda
                  igual: no todas salen de un pedido.
                </p>
              ) : (
                <div className="flex flex-col gap-2 rounded-md border p-3">
                  {pedidosDisponibles.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.pedidoIds.includes(p.id)}
                        onCheckedChange={() => togglePedido(p.id)}
                      />
                      Pedido #{formatNumeroPedido(p.numero)}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="factura-notas">Notas (opcional)</Label>
            <Textarea
              id="factura-notas"
              rows={2}
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Archivo de la factura</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Adjuntar archivo"
                onClick={() => inputArchivoRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Sacar foto"
                onClick={() => inputCamaraRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
              </Button>
              <input
                ref={inputArchivoRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  setArchivoNuevo(e.target.files?.[0] ?? null);
                  setQuitarArchivo(false);
                }}
              />
              <input
                ref={inputCamaraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  setArchivoNuevo(e.target.files?.[0] ?? null);
                  setQuitarArchivo(false);
                }}
              />
            </div>
            {archivoNuevo ? (
              <div className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span className="truncate">{archivoNuevo.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Quitar archivo"
                  onClick={() => {
                    setArchivoNuevo(null);
                    if (inputArchivoRef.current) inputArchivoRef.current.value = "";
                    if (inputCamaraRef.current) inputCamaraRef.current.value = "";
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : item?.archivoUrl && !quitarArchivo ? (
              <div className="flex items-center justify-between rounded-md border p-2 text-sm">
                <a
                  href={item.archivoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate underline"
                >
                  Ver factura actual
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Quitar archivo"
                  onClick={() => setQuitarArchivo(true)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            {item ? (
              <DeleteButton
                action={() => deleteFactura(item.id)}
                confirmMessage={
                  item.pagos.length > 0
                    ? "Esta factura ya tiene pagos cargados. Si la borrás, los pagos quedan como gastos sueltos. ¿Seguir?"
                    : "¿Eliminar esta factura? Esta acción no se puede deshacer."
                }
                onDeleted={() => {
                  setOpen(false);
                  onDeleted?.(item.id);
                }}
              />
            ) : (
              <div />
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
