"use client";

import { useState, useTransition } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { createAcopio, type AcopioOpcion } from "@/actions/acopios";

type MaterialOpcion = { id: string; nombre: string; unidad: string };
type ProyectoOpcion = { id: string; nombre: string };

type FormValues = {
  proyectoId: string;
  tipo: "MATERIAL" | "MONTO";
  materialId: string;
  cantidadTotal: number;
  montoTotal: number;
  precios: { materialId: string; precioUnitario: number }[];
  notas: string;
};

const TIPO_LABELS = { MATERIAL: "Cantidad de un material", MONTO: "Monto de dinero" };

export function AcopioDialog({
  proyectoId,
  proyectos,
  proveedorId,
  materiales,
  trigger,
  onCreated,
}: {
  /** Proyecto fijo (por ejemplo, el ya elegido en el formulario de pedido). */
  proyectoId?: string;
  /** Si no hay proyecto fijo, se muestra un selector con estas opciones. */
  proyectos?: ProyectoOpcion[];
  proveedorId: string;
  materiales: MaterialOpcion[];
  trigger: React.ReactNode;
  onCreated: (acopio: AcopioOpcion) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const { control, register, handleSubmit, watch, reset } = useForm<FormValues>({
    defaultValues: {
      proyectoId: proyectoId ?? "",
      tipo: "MATERIAL",
      materialId: "",
      cantidadTotal: 0,
      montoTotal: 0,
      precios: [{ materialId: "", precioUnitario: 0 }],
      notas: "",
    },
  });

  const tipo = watch("tipo");
  const { fields, append, remove } = useFieldArray({ control, name: "precios" });

  const materialComboItems = materiales.map((m) => ({ value: m.id, label: `${m.nombre} (${m.unidad})` }));
  const proyectoItems = Object.fromEntries((proyectos ?? []).map((p) => [p.id, p.nombre]));

  const onSubmit = (data: FormValues) => {
    setError(undefined);

    const proyectoElegido = proyectoId || data.proyectoId;
    if (!proyectoElegido) {
      setError("Elegí un proyecto.");
      return;
    }
    if (data.tipo === "MATERIAL" && !data.materialId) {
      setError("Elegí un material.");
      return;
    }
    if (data.tipo === "MONTO" && data.precios.some((p) => !p.materialId || p.precioUnitario <= 0)) {
      setError("Completá el material y el precio de cada fila.");
      return;
    }

    startTransition(async () => {
      const result = await createAcopio(
        data.tipo === "MATERIAL"
          ? {
              tipo: "MATERIAL",
              proyectoId: proyectoElegido,
              proveedorId,
              materialId: data.materialId,
              cantidadTotal: data.cantidadTotal,
              notas: data.notas || undefined,
            }
          : {
              tipo: "MONTO",
              proyectoId: proyectoElegido,
              proveedorId,
              montoTotal: data.montoTotal,
              precios: data.precios,
              notas: data.notas || undefined,
            }
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      onCreated(result.acopio);
      setOpen(false);
      reset();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo acopio</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {!proyectoId && (
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
                      {(proyectos ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="tipo">Tipo de acopio</Label>
            <Controller
              control={control}
              name="tipo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} items={TIPO_LABELS}>
                  <SelectTrigger id="tipo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {tipo === "MATERIAL" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="materialId">Material</Label>
                <Controller
                  control={control}
                  name="materialId"
                  render={({ field }) => (
                    <Combobox
                      id="materialId"
                      value={field.value}
                      onValueChange={field.onChange}
                      items={materialComboItems}
                      placeholder="Buscá un material"
                    />
                  )}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cantidadTotal">Cantidad total</Label>
                <Input
                  id="cantidadTotal"
                  type="number"
                  step="1"
                  min="0"
                  {...register("cantidadTotal", { valueAsNumber: true })}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="montoTotal">Monto total ($)</Label>
                <Input
                  id="montoTotal"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("montoTotal", { valueAsNumber: true })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Lista de precios (queda congelada)</Label>
                <div className="flex flex-col gap-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-start gap-2 rounded-md border p-3">
                      <div className="min-w-0 flex-1">
                        <Controller
                          control={control}
                          name={`precios.${index}.materialId`}
                          render={({ field }) => (
                            <Combobox
                              value={field.value}
                              onValueChange={field.onChange}
                              items={materialComboItems}
                              placeholder="Buscá un material"
                            />
                          )}
                        />
                      </div>
                      <div className="w-20 shrink-0">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Precio"
                          {...register(`precios.${index}.precioUnitario`, { valueAsNumber: true })}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
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
                  onClick={() => append({ materialId: "", precioUnitario: 0 })}
                >
                  <Plus className="h-4 w-4" />
                  Agregar material
                </Button>
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" {...register("notas")} />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Guardando..." : "Guardar acopio"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
