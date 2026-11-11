"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
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
import {
  createMovimientoFondo,
  deleteMovimientoFondo,
  updateMovimientoFondo,
} from "@/actions/movimientos-fondo";
import { obtenerCotizacionDolarBlue } from "@/actions/cotizaciones";
import { montoEntrante, otraMoneda } from "@/lib/cambios-moneda";
import type { MovimientoFondoOpcion } from "@/lib/flujo-fondos";
import { formatMontoInicial, formatMontoWhileTyping, parseMontoTexto } from "@/lib/monto-input";
import { formatFecha, formatMontoMoneda } from "@/lib/utils";

type Moneda = "ARS" | "USD";

/**
 * Se elige el sentido del cambio y no "la moneda": así se lee como se piensa
 * ("vendí dólares"), y la moneda que sale queda implícita en la opción.
 */
const SENTIDOS: Record<Moneda, string> = {
  USD: "Dólares a pesos",
  ARS: "Pesos a dólares",
};

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Alta y edición de un cambio de moneda (ver src/lib/cambios-moneda.ts). Es un
 * diálogo aparte del de aportes porque pide otras cosas: el sentido del cambio
 * en vez de la moneda, el tipo de cambio obligatorio y nada de inversor.
 */
export function CambioMonedaDialog({
  proyectoId,
  item,
  trigger,
  onSaved,
  onDeleted,
}: {
  proyectoId: string;
  item?: MovimientoFondoOpcion;
  trigger: React.ReactNode;
  onSaved: (movimiento: MovimientoFondoOpcion) => void;
  onDeleted?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const [fecha, setFecha] = useState(item?.fecha.slice(0, 10) ?? hoyISO());
  const [sale, setSale] = useState<Moneda>(item?.moneda ?? "USD");
  const [montoTexto, setMontoTexto] = useState(formatMontoInicial(item?.monto ?? 0));
  const [tipoCambioTexto, setTipoCambioTexto] = useState(formatMontoInicial(item?.tipoCambio ?? 0));
  const [descripcion, setDescripcion] = useState(item?.descripcion ?? "");
  const [cotizacionInfo, setCotizacionInfo] = useState<string | undefined>();
  // Al editar se respeta la cotización guardada: es la del cambio que se hizo de
  // verdad. Solo se busca la del blue cuando el usuario cambia la fecha o el
  // sentido, o cuando el cambio es nuevo.
  const [buscarCotizacion, setBuscarCotizacion] = useState(!item);

  const monto = parseMontoTexto(montoTexto);
  const tipoCambio = parseMontoTexto(tipoCambioTexto);
  const entra = otraMoneda(sale);
  const entrante = montoEntrante({ monto, moneda: sale, tipoCambio });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setFecha(item?.fecha.slice(0, 10) ?? hoyISO());
      setSale(item?.moneda ?? "USD");
      setMontoTexto(formatMontoInicial(item?.monto ?? 0));
      setTipoCambioTexto(formatMontoInicial(item?.tipoCambio ?? 0));
      setDescripcion(item?.descripcion ?? "");
      setCotizacionInfo(undefined);
      setBuscarCotizacion(!item);
      setError(undefined);
    }
  };

  // Propone el dólar blue del día. Quien vende dólares cobra el precio de
  // compra de la cueva y quien los compra paga el de venta, así que la punta
  // depende del sentido. Se puede pisar a mano.
  useEffect(() => {
    if (!open || !buscarCotizacion || !fecha) return;
    let cancelado = false;
    obtenerCotizacionDolarBlue(fecha).then((cot) => {
      if (cancelado) return;
      if (!cot) {
        setCotizacionInfo("No se encontró la cotización de esa fecha. Ingresá el tipo de cambio a mano.");
        return;
      }
      const valor = sale === "USD" ? cot.compra : cot.venta;
      setTipoCambioTexto(formatMontoInicial(valor));
      setCotizacionInfo(
        `Dólar blue (${sale === "USD" ? "compra" : "venta"}) del ${formatFecha(`${fecha}T12:00:00Z`)}: $${valor}`
      );
    });
    return () => {
      cancelado = true;
    };
  }, [open, buscarCotizacion, fecha, sale]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!monto || monto <= 0) {
      setError("Ingresá el monto que cambiaste.");
      return;
    }
    if (!tipoCambio || tipoCambio <= 0) {
      setError("Ingresá el tipo de cambio.");
      return;
    }

    const input = {
      tipo: "CAMBIO" as const,
      proyectoId,
      fecha,
      descripcion,
      monto,
      moneda: sale,
      tipoCambio,
    };

    startTransition(async () => {
      const result = item
        ? await updateMovimientoFondo(item.id, input)
        : await createMovimientoFondo(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved(result.movimiento);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Editar cambio de moneda" : "Nuevo cambio de moneda"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cambio-fecha">Fecha</Label>
              <Input
                id="cambio-fecha"
                type="date"
                value={fecha}
                onChange={(e) => {
                  setFecha(e.target.value);
                  setBuscarCotizacion(true);
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cambio-sentido">Cambio</Label>
              <Select
                value={sale}
                onValueChange={(v) => {
                  setSale(v as Moneda);
                  setBuscarCotizacion(true);
                }}
                items={SENTIDOS}
              >
                <SelectTrigger id="cambio-sentido" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SENTIDOS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cambio-monto">Sale ({sale === "USD" ? "USD" : "$"})</Label>
              <Input
                id="cambio-monto"
                inputMode="decimal"
                placeholder="0"
                value={montoTexto}
                onChange={(e) => setMontoTexto(formatMontoWhileTyping(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cambio-tc">Tipo de cambio ($ por USD)</Label>
              <Input
                id="cambio-tc"
                inputMode="decimal"
                placeholder="0"
                value={tipoCambioTexto}
                onChange={(e) => setTipoCambioTexto(formatMontoWhileTyping(e.target.value))}
              />
            </div>
          </div>
          {cotizacionInfo && <p className="-mt-2 text-xs text-muted-foreground">{cotizacionInfo}</p>}

          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span className="tabular-nums">{formatMontoMoneda(monto, sale)}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-semibold tabular-nums">{formatMontoMoneda(entrante, entra)}</span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cambio-descripcion">Descripción (opcional)</Label>
            <Input
              id="cambio-descripcion"
              placeholder="Ej.: venta de dólares para pagar el hormigón"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            {item ? (
              <DeleteButton
                action={() => deleteMovimientoFondo(item.id)}
                confirmMessage="¿Eliminar este cambio de moneda? Esta acción no se puede deshacer."
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
