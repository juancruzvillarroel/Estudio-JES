"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { Camera, Paperclip, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  createMovimientoFondo,
  deleteMovimientoFondo,
  updateMovimientoFondo,
} from "@/actions/movimientos-fondo";
import { obtenerCotizacionDolarBlue } from "@/actions/cotizaciones";
import { MONEDA_LABELS, type MedioPagoOpcion, type MovimientoFondoOpcion } from "@/lib/flujo-fondos";
import type { SugerenciaHonorarios } from "@/lib/honorarios";
import { formatMontoMoneda } from "@/lib/utils";
import type { MovimientoFondoInput } from "@/lib/validations/movimiento-fondo";

type SubrubroOpcion = { id: string; nombre: string };
type RubroOpcion = { id: string; nombre: string; subrubros: SubrubroOpcion[] };
type ProyectoInversorOpcion = { id: string; inversorNombre: string };
type ProveedorOpcion = { id: string; nombre: string; rubroIds: string[] };

type FormValues = {
  fecha: string;
  descripcion: string;
  monto: number;
  moneda: "ARS" | "USD";
  tipoCambio: number | undefined;
  rubroId: string;
  subrubroId: string;
  proveedorId: string;
  proyectoInversorId: string;
  medioPagoId: string;
};

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// Formatea lo que se va escribiendo en el campo Monto como moneda argentina
// (punto de miles, coma decimal) sin perder la coma mientras se sigue
// tipeando los decimales.
function formatMontoWhileTyping(raw: string): string {
  let limpio = raw.replace(/[^0-9,]/g, "");
  const primeraComa = limpio.indexOf(",");
  if (primeraComa !== -1) {
    limpio = limpio.slice(0, primeraComa + 1) + limpio.slice(primeraComa + 1).replace(/,/g, "");
  }
  const [parteEntera, parteDecimal] = limpio.split(",");
  const enteroFormateado = parteEntera ? Number(parteEntera).toLocaleString("es-AR") : "";
  if (parteDecimal !== undefined) {
    return `${enteroFormateado},${parteDecimal.slice(0, 2)}`;
  }
  return enteroFormateado;
}

function parseMontoTexto(texto: string): number {
  const limpio = texto.replace(/\./g, "").replace(",", ".");
  const numero = Number(limpio);
  return Number.isNaN(numero) ? 0 : numero;
}

