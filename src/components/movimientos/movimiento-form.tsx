"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Camera, Paperclip, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { createPedido } from "@/actions/pedidos";
import { registrarEntrega } from "@/actions/entregas";
import { AcopioDialog } from "@/components/acopios/acopio-dialog";
import { NuevoProveedorDialog } from "@/components/proveedores/nuevo-proveedor-dialog";
import type { AcopioOpcion } from "@/actions/acopios";
import { cn, formatMonto, formatNumeroPedido } from "@/lib/utils";

type Opcion = { id: string; nombre: string };
type RubroConProveedores = {
  id: string;
  nombre: string;
  proveedores: { id: string; nombre: string }[];
};
type MaterialOpcion = { id: string; nombre: string; unidad: string; rubroId: string | null };
type PedidoAbierto = {
  id: string;
  numero: number;
  proyectoId: string;
  proveedorId: string;
  items: {
    pedidoItemId: string;
    materialNombre: string;
    unidad: string;
    restante: number;
    pesoPorBarra: number | null;
  }[];
};

type FormValues = {
  fecha: string;
  tipo: "PEDIDO" | "ENTREGA";
  proyectoId: string;
  rubroId: string;
  proveedorId: string;
  acopioId: string;
  pedidoId: string;
  notas: string;
  numeroRemito: string;
  sumarAInventario: boolean;
  itemsPedido: { materialId: string; cantidad: number }[];
  itemsEntrega: { pedidoItemId: string; cantidad: number }[];
};

function labelAcopio(a: AcopioOpcion) {
  return a.tipo === "MATERIAL"
    ? `${a.materialNombre} — ${(a.cantidadTotal ?? 0) - a.consumido} ${a.unidad} restantes`
    : `Monto — ${formatMonto((a.montoTotal ?? 0) - a.consumido)} restantes`;
}

