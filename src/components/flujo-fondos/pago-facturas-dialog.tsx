"use client";

import { useEffect, useState, useTransition } from "react";
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
import { registrarPagoFacturas } from "@/actions/facturas";
import { obtenerCotizacionDolarBlue } from "@/actions/cotizaciones";
import type { MedioPagoOpcion } from "@/lib/flujo-fondos";
import type { FacturaOpcion } from "@/lib/facturas";
import { formatMontoInicial, formatMontoWhileTyping, parseMontoTexto } from "@/lib/monto-input";
import { formatMontoMoneda } from "@/lib/utils";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Registra el pago de un conjunto de facturas.
 *
 * La fecha y el medio de pago se cargan una sola vez para todo el pago; el
 * monto es por factura y arranca en el saldo, así el caso normal —pagar todo—
 * es apretar Guardar. Bajarlo deja un pago parcial: el saldo se recalcula solo
 * como monto menos lo pagado, sin ningún estado que mantener a mano.
 *
 * Cada factura genera su propio gasto, porque el gasto es el que lleva el
 * rubro y dos facturas del mismo pago pueden ser de rubros distintos (ver
 * `registrarPagoFacturas` en src/actions/facturas.ts).
 */
export function PagoFacturasDialog({
  proyectoId,
  facturas,
  mediosPago,
  trigger,
  onPagado,
}: {
  proyectoId: string;
  facturas: FacturaOpcion[];
  mediosPago: MedioPagoOpcion[];
  trigger: React.ReactNode;
  onPagado: (facturas: FacturaOpcion[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [fecha, setFecha] = useState(hoyISO);
  const [medioPagoId, setMedioPagoId] = useState("");
  const [tipoCambio, setTipoCambio] = useState("");
  const [descripcion, setDescripcion] = useState("");
  // La cotización se guarda junto con la fecha para la que se pidió: comparar
  // esa clave con la fecha actual reemplaza a tener que blanquear el texto
  // desde el efecto, que encadenaría renders (ver factura-dialog.tsx).
  const [cotizacion, setCotizacion] = useState<{ clave: string; texto: string } | null>(null);
  // El texto de cada campo de monto, indexado por id de factura.
  const [montos, setMontos] = useState<Record<string, string>>({});

  const hayEnPesos = facturas.some((f) => f.moneda === "ARS");
  const cotizacionInfo = cotizacion?.clave === fecha ? cotizacion.texto : undefined;
  const cotizando = hayEnPesos && !!fecha && !cotizacionInfo;

  const medioPagoItems = Object.fromEntries([
    ["", "Sin especificar"],
    ...mediosPago.map((mp) => [mp.id, mp.nombre]),
  ]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setError(undefined);
      setFecha(hoyISO());
      setMedioPagoId("");
      setTipoCambio("");
      setDescripcion("");
      // Precargado con el saldo: pagar la factura entera, que es lo habitual,
      // no debería pedir escribir nada.
      setMontos(Object.fromEntries(facturas.map((f) => [f.id, formatMontoInicial(f.saldo)])));
    }
  };

  // El cambio del día, para poder ver en dólares los gastos en pesos que se
  // generen. Mismo criterio que el diálogo de gastos.
  useEffect(() => {
    if (!open || !hayEnPesos || !fecha) return;
    let cancelado = false;
    obtenerCotizacionDolarBlue(fecha).then((cot) => {
      if (cancelado) return;
      if (cot) {
        setTipoCambio(String(cot.venta));
        setCotizacion({
          clave: fecha,
          texto: `Dólar blue (venta) del ${fecha.split("-").reverse().join("/")}: $${cot.venta}`,
        });
      } else {
        setCotizacion({
          clave: fecha,
          texto: "No se encontró la cotización de esa fecha. Ingresá el tipo de cambio a mano.",
        });
      }
    });
    return () => {
      cancelado = true;
    };
  }, [open, hayEnPesos, fecha]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    const items = facturas.map((f) => ({
      facturaId: f.id,
      monto: parseMontoTexto(montos[f.id] ?? ""),
      factura: f,
    }));

    if (items.some((i) => !i.monto || i.monto <= 0)) {
      setError("Todos los montos tienen que ser mayores a 0.");
      return;
    }
    // Se avisa pero no se bloquea: puede haber un pago con intereses o una
    // diferencia de redondeo, y el que carga sabe mejor que la pantalla.
    const excedido = items.find((i) => i.monto > i.factura.saldo + 0.01);
    if (excedido) {
      const seguir = window.confirm(
        `El monto de la factura ${excedido.factura.numero} supera su saldo de ` +
          `${formatMontoMoneda(excedido.factura.saldo, excedido.factura.moneda)}. ¿Guardar igual?`
      );
      if (!seguir) return;
    }

    const cambio = tipoCambio ? Number(tipoCambio) : undefined;

    startTransition(async () => {
      const result = await registrarPagoFacturas({
        proyectoId,
        fecha,
        medioPagoId: medioPagoId || undefined,
        tipoCambio: cambio && cambio > 0 ? cambio : undefined,
        descripcion: descripcion || undefined,
        facturas: items.map((i) => ({ facturaId: i.facturaId, monto: i.monto })),
      });

      if (!result.success) {
        setError(result.error);
        return;
      }
      onPagado(result.facturas);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      {/* Más ancho que el diálogo por defecto: cada renglón de factura lleva el
          proveedor y el número a la izquierda y el monto a la derecha, y a
          384px el nombre del proveedor queda cortado en dos letras. */}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {facturas.length === 1
              ? "Registrar pago"
              : `Registrar pago de ${facturas.length} facturas`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pago-fecha">Fecha del pago</Label>
              <Input
                id="pago-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pago-medio">Medio de pago</Label>
              {mediosPago.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Todavía no hay medios de pago cargados en este proyecto. Cargalos en
                  &quot;Datos del proyecto&quot;.
                </p>
              ) : (
                <Select
                  value={medioPagoId}
                  onValueChange={(value) => setMedioPagoId(String(value))}
                  items={medioPagoItems}
                >
                  <SelectTrigger id="pago-medio" className="w-full">
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
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Facturas a pagar</Label>
            <div className="flex flex-col gap-3 rounded-md border p-3">
              {facturas.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.proveedorNombre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {f.numero} · saldo {formatMontoMoneda(f.saldo, f.moneda)}
                    </p>
                  </div>
                  <div className="flex w-40 shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">{f.moneda}</span>
                    <Input
                      inputMode="decimal"
                      placeholder="—"
                      aria-label={`Monto a pagar de la factura ${f.numero}`}
                      value={montos[f.id] ?? ""}
                      onChange={(e) =>
                        setMontos((prev) => ({
                          ...prev,
                          [f.id]: formatMontoWhileTyping(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Viene cargado el saldo de cada una. Bajalo para registrar un pago parcial: la
              factura queda pendiente por la diferencia.
            </p>
          </div>

          {hayEnPesos && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="pago-tipoCambio">Tipo de cambio</Label>
              <Input
                id="pago-tipoCambio"
                type="number"
                step="0.01"
                min="0"
                placeholder="—"
                value={tipoCambio}
                onChange={(e) => setTipoCambio(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {cotizando
                  ? "Buscando la cotización del dólar blue para esa fecha…"
                  : (cotizacionInfo ??
                    "Se copia a los gastos en pesos que se generen, para poder verlos en dólares.")}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="pago-descripcion">Descripción (opcional)</Label>
            <Input
              id="pago-descripcion"
              placeholder="Se completa sola con el número de factura y el proveedor"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending
                ? "Guardando..."
                : facturas.length === 1
                  ? "Registrar pago"
                  : `Registrar ${facturas.length} pagos`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
