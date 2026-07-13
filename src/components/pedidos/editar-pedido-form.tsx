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
import { updatePedido } from "@/actions/pedidos";
import { AcopioDialog } from "@/components/acopios/acopio-dialog";
import { NuevoProveedorDialog } from "@/components/proveedores/nuevo-proveedor-dialog";
import type { AcopioOpcion } from "@/actions/acopios";
import { formatMonto } from "@/lib/utils";

type Opcion = { id: string; nombre: string };
type RubroConProveedores = {
  id: string;
  nombre: string;
  proveedores: { id: string; nombre: string }[];
};
type MaterialOpcion = { id: string; nombre: string; unidad: string; rubroId: string | null };
type ItemInicial = {
  id: string;
  materialId: string;
  cantidad: number;
  cantidadEntregada: number;
};

type FormValues = {
  fecha: string;
  proyectoId: string;
  rubroId: string;
  proveedorId: string;
  acopioId: string;
  notas: string;
  items: { id: string; materialId: string; cantidad: number; cantidadEntregada: number }[];
};

function labelAcopio(a: AcopioOpcion) {
  return a.tipo === "MATERIAL"
    ? `${a.materialNombre} — ${(a.cantidadTotal ?? 0) - a.consumido} ${a.unidad} restantes`
    : `Monto — ${formatMonto((a.montoTotal ?? 0) - a.consumido)} restantes`;
}

function toDateInputValue(fechaISO: string) {
  return fechaISO.slice(0, 10);
}

export function EditarPedidoForm({
  pedidoId,
  proyectos,
  rubros,
  materiales,
  acopios,
  hasEntregas,
  initial,
}: {
  pedidoId: string;
  proyectos: Opcion[];
  rubros: RubroConProveedores[];
  materiales: MaterialOpcion[];
  acopios: AcopioOpcion[];
  hasEntregas: boolean;
  initial: {
    proyectoId: string;
    rubroId: string;
    proveedorId: string;
    acopioId: string;
    fechaISO: string;
    notas: string;
    archivoUrl: string | null;
    items: ItemInicial[];
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [archivoNuevo, setArchivoNuevo] = useState<File | null>(null);
  const [quitarArchivo, setQuitarArchivo] = useState(false);
  const [acopiosCreados, setAcopiosCreados] = useState<AcopioOpcion[]>([]);
  const [proveedoresCreados, setProveedoresCreados] = useState<(Opcion & { rubroId: string })[]>([]);
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const inputCamaraRef = useRef<HTMLInputElement>(null);

  const { control, register, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      fecha: toDateInputValue(initial.fechaISO),
      proyectoId: initial.proyectoId,
      rubroId: initial.rubroId,
      proveedorId: initial.proveedorId,
      acopioId: initial.acopioId || "ninguno",
      notas: initial.notas,
      items: initial.items,
    },
  });

  const proyectoId = watch("proyectoId");
  const rubroId = watch("rubroId");
  const proveedorId = watch("proveedorId");
  const acopioId = watch("acopioId");

  const {
    fields: itemFields,
    append: appendItem,
    remove: removeItem,
  } = useFieldArray({ control, name: "items" });

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
  const materialesParaItems = !acopioSeleccionado
    ? materialesDisponibles
    : acopioSeleccionado.tipo === "MATERIAL"
      ? materialesDisponibles.filter((m) => m.id === acopioSeleccionado.materialId)
      : materialesDisponibles.filter((m) =>
          acopioSeleccionado.precios.some((p) => p.materialId === m.id)
        );
  const materialComboItems = materialesParaItems.map((m) => ({
    value: m.id,
    label: `${m.nombre} (${m.unidad})`,
  }));

  useEffect(() => {
    setArchivoNuevo(null);
    setQuitarArchivo(false);
    if (inputArchivoRef.current) inputArchivoRef.current.value = "";
    if (inputCamaraRef.current) inputCamaraRef.current.value = "";
  }, []);

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
    const items = data.items.filter((i) => i.materialId && i.cantidad > 0);
    if (items.length === 0) {
      setFormError("Agregá al menos un material.");
      return;
    }

    startTransition(async () => {
      const result = await updatePedido(
        pedidoId,
        {
          proyectoId: data.proyectoId,
          proveedorId: data.proveedorId,
          acopioId: data.acopioId !== "ninguno" ? data.acopioId : undefined,
          fecha: new Date(data.fecha),
          notas: data.notas || undefined,
          items: items.map((i) => ({
            id: i.id || undefined,
            materialId: i.materialId,
            cantidad: i.cantidad,
          })),
        },
        archivoNuevo ?? undefined,
        quitarArchivo
      );
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      router.push(`/pedidos/${pedidoId}`);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {hasEntregas && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Este pedido ya tiene entregas registradas: no se puede cambiar el proyecto, el proveedor
          ni el acopio, y los materiales ya entregados no se pueden quitar ni bajar de la cantidad
          ya entregada.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="proyectoId">Proyecto</Label>
          <Controller
            control={control}
            name="proyectoId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                items={proyectoItems}
                disabled={hasEntregas}
              >
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
              <Select
                value={field.value}
                onValueChange={field.onChange}
                items={rubroItems}
                disabled={hasEntregas}
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
                    disabled={!rubroId || hasEntregas}
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
                  disabled={!rubroId || hasEntregas}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              }
            />
          </div>
        </div>
      </div>

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
                  disabled={!proveedorId || hasEntregas}
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
              <Button type="button" variant="outline" disabled={!proveedorId || !proyectoId || hasEntregas}>
                <Plus className="h-4 w-4" />
                Nuevo acopio
              </Button>
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Materiales pedidos</Label>
        {rubroId && materialesDisponibles.length === 0 && (
          <p className="text-sm text-muted-foreground">Este rubro no tiene materiales cargados.</p>
        )}
        {acopioSeleccionado && materialesParaItems.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ningún material de este rubro corresponde al acopio elegido.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {itemFields.map((field, index) => {
            const entregada = field.cantidadEntregada;
            const bloqueado = entregada > 0;
            return (
              <div key={field.id} className="flex items-start gap-2 rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <Controller
                    control={control}
                    name={`items.${index}.materialId`}
                    render={({ field }) => (
                      <Combobox
                        value={field.value}
                        onValueChange={field.onChange}
                        items={materialComboItems}
                        disabled={!rubroId || bloqueado}
                        placeholder={rubroId ? "Buscá un material" : "Elegí un rubro primero"}
                      />
                    )}
                  />
                  {bloqueado && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ya se entregaron {entregada}. No se puede bajar de esa cantidad ni cambiar el
                      material.
                    </p>
                  )}
                </div>
                <div className="w-24 shrink-0">
                  <Input
                    type="number"
                    step="1"
                    min={bloqueado ? entregada : 0}
                    placeholder="Cantidad"
                    {...register(`items.${index}.cantidad`, { valueAsNumber: true })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={itemFields.length === 1 || bloqueado}
                  onClick={() => removeItem(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => appendItem({ id: "", materialId: "", cantidad: 0, cantidadEntregada: 0 })}
        >
          <Plus className="h-4 w-4" />
          Agregar material
        </Button>
      </div>

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
        ) : initial.archivoUrl && !quitarArchivo ? (
          <div className="flex items-center justify-between rounded-md border p-2 text-sm">
            <a
              href={initial.archivoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate underline"
            >
              Ver archivo actual
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

      {formError && <p className="text-sm text-error">{formError}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Guardando..." : "Guardar cambios"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => router.push(`/pedidos/${pedidoId}`)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