function formatMontoInicial(monto: number): string {
  if (!monto) return "";
  return monto.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function valoresPorDefecto(item?: MovimientoFondoOpcion): FormValues {
  return {
    fecha: item ? item.fecha.slice(0, 10) : hoyISO(),
    descripcion: item?.descripcion ?? "",
    monto: item?.monto ?? 0,
    moneda: item?.moneda ?? "ARS",
    tipoCambio: item?.tipoCambio ?? undefined,
    rubroId: item?.rubroId ?? "",
    subrubroId: item?.subrubroId ?? "",
    proveedorId: item?.proveedorId ?? "",
    proyectoInversorId: item?.proyectoInversorId ?? "",
    medioPagoId: item?.medioPagoId ?? "",
  };
}

export function MovimientoFondoDialog({
  proyectoId,
  rubros,
  proveedores,
  proyectoInversores,
  mediosPago,
  sugerenciaHonorarios,
  item,
  defaultTipo,
  trigger,
  onSaved,
  onDeleted,
}: {
  proyectoId: string;
  rubros: RubroOpcion[];
  proveedores: ProveedorOpcion[];
  proyectoInversores: ProyectoInversorOpcion[];
  mediosPago: MedioPagoOpcion[];
  /**
   * Montos que propone la calculadora de honorarios, uno por moneda (ver
   * src/lib/honorarios.ts). Solo aparecen al elegir el rubro de honorarios en
   * un gasto nuevo, y se aplican con un click: nunca pisan lo que se haya
   * escrito a mano.
   */
  sugerenciaHonorarios?: SugerenciaHonorarios[] | null;
  item?: MovimientoFondoOpcion;
  defaultTipo?: "GASTO" | "APORTE";
  trigger: React.ReactNode;
  onSaved: (movimiento: MovimientoFondoOpcion) => void;
  onDeleted?: (id: string) => void;
}) {
  const tipo = item?.tipo ?? defaultTipo ?? "GASTO";

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [cotizando, setCotizando] = useState(false);
  const [cotizacionInfo, setCotizacionInfo] = useState<string | undefined>();
  const [proveedoresCreados, setProveedoresCreados] = useState<ProveedorOpcion[]>([]);
  const [archivoNuevo, setArchivoNuevo] = useState<File | null>(null);
  const [quitarArchivo, setQuitarArchivo] = useState(false);
  const [montoTexto, setMontoTexto] = useState(() => formatMontoInicial(item?.monto ?? 0));
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const inputCamaraRef = useRef<HTMLInputElement>(null);

  const { control, register, handleSubmit, watch, reset, setValue } = useForm<FormValues>({
    defaultValues: valoresPorDefecto(item),
  });

  const moneda = watch("moneda");
  const fecha = watch("fecha");
  const rubroId = watch("rubroId");
  const proveedorIdActual = watch("proveedorId");
  const subrubrosDelRubro = rubros.find((r) => r.id === rubroId)?.subrubros ?? [];

  const rubroItems = Object.fromEntries(rubros.map((r) => [r.id, r.nombre]));
  const subrubroItems = Object.fromEntries([
    ["", "Sin subrubro"],
    ...subrubrosDelRubro.map((s) => [s.id, s.nombre]),
  ]);
  const medioPagoItems = Object.fromEntries([
    ["", "Sin especificar"],
    ...mediosPago.map((mp) => [mp.id, mp.nombre]),
  ]);
  // Solo se muestran los proveedores cargados para el rubro elegido (más el
  // que ya estuviera seleccionado, por si el gasto se editó y el rubro
  // cambió después).
  const proveedorComboItems = [...proveedores, ...proveedoresCreados]
    .filter((p) => p.rubroIds.includes(rubroId) || p.id === proveedorIdActual)
    .map((p) => ({
      value: p.id,
      label: p.nombre,
    }));
  const inversorItems = Object.fromEntries(proyectoInversores.map((pi) => [pi.id, pi.inversorNombre]));

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      reset(valoresPorDefecto(item));
      setError(undefined);
      setCotizacionInfo(undefined);
      setArchivoNuevo(null);
      setQuitarArchivo(false);
      setMontoTexto(formatMontoInicial(item?.monto ?? 0));
      if (inputArchivoRef.current) inputArchivoRef.current.value = "";
      if (inputCamaraRef.current) inputCamaraRef.current.value = "";
    }
  };

  // La calculadora propone el monto solo al cargar un honorario nuevo. En una
  // edición no aparece: el período ya se cerró con ese mismo gasto adentro, así
  // que la cuenta que corresponde es la que se guardó, no la de hoy.
  //
  // Hay una sugerencia por moneda, porque los gastos en pesos y en dólares se
  // liquidan por separado. Se muestra la de la moneda elegida en el formulario:
  // así, si la obra gastó en las dos, se cargan dos honorarios cambiando la
  // moneda y aplicando la sugerencia que aparece en cada caso.
  const sugerencia =
    !item && tipo === "GASTO" && sugerenciaHonorarios
      ? (sugerenciaHonorarios.find((s) => s.rubroId === rubroId && s.moneda === moneda) ?? null)
      : null;

  const aplicarSugerencia = () => {
    if (!sugerencia) return;
    setMontoTexto(formatMontoInicial(sugerencia.monto));
    setValue("monto", sugerencia.monto, { shouldValidate: true });
  };

  const handleProveedorCreado = (proveedor: { id: string; nombre: string; codigo: string }) => {
    setProveedoresCreados((prev) => [
      ...prev,
      { id: proveedor.id, nombre: proveedor.nombre, rubroIds: rubroId ? [rubroId] : [] },
    ]);
    setValue("proveedorId", proveedor.id);
  };

  // Autocompleta el tipo de cambio con la cotización del dólar blue de la
  // fecha del gasto, para no tener que buscarla e ingresarla a mano. Se
  // puede sobrescribir a mano después: solo se vuelve a buscar si cambia la
  // fecha o la moneda.
  useEffect(() => {
    if (!open || tipo !== "GASTO" || moneda !== "ARS" || !fecha) {
      setCotizacionInfo(undefined);
      return;
    }
    let cancelado = false;
    setCotizando(true);
    setCotizacionInfo(undefined);
    obtenerCotizacionDolarBlue(fecha).then((cot) => {
      if (cancelado) return;
      setCotizando(false);
      if (cot) {
        setValue("tipoCambio", cot.venta);
        setCotizacionInfo(`Dólar blue (venta) del ${fecha.split("-").reverse().join("/")}: $${cot.venta}`);
      } else {
        setCotizacionInfo("No se encontró la cotización de esa fecha. Ingresá el tipo de cambio a mano.");
      }
    });
    return () => {
      cancelado = true;
    };
  }, [open, tipo, moneda, fecha, setValue]);

  const onSubmit = (data: FormValues) => {
    setError(undefined);

    if (!data.monto || data.monto <= 0) {
      setError("Ingresá un monto válido.");
      return;
    }

    let input: MovimientoFondoInput;
    if (tipo === "GASTO") {
      if (!data.rubroId) {
        setError("Elegí un rubro.");
        return;
      }
      input = {
        tipo: "GASTO",
        proyectoId,
        fecha: data.fecha,
        descripcion: data.descripcion,
        monto: Number(data.monto),
        moneda: data.moneda,
        tipoCambio: data.tipoCambio ? Number(data.tipoCambio) : undefined,
        rubroId: data.rubroId,
        subrubroId: data.subrubroId || undefined,
        proveedorId: data.proveedorId || undefined,
        medioPagoId: data.medioPagoId || undefined,
      };
    } else {
      if (!data.proyectoInversorId) {
        setError("Elegí un inversor.");
        return;
      }
      input = {
        tipo: "APORTE",
        proyectoId,
        fecha: data.fecha,
        descripcion: data.descripcion,
        monto: Number(data.monto),
        moneda: data.moneda,
        tipoCambio: data.tipoCambio ? Number(data.tipoCambio) : undefined,
        proyectoInversorId: data.proyectoInversorId,
      };
    }

    startTransition(async () => {
      const result = item
        ? await updateMovimientoFondo(item.id, input, archivoNuevo ?? undefined, quitarArchivo)
        : await createMovimientoFondo(input, archivoNuevo ?? undefined);

      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved(result.movimiento);
      setOpen(false);
      reset();
      setArchivoNuevo(null);
      setQuitarArchivo(false);
      setMontoTexto("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item ? "Editar movimiento" : tipo === "APORTE" ? "Nuevo aporte" : "Nuevo gasto"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" type="date" {...register("fecha", { required: true })} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Input id="descripcion" {...register("descripcion")} />
          </div>

          {tipo === "GASTO" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rubroId">Rubro</Label>
                <Controller
                  control={control}
                  name="rubroId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setValue("proveedorId", "");
                      }}
                      items={rubroItems}
                    >
                      <SelectTrigger id="rubroId" className="w-full">
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
                  )}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="subrubroId">Subrubro</Label>
                <Controller
                  control={control}
                  name="subrubroId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={subrubrosDelRubro.length === 0}
                      items={subrubroItems}
                    >
                      <SelectTrigger id="subrubroId" className="w-full">
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
                  )}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="proveedorId">Proveedor</Label>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <Controller
                      control={control}
                      name="proveedorId"
                      render={({ field }) => (
                        <Combobox
                          id="proveedorId"
                          value={field.value}
                          onValueChange={field.onChange}
                          items={proveedorComboItems}
                          disabled={!rubroId}
                          placeholder={
                            rubroId ? "Buscá un proveedor (opcional)" : "Elegí un rubro primero"
                          }
                        />
                      )}
                    />
                  </div>
                  <NuevoProveedorDialog
                    rubroId={rubroId}
                    onCreated={handleProveedorCreado}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Nuevo proveedor"
                        disabled={!rubroId}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>
                {!rubroId && (
                  <p className="text-xs text-muted-foreground">Elegí un rubro para poder agregar un proveedor nuevo.</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="medioPagoId">Medio de pago</Label>
                {mediosPago.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Todavía no hay medios de pago cargados en este proyecto. Cargalos en
                    &quot;Datos del proyecto&quot;.
                  </p>
                ) : (
                  <Controller
                    control={control}
                    name="medioPagoId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} items={medioPagoItems}>
                        <SelectTrigger id="medioPagoId" className="w-full">
                          <SelectValue placeholder="Sin especificar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Sin especificar</SelectItem>
                          {mediosPago.map((mp) => (
                            <SelectItem key={mp.id} value={mp.id}>
                              {mp.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Comprobante</Label>
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
              </div>
              {archivoNuevo ? (
                <div className="flex items-center justify-between rounded-md border p-2 text-sm sm:col-span-2">
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
                <div className="flex items-center justify-between rounded-md border p-2 text-sm sm:col-span-2">
                  <a
                    href={item.archivoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate underline"
                  >
                    Ver comprobante actual
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
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="proyectoInversorId">Inversor</Label>
              {proyectoInversores.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Todavía no hay inversores asignados a este proyecto. Asigná uno en
                  &quot;Datos del proyecto&quot;.
                </p>
              ) : (
                <Controller
                  control={control}
                  name="proyectoInversorId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} items={inversorItems}>
                      <SelectTrigger id="proyectoInversorId" className="w-full">
                        <SelectValue placeholder="Elegí un inversor" />
                      </SelectTrigger>
                      <SelectContent>
                        {proyectoInversores.map((pi) => (
                          <SelectItem key={pi.id} value={pi.id}>
                            {pi.inversorNombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="monto">Monto</Label>
              <Input
                id="monto"
                inputMode="decimal"
                placeholder="0"
                value={montoTexto}
                onChange={(e) => {
                  const formateado = formatMontoWhileTyping(e.target.value);
                  setMontoTexto(formateado);
                  setValue("monto", parseMontoTexto(formateado), { shouldValidate: true });
                }}
              />
              {sugerencia && (
                <button
                  type="button"
                  onClick={aplicarSugerencia}
                  className="text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Usar{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatMontoMoneda(sugerencia.monto, sugerencia.moneda)}
                  </span>
                  : {sugerencia.porcentaje.toLocaleString("es-AR", { maximumFractionDigits: 2 })}% de
                  los gastos en {sugerencia.moneda === "ARS" ? "pesos" : "dólares"} desde el último
                  honorario.
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="moneda">Moneda</Label>
              <Controller
                control={control}
                name="moneda"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} items={MONEDA_LABELS}>
                    <SelectTrigger id="moneda" className="w-full">
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
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tipoCambio">Tipo de cambio</Label>
              <Input
                id="tipoCambio"
                type="number"
                step="0.01"
                min="0"
                placeholder="Opcional"
                {...register("tipoCambio", { valueAsNumber: true })}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {tipo === "GASTO" && moneda === "ARS"
              ? cotizando
                ? "Buscando la cotización del dólar blue para esa fecha…"
                : (cotizacionInfo ??
                  "Cotización del día del movimiento, para poder ver el equivalente en dólares.")
              : "Cotización del día del movimiento, para poder ver el equivalente en la otra moneda en el resumen."}
          </p>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            {item ? (
              <DeleteButton
                action={() => deleteMovimientoFondo(item.id)}
                confirmMessage="¿Eliminar este movimiento? Esta acción no se puede deshacer."
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
