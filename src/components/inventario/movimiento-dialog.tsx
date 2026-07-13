"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { MaterialDialog } from "@/components/materiales/material-dialog";
import { createMovimientoInventario, type MovimientoInventarioOpcion } from "@/actions/inventario";

type MaterialOpcion = { id: string; nombre: string; unidad: string };
type RubroOpcion = { id: string; nombre: string };

type FormValues = {
  materialId: string;
  tipo: "ENTRADA" | "SALIDA";
  cantidad: number;
  notas: string;
};

const TIPO_LABELS = { ENTRADA: "Entrada (ingresa material)", SALIDA: "Salida (se usa material)" };

export function MovimientoInventarioDialog({
  materiales,
  rubros,
  trigger,
  onCreated,
}: {
  materiales: MaterialOpcion[];
  rubros: RubroOpcion[];
  trigger: React.ReactNode;
  onCreated?: (movimiento: MovimientoInventarioOpcion) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [materialesDisponibles, setMaterialesDisponibles] = useState(materiales);

  useEffect(() => {
    setMaterialesDisponibles(materiales);
  }, [materiales]);

  const { control, register, handleSubmit, reset, setValue } = useForm<FormValues>({
    defaultValues: {
      materialId: "",
      tipo: "ENTRADA",
      cantidad: 0,
      notas: "",
    },
  });

  const materialComboItems = materialesDisponibles.map((m) => ({
    value: m.id,
    label: `${m.nombre} (${m.unidad})`,
  }));

  const onSubmit = (data: FormValues) => {
    setError(undefined);

    if (!data.materialId) {
      setError("Elegí un material.");
      return;
    }
    if (!data.cantidad || data.cantidad <= 0) {
      setError("Ingresá una cantidad mayor a 0.");
      return;
    }

    startTransition(async () => {
      const result = await createMovimientoInventario({
        materialId: data.materialId,
        tipo: data.tipo,
        cantidad: data.cantidad,
        notas: data.notas || undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onCreated?.(result.movimiento);
      setOpen(false);
      reset();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(undefined);
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo movimiento de inventario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="materialId">Material</Label>
              <MaterialDialog
                rubros={rubros}
                onCreated={(m) => {
                  setMaterialesDisponibles((prev) => [...prev, m]);
                  setValue("materialId", m.id);
                }}
                trigger={
                  <Button type="button" variant="link" size="sm" className="h-auto p-0">
                    + Nuevo material
                  </Button>
                }
              />
            </div>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tipo">Tipo de movimiento</Label>
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="cantidad">Cantidad</Label>
              <Input
                id="cantidad"
                type="number"
                step="1"
                min="0"
                {...register("cantidad", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" {...register("notas")} />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Guardando..." : "Guardar movimiento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
