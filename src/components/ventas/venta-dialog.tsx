"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createVenta, deleteVenta, updateVenta } from "@/actions/ventas";
import { MONEDA_LABELS, type MedioPagoOpcion, type UnidadProyectoOpcion } from "@/lib/flujo-fondos";
import type { VentaOpcion } from "@/lib/ventas";

const MODALIDAD_LABELS = { CONTADO: "Contado", FINANCIADO: "Con anticipo y cuotas" };

type CuotaForm = {
  id?: string;
  numero: number;
  esAnticipo: boolean;
  fecha: string;
  monto: number;
  cobrada: boolean;
  fechaCobro: string | null;
};

type FormValues = {
  unidadId: string;
  compradorNombre: string;
  fecha: string;
  moneda: "ARS" | "USD";
  precioTotal: number;
  modalidad: "CONTADO" | "FINANCIADO";
  anticipo: number;
  cantidadCuotas: number;
  medioPagoId: string;
  notas: string;
};

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function sumarMeses(fechaISO: string, meses: number) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1 + meses, dia));
  return d.toISOString().slice(0, 10);
}

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

/** Genera la grilla de cuotas por defecto: iguales y con vencimiento mensual. */
function generarCuotas(precioTotal: number, modalidad: "CONTADO" | "FINANCIADO", anticipo: number, cantidadCuotas: number, fecha: string): CuotaForm[] {
  if (modalidad === "CONTADO") {
    return [{ numero: 1, esAnticipo: false, fecha, monto: precioTotal || 0, cobrada: false, fechaCobro: null }];
  }

  const cuotas: CuotaForm[] = [];
  const anticipoNum = anticipo || 0;
  if (anticipoNum > 0) {
    cuotas.push({ numero: 0, esAnticipo: true, fecha, monto: anticipoNum, cobrada: false, fechaCobro: null });
  }

  const n = Math.max(1, Math.floor(cantidadCuotas || 1));
  const montoFinanciado = Math.max(0, (precioTotal || 0) - anticipoNum);
  const montoBase = Math.floor((montoFinanciado / n) * 100) / 100;
  const diferencia = Math.round((montoFinanciado - montoBase * n) * 100) / 100;

  for (let i = 1; i <= n; i++) {
    const monto = i === n ? Math.round((montoBase + diferencia) * 100) / 100 : montoBase;
    cuotas.push({
      numero: i,
      esAnticipo: false,
      fecha: sumarMeses(fecha, i),
      monto,
      cobrada: false,
      fechaCobro: null,
    });
  }

  return cuotas;
}

function valoresPorDefecto(item?: VentaOpcion): FormValues {
  return {
    unidadId: item?.unidadId ?? "",
    compradorNombre: item?.compradorNombre ?? "",
    fecha: item ? item.fecha.slice(0, 10) : hoyISO(),
    moneda: item?.moneda ?? "ARS",
    precioTotal: item?.precioTotal ?? 0,
    modalidad: item?.modalidad ?? "FINANCIADO",
    anticipo: item?.cuotas.find((c) => c.esAnticipo)?.monto ?? 0,
    cantidadCuotas: item ? item.cuotas.filter((c) => !c.esAnticipo).length || 1 : 6,
    medioPagoId: item?.medioPagoId ?? "",
    notas: item?.notas ?? "",
  };
}

function cuotasIniciales(item?: VentaOpcion): CuotaForm[] {
  if (!item) return [];
  return item.cuotas.map((c) => ({
    id: c.id,
    numero: c.numero,
    esAnticipo: c.esAnticipo,
    fecha: c.fecha.slice(0, 10),
    monto: c.monto,
    cobrada: c.cobrada,
    fechaCobro: c.fechaCobro,
  }));
}