function hoyISO() {
  // Se arma a partir de los componentes de fecha locales (no con
  // toISOString, que convierte a UTC y puede adelantar un día de noche).
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");
  const day = String(hoy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function MovimientoForm({
  proyectos,
  rubros,
  materiales,
  pedidosAbiertos,
  acopios,
  tipoInicial,
}: {
  proyectos: Opcion[];
  rubros: RubroConProveedores[];
  materiales: MaterialOpcion[];
  pedidosAbiertos: PedidoAbierto[];
  acopios: AcopioOpcion[];
  tipoInicial?: "PEDIDO" | "ENTREGA";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [archivoAdjunto, setArchivoAdjunto] = useState<File | null>(null);
  const [barras, setBarras] = useState<Record<number, string>>({});
  const [acopiosCreados, setAcopiosCreados] = useState<AcopioOpcion[]>([]);
  const [proveedoresCreados, setProveedoresCreados] = useState<(Opcion & { rubroId: string })[]>([]);
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const inputCamaraRef = useRef<HTMLInputElement>(null);

  const { control, register, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      fecha: hoyISO(),
      tipo: tipoInicial ?? "PEDIDO",
      proyectoId: "",
      rubroId: "",
      proveedorId: "",
      acopioId: "ninguno",
      pedidoId: "",
      notas: "",
      numeroRemito: "",
      sumarAInventario: false,
      itemsPedido: [{ materialId: "", cantidad: 0 }],
      itemsEntrega: [],
    },
  });

  const tipo = watch("tipo");
  const proyectoId = watch("proyectoId");
  const rubroId = watch("rubroId");
  const proveedorId = watch("proveedorId");
  const acopioId = watch("acopioId");
  const pedidoId = watch("pedidoId");
  const itemsPedidoValues = watch("itemsPedido");

  const {
    fields: pedidoItemFields,
    append: appendPedidoItem,
    remove: removePedidoItem,
    replace: replacePedidoItems,
  } = useFieldArray({ control, name: "itemsPedido" });
  const { fields: entregaItemFields, replace: replaceEntregaItems } = useFieldArray({
    control,
    name: "itemsEntrega",
  });

  const proyectoItems = Object.fromEntries(proyectos.map((p) => [p.id, p.nombre]));
  const rubroItems = Object.fromEntries(rubros.map((r) => [r.id, r.nombre]));
  const proveedoresDisponibles = [
    ...(rubros.find((r) => r.id === rubroId)?.proveedores ?? []),
    ...proveedoresCreados.filter((p) => p.rubroId === rubroId),
  ];
  const proveedorComboItems = proveedoresDisponibles.map((p) => ({ value: p.id, label: p.nombre }));
  const materialesDisponibles = materiales.filter((m) => m.rubroId === rubroId);
  const acopiosDisponibles = [...acopios, ...acopiosCreados].filter(
    (a) => a.proyectoId === proyectoId && a.proveedorId === proveedorId
  );
  const acopioSeleccionado = acopiosDisponibles.find((a) => a.id === acopioId);
  const materialesParaPedido = !acopioSeleccionado
    ? materialesDisponibles
    : acopioSeleccionado.tipo === "MATERIAL"
      ? materialesDisponibles.filter((m) => m.id === acopioSeleccionado.materialId)
      : materialesDisponibles.filter((m) =>
          acopioSeleccionado.precios.some((p) => p.materialId === m.id)
        );
  const materialComboItems = materialesParaPedido.map((m) => ({
    value: m.id,
    label: `${m.nombre} (${m.unidad})`,
  }));
  const pedidosDisponibles = pedidosAbiertos.filter(
    (p) => p.proveedorId === proveedorId && p.proyectoId === proyectoId
  );
  const pedidoItems = Object.fromEntries(
    pedidosDisponibles.map((p) => [p.id, `Pedido #${formatNumeroPedido(p.numero)}`])
  );
  const pedidoSeleccionado = pedidosAbiertos.find((p) => p.id === pedidoId);

  useEffect(() => {
    if (proveedorId && !proveedoresDisponibles.some((p) => p.id === proveedorId)) {
      setValue("proveedorId", "");
    }
    replacePedidoItems([{ materialId: "", cantidad: 0 }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rubroId]);

  useEffect(() => {
    if (pedidoId && !pedidosDisponibles.some((p) => p.id === pedidoId)) {
      setValue("pedidoId", "");
    }
    if (acopioId !== "ninguno" && !acopiosDisponibles.some((a) => a.id === acopioId)) {
      setValue("acopioId", "ninguno");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedorId, proyectoId]);

  useEffect(() => {
    replacePedidoItems([{ materialId: "", cantidad: 0 }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acopioId]);

  useEffect(() => {
    if (tipo !== "ENTREGA") return;
    const items = pedidoSeleccionado?.items ?? [];
    replaceEntregaItems(items.map((i) => ({ pedidoItemId: i.pedidoItemId, cantidad: 0 })));
    setBarras({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId, tipo]);

  useEffect(() => {
    setArchivoAdjunto(null);
    if (inputArchivoRef.current) inputArchivoRef.current.value = "";
    if (inputCamaraRef.current) inputCamaraRef.current.value = "";
  }, [tipo]);

  const handleAcopioCreado = (acopio: AcopioOpcion) => {
    setAcopiosCreados((prev) => [...prev, acopio]);
    setValue("acopioId", acopio.id);
  };

  const handleProveedorCreado = (proveedor: { id: string; nombre: string }) => {
    setProveedoresCreados((prev) => [...prev, { ...proveedor, rubroId }]);
    setValue("proveedorId", proveedor.id);
  };

  const onSubmit = (data: FormValues) => {
    setFormError(null);

    if (!data.proyectoId) {
      setFormError("Elegí un proyecto.");
      return;
    }
    if (!data.rubroId) {
      setFormError("Elegí un rubro.");
      return;
    }
    if (!data.proveedorId) {
      setFormError("Elegí un proveedor.");
      return;
    }

    if (data.tipo === "PEDIDO") {
      const items = data.itemsPedido.filter((i) => i.materialId && i.cantidad > 0);
      if (items.length === 0) {
        setFormError("Agregá al menos un material.");
        return;
      }
      startTransition(async () => {
        const result = await createPedido(
          {
            proyectoId: data.proyectoId,
            proveedorId: data.proveedorId,
            acopioId: data.acopioId !== "ninguno" ? data.acopioId : undefined,
            fecha: new Date(data.fecha),
            notas: data.notas || undefined,
            items,
          },
          archivoAdjunto ?? undefined
        );
        if (!result.success) {
          setFormError(result.error);
          return;
        }
        router.push(`/pedidos/${result.pedidoId}`);
      });
    } else {
      if (!data.pedidoId) {
        setFormError("Elegí a qué pedido corresponde la entrega.");
        return;
      }
      if (!data.itemsEntrega.some((i) => i.cantidad > 0)) {
        setFormError("Cargá al menos una cantidad entregada.");
        return;
      }
      startTransition(async () => {
        const result = await registrarEntrega(
          {
            pedidoId: data.pedidoId,
            fecha: new Date(data.fecha),
            numeroRemito: data.numeroRemito || undefined,
            notas: data.notas || undefined,
            sumarAInventario: data.sumarAInventario,
            items: data.itemsEntrega,
          },
          archivoAdjunto ?? undefined
        );
        if (!result.success) {
          setFormError(result.error);
          return;
        }
        router.push(`/pedidos/${data.pedidoId}`);
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="proyectoId">Proyecto</Label>
          <Controller
            control={control}
            name="proyectoId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} items={proyectoItems}>
                <SelectTrigger id="proyectoId" className="w-full">
                  <SelectValue placeholder="Elegí un proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {proyectos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="fecha">Fecha</Label>
          <Input id="fecha" type="date" {...register("fecha")} required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="rubroId">Rubro</Label>
          <Controller
            control={control}
            name="rubroId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} items={rubroItems}>
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
                    placeholder={rubroId ? "Buscá un proveedor" : "Elegí un rubro primero"}
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
        </div>
      </div>

      {tipo === "ENTREGA" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="pedidoId">Pedido a conciliar</Label>
          <Controller
            control={control}
            name="pedidoId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                items={pedidoItems}
                disabled={!proveedorId}
              >
                <SelectTrigger id="pedidoId" className="w-full">
                  <SelectValue
                    placeholder={proveedorId ? "Elegí un pedido" : "Elegí un proveedor primero"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {pedidosDisponibles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Pedido #{formatNumeroPedido(p.numero)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {proveedorId && pedidosDisponibles.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Este proveedor no tiene pedidos pendientes en este proyecto.
            </p>
          )}
        </div>
      )}

      {tipo === "PEDIDO" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="acopioId">Acopio (opcional)</Label>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Controller
                control={control}
                name="acopioId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={{
                      ninguno: "Ninguno",
                      ...Object.fromEntries(acopiosDisponibles.map((a) => [a.id, labelAcopio(a)])),
                    }}
                    disabled={!proveedorId}
                  >
                    <SelectTrigger id="acopioId" className="w-full">
                      <SelectValue placeholder={proveedorId ? "Sin acopio" : "Elegí un proveedor primero"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ninguno">Ninguno</SelectItem>
                      {acopiosDisponibles.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {labelAcopio(a)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <AcopioDialog
              proyectoId={proyectoId}
              proveedorId={proveedorId}
              materiales={materialesDisponibles}
              onCreated={handleAcopioCreado}
              trigger={
                <Button type="button" variant="outline" disabled={!proveedorId || !proyectoId}>
                  <Plus className="h-4 w-4" />
                  Nuevo acopio
                </Button>
              }
            />
          </div>
        </div>
      )}

      {tipo === "PEDIDO" ? (
        <div className="flex flex-col gap-2">
          <Label>Materiales pedidos</Label>
          {rubroId && materialesDisponibles.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Este rubro no tiene materiales cargados.
            </p>
          )}
          {acopioSeleccionado && materialesParaPedido.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ningún material de este rubro corresponde al acopio elegido.
            </p>
          )}
          <div className="flex flex-col gap-3">
            {pedidoItemFields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2 rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <Controller
                    control={control}
                    name={`itemsPedido.${index}.materialId`}
                    render={({ field }) => (
                      <Combobox
                        value={field.value}
                        onValueChange={field.onChange}
                        items={materialComboItems}
                        disabled={!rubroId}
                        placeholder={rubroId ? "Buscá un material" : "Elegí un rubro primero"}
                      />
                    )}
                  />
                </div>
                <div className="w-24 shrink-0">
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="Cantidad"
                    {...register(`itemsPedido.${index}.cantidad`, { valueAsNumber: true })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={pedidoItemFields.length === 1}
                  onClick={() => removePedidoItem(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => appendPedidoItem({ materialId: "", cantidad: 0 })}
          >
            <Plus className="h-4 w-4" />
            Agregar material
          </Button>
        </div>
      ) : (
        pedidoId && (
          <div className="flex flex-col gap-2">
            <Label>Ítems a entregar</Label>
            <div className="flex flex-col gap-3">
              {entregaItemFields.map((field, index) => {
                const info = pedidoSeleccionado?.items[index];
                if (!info) return null;
                return (
                  <div key={field.id} className="flex items-start gap-3 rounded-md border p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{info.materialNombre}</p>
                      <p className="text-xs text-muted-foreground">
                        Pendiente: {info.restante} {info.unidad}
                      </p>
                    </div>
                    {info.pesoPorBarra && (
                      <div className="w-28">
                        <Label className="text-xs font-normal text-muted-foreground">
                          Cant. de barras
                        </Label>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="Barras"
                          value={barras[index] ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setBarras((prev) => ({ ...prev, [index]: raw }));
                            const cantidadBarras = Number(raw);
                            if (raw && !Number.isNaN(cantidadBarras)) {
                              const kg = Math.round(cantidadBarras * info.pesoPorBarra! * 100) / 100;
                              setValue(`itemsEntrega.${index}.cantidad`, kg, { shouldValidate: true });
                            }
                          }}
                        />
                        <p className="mt-1 text-[0.7rem] text-muted-foreground">
                          1 barra = {info.pesoPorBarra} {info.unidad}
                        </p>
                      </div>
                    )}
                    <div className="w-28">
                      <Label className="text-xs font-normal text-muted-foreground">
                        Cantidad ({info.unidad})
                      </Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max={info.restante}
                        {...register(`itemsEntrega.${index}.cantidad`, { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="numeroRemito">Número de remito (opcional)</Label>
              <Input id="numeroRemito" {...register("numeroRemito")} />
            </div>

            <Controller
              control={control}
              name="sumarAInventario"
              render={({ field }) => (
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={(checked) => field.onChange(checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">Inventario</span>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      Sumar lo entregado al stock del estudio.
                    </span>
                  </span>
                </label>
              )}
            />
          </div>
        )
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="notas">Notas / Documento</Label>
        <div className="flex gap-2">
          <Textarea id="notas" className="flex-1" {...register("notas")} />
          <div className="flex flex-col gap-2">
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
          </div>
          <input
            ref={inputArchivoRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => setArchivoAdjunto(e.target.files?.[0] ?? null)}
          />
          <input
            ref={inputCamaraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setArchivoAdjunto(e.target.files?.[0] ?? null)}
          />
        </div>
        {archivoAdjunto && (
          <div className="flex items-center justify-between rounded-md border p-2 text-sm">
            <span className="truncate">{archivoAdjunto.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Quitar archivo"
              onClick={() => {
                setArchivoAdjunto(null);
                if (inputArchivoRef.current) inputArchivoRef.current.value = "";
                if (inputCamaraRef.current) inputCamaraRef.current.value = "";
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {formError && <p className="text-sm text-error">{formError}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando..." : tipo === "PEDIDO" ? "Guardar pedido" : "Guardar entrega"}
      </Button>
    </form>
  );
}
