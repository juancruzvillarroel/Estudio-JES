"use client";

import { useRef, useState, useTransition } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Camera, CheckCheck, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { EntregaSchema, type EntregaInput } from "@/lib/validations/entrega";
import { registrarEntrega } from "@/actions/entregas";
import { CAMPO_NUMERICO_VACIO, campoNumerico } from "@/lib/utils";

type PedidoItemPendiente = {
  pedidoItemId: string;
  materialNombre: string;
  unidad: string;
  restante: number;
  pesoPorBarra: number | null;
};

export function EntregaForm({
  pedidoId,
  itemsPendientes,
  /**
   * Si el pedido ya tuvo entregas antes. Solo cambia cómo se llama el botón de
   * completar: "todo el pedido" sería mentira cuando la mitad ya llegó la
   * semana pasada, porque lo que se carga es lo que falta, no lo pedido.
   */
  hayEntregasPrevias = false,
}: {
  pedidoId: string;
  itemsPendientes: PedidoItemPendiente[];
  hayEntregasPrevias?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [remitoArchivo, setRemitoArchivo] = useState<File | null>(null);
  const [barras, setBarras] = useState<Record<number, string>>({});
  const [completoTodo, setCompletoTodo] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const inputCamaraRef = useRef<HTMLInputElement>(null);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<EntregaInput>({
    resolver: zodResolver(EntregaSchema),
    defaultValues: {
      pedidoId,
      numeroRemito: "",
      notas: "",
      sumarAInventario: false,
      // Sin `cantidad`: los campos arrancan en blanco y no en cero (ver
      // `campoNumerico`). Lo que no se toca se manda como 0.
      items: itemsPendientes.map((i) => ({ pedidoItemId: i.pedidoItemId })),
    },
  });

  const { fields } = useFieldArray({ control, name: "items" });

  /**
   * Llena todas las cantidades con lo que falta entregar de cada ítem.
   *
   * El caso normal es que el camión traiga el pedido entero, y cargar quince
   * renglones a mano para escribir en cada uno el número que ya está escrito al
   * lado ("Pendiente: 40") es puro trabajo de copista.
   *
   * Llena los campos y no manda nada: queda todo editable por si un renglón vino
   * corto, y la entrega se registra con el mismo botón de siempre. Un botón que
   * guardara solo no dejaría corregir el remito ni marcar inventario.
   */
  const completarTodo = () => {
    const barrasNuevas: Record<number, string> = {};

    itemsPendientes.forEach((info, index) => {
      setValue(`items.${index}.cantidad`, info.restante, { shouldValidate: true });

      // El ayudante de barras se completa solo cuando la cuenta da exacta. Si el
      // pendiente son 137,5 kg, "11,45 barras" es un número que nadie contó ni
      // puede contar; mejor dejarlo en blanco que inventar una precisión falsa.
      if (info.pesoPorBarra) {
        const cantidad = info.restante / info.pesoPorBarra;
        if (Math.abs(cantidad - Math.round(cantidad)) < 1e-6) {
          barrasNuevas[index] = String(Math.round(cantidad));
        }
      }
    });

    setBarras(barrasNuevas);
    setCompletoTodo(true);
  };

  /** Deja todo en blanco, para arrancar de nuevo si el botón no era lo que hacía falta. */
  const vaciarTodo = () => {
    itemsPendientes.forEach((_, index) => {
      setValue(`items.${index}.cantidad`, CAMPO_NUMERICO_VACIO, { shouldValidate: true });
    });
    setBarras({});
    setCompletoTodo(false);
  };

  const onSubmit = (data: EntregaInput) => {
    setFormError(null);
    startTransition(async () => {
      const result = await registrarEntrega(data, remitoArchivo ?? undefined);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      router.push(`/pedidos/${pedidoId}`);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <input type="hidden" {...register("pedidoId")} />

      <div className="flex flex-col gap-3">
        {itemsPendientes.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Qué entregaron
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {itemsPendientes.length}{" "}
                {itemsPendientes.length === 1 ? "material pendiente" : "materiales pendientes"}
              </span>
            </p>
            <div className="flex items-center gap-1">
              {completoTodo && (
                <Button type="button" variant="ghost" size="sm" onClick={vaciarTodo}>
                  Vaciar
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={completarTodo}>
                <CheckCheck />
                {hayEntregasPrevias ? "Entregaron todo lo que faltaba" : "Entregaron todo el pedido"}
              </Button>
            </div>
          </div>
        )}

        {fields.map((field, index) => {
          const info = itemsPendientes[index];
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
                    placeholder="—"
                    value={barras[index] ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setBarras((prev) => ({ ...prev, [index]: raw }));
                      const cantidadBarras = Number(raw);
                      if (raw && !Number.isNaN(cantidadBarras)) {
                        const kg = Math.round(cantidadBarras * info.pesoPorBarra! * 100) / 100;
                        setValue(`items.${index}.cantidad`, kg, { shouldValidate: true });
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
                  placeholder="—"
                  {...register(`items.${index}.cantidad`, campoNumerico)}
                />
                {errors.items?.[index]?.cantidad && (
                  <p className="mt-1 text-xs text-error">
                    {errors.items[index]?.cantidad?.message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {errors.items?.message && <p className="text-sm text-error">{errors.items.message}</p>}

      <div className="flex flex-col gap-2">
        <Label htmlFor="numeroRemito">Número de remito (opcional)</Label>
        <div className="flex gap-2">
          <Input id="numeroRemito" className="flex-1" {...register("numeroRemito")} />
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
            onChange={(e) => setRemitoArchivo(e.target.files?.[0] ?? null)}
          />
          <input
            ref={inputCamaraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setRemitoArchivo(e.target.files?.[0] ?? null)}
          />
        </div>
        {remitoArchivo && (
          <div className="flex items-center justify-between rounded-md border p-2 text-sm">
            <span className="truncate">{remitoArchivo.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Quitar archivo"
              onClick={() => {
                setRemitoArchivo(null);
                if (inputArchivoRef.current) inputArchivoRef.current.value = "";
                if (inputCamaraRef.current) inputCamaraRef.current.value = "";
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" {...register("notas")} />
      </div>

      {formError && <p className="text-sm text-error">{formError}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando..." : "Registrar entrega"}
      </Button>
    </form>
  );
}