export function VentaDialog({
  proyectoId,
  unidades,
  mediosPago,
  item,
  trigger,
  onSaved,
  onDeleted,
}: {
  proyectoId: string;
  unidades: UnidadProyectoOpcion[];
  mediosPago: MedioPagoOpcion[];
  item?: VentaOpcion;
  trigger: React.ReactNode;
  onSaved: (venta: VentaOpcion) => void;
  onDeleted?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [precioTexto, setPrecioTexto] = useState(() => formatMontoInicial(item?.precioTotal ?? 0));
  const [anticipoTexto, setAnticipoTexto] = useState(() =>
    formatMontoInicial(item?.cuotas.find((c) => c.esAnticipo)?.monto ?? 0)
  );
  const [cuotas, setCuotas] = useState<CuotaForm[]>(() => cuotasIniciales(item));
  const [cuotasDirty, setCuotasDirty] = useState(!!item);

  const { control, register, handleSubmit, watch, reset, setValue } = useForm<FormValues>({
    defaultValues: valoresPorDefecto(item),
  });

  const modalidad = watch("modalidad");
  const precioTotal = watch("precioTotal");
  const anticipo = watch("anticipo");
  const cantidadCuotas = watch("cantidadCuotas");
  const fecha = watch("fecha");
  const moneda = watch("moneda");

  const unidadesDisponibles = item
    ? unidades
    : unidades.filter((u) => u.estado === "DISPONIBLE");

  const unidadItems = Object.fromEntries(unidadesDisponibles.map((u) => [u.id, u.nombre]));
  const medioPagoItems = Object.fromEntries([
    ["", "Sin especificar"],
    ...mediosPago.map((mp) => [mp.id, mp.nombre]),
  ]);

  // Recalcula la grilla automáticamente mientras el usuario no la haya
  // tocado a mano (o mientras no esté editando una venta ya cargada).
  useEffect(() => {
    if (cuotasDirty) return;
    setCuotas(generarCuotas(precioTotal, modalidad, anticipo, cantidadCuotas, fecha));
  }, [cuotasDirty, precioTotal, modalidad, anticipo, cantidadCuotas, fecha]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      reset(valoresPorDefecto(item));
      setError(undefined);
      setPrecioTexto(formatMontoInicial(item?.precioTotal ?? 0));
      setAnticipoTexto(formatMontoInicial(item?.cuotas.find((c) => c.esAnticipo)?.monto ?? 0));
      setCuotas(cuotasIniciales(item));
      setCuotasDirty(!!item);
    }
  };

  const handleRecalcular = () => {
    setCuotasDirty(false);
    setCuotas(generarCuotas(precioTotal, modalidad, anticipo, cantidadCuotas, fecha));
  };

  const handleCuotaChange = (index: number, campo: "fecha" | "monto", valor: string) => {
    setCuotasDirty(true);
    setCuotas((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, [campo]: campo === "monto" ? Number(valor) || 0 : valor } : c
      )
    );
  };

  const handleAgregarCuota = () => {
    setCuotasDirty(true);
    setCuotas((prev) => {
      const maxNumero = Math.max(0, ...prev.filter((c) => !c.esAnticipo).map((c) => c.numero));
      const ultimaFecha = prev.length > 0 ? prev[prev.length - 1].fecha : fecha;
      return [
        ...prev,
        {
          numero: maxNumero + 1,
          esAnticipo: false,
          fecha: sumarMeses(ultimaFecha, 1),
          monto: 0,
          cobrada: false,
          fechaCobro: null,
        },
      ];
    });
  };

  const handleQuitarCuota = (index: number) => {
    setCuotasDirty(true);
    setCuotas((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = (data: FormValues) => {
    setError(undefined);

    if (!data.unidadId) {
      setError("Elegí una unidad.");
      return;
    }
    if (!data.precioTotal || data.precioTotal <= 0) {
      setError("Ingresá un precio total válido.");
      return;
    }
    if (cuotas.length === 0) {
      setError("Agregá al menos un pago (anticipo o cuota).");
      return;
    }
    if (cuotas.some((c) => !c.monto || c.monto <= 0)) {
      setError("Todos los pagos deben tener un monto mayor a 0.");
      return;
    }

    const cuotasInput = cuotas.map((c) => ({
      id: c.id,
      numero: c.numero,
      esAnticipo: c.esAnticipo,
      fecha: c.fecha,
      monto: c.monto,
    }));

    startTransition(async () => {
      const result = item
        ? await updateVenta(item.id, {
            compradorNombre: data.compradorNombre,
            fecha: data.fecha,
            moneda: data.moneda,
            precioTotal: data.precioTotal,
            modalidad: data.modalidad,
            medioPagoId: data.medioPagoId || undefined,
            notas: data.notas,
            cuotas: cuotasInput,
          })
        : await createVenta({
            proyectoId,
            unidadId: data.unidadId,
            compradorNombre: data.compradorNombre,
            fecha: data.fecha,
            moneda: data.moneda,
            precioTotal: data.precioTotal,
            modalidad: data.modalidad,
            medioPagoId: data.medioPagoId || undefined,
            notas: data.notas,
            cuotas: cuotasInput,
          });

      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved(result.venta);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Editar venta" : "Nueva venta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="unidadId">Unidad</Label>
            {item ? (
              <p className="text-sm font-medium">{item.unidadNombre}</p>
            ) : unidadesDisponibles.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay unidades disponibles para vender. Cargalas en &quot;Datos del proyecto&quot;.
              </p>
            ) : (
              <Controller
                control={control}
                name="unidadId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} items={unidadItems}>
                    <SelectTrigger id="unidadId" className="w-full">
                      <SelectValue placeholder="Elegí una unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {unidadesDisponibles.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="compradorNombre">Comprador</Label>
            <Input
              id="compradorNombre"
              {...register("compradorNombre", { required: true })}
              placeholder="Nombre del comprador"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fecha">Fecha de venta</Label>
              <Input id="fecha" type="date" {...register("fecha", { required: true })} />
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="precioTotal">Precio total ({moneda})</Label>
              <Input
                id="precioTotal"
                inputMode="decimal"
                placeholder="0"
                value={precioTexto}
                onChange={(e) => {
                  const formateado = formatMontoWhileTyping(e.target.value);
                  setPrecioTexto(formateado);
                  setValue("precioTotal", parseMontoTexto(formateado), { shouldValidate: true });
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="modalidad">Forma de pago</Label>
              <Controller
                control={control}
                name="modalidad"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} items={MODALIDAD_LABELS}>
                    <SelectTrigger id="modalidad" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MODALIDAD_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {modalidad === "FINANCIADO" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="anticipo">Anticipo ({moneda}, opcional)</Label>
                <Input
                  id="anticipo"
                  inputMode="decimal"
                  placeholder="0"
                  value={anticipoTexto}
                  onChange={(e) => {
                    const formateado = formatMontoWhileTyping(e.target.value);
                    setAnticipoTexto(formateado);
                    setValue("anticipo", parseMontoTexto(formateado), { shouldValidate: true });
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cantidadCuotas">Cantidad de cuotas</Label>
                <Input
                  id="cantidadCuotas"
                  type="number"
                  min="1"
                  step="1"
                  {...register("cantidadCuotas", { valueAsNumber: true, min: 1 })}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="medioPagoId">Medio de pago</Label>
            {mediosPago.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Todavía no hay medios de pago cargados en este proyecto.
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
            <div className="flex items-center justify-between">
              <Label>Plan de pagos</Label>
              {modalidad === "FINANCIADO" && (
                <Button type="button" variant="ghost" size="sm" onClick={handleRecalcular}>
                  Recalcular cuotas iguales
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2 rounded-md border p-2">
              {cuotas.length === 0 ? (
                <p className="p-2 text-center text-xs text-muted-foreground">Sin pagos generados todavía.</p>
              ) : (
                cuotas.map((c, index) => (
                  <div
                    key={c.id ?? `nueva-${index}`}
                    className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
                  >
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">
                      {c.esAnticipo ? "Anticipo" : `Cuota ${c.numero}`}
                    </span>
                    {c.cobrada ? (
                      <>
                        <span className="flex-1 text-sm">{c.fecha.split("-").reverse().join("/")}</span>
                        <span className="w-28 shrink-0 text-right text-sm">
                          {c.monto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="shrink-0 text-xs text-success">Cobrada</span>
                        <div className="w-7 shrink-0" />
                      </>
                    ) : (
                      <>
                        <Input
                          type="date"
                          value={c.fecha}
                          onChange={(e) => handleCuotaChange(index, "fecha", e.target.value)}
                          className="h-8 flex-1"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={c.monto || ""}
                          onChange={(e) => handleCuotaChange(index, "monto", e.target.value)}
                          className="h-8 w-28"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Quitar pago"
                          onClick={() => handleQuitarCuota(index)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
              <Button type="button" variant="outline" size="sm" onClick={handleAgregarCuota}>
                <Plus className="h-3.5 w-3.5" />
                Agregar pago
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Input id="notas" {...register("notas")} />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            {item ? (
              <DeleteButton
                action={() => deleteVenta(item.id)}
                confirmMessage={`¿Eliminar la venta de "${item.unidadNombre}"? La unidad vuelve a quedar disponible. Esta acción no se puede deshacer.`}
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
