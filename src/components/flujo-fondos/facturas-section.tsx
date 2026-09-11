"use client";

import { useState } from "react";
import { FileText, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  FacturaDialog,
  type PedidoFacturaOpcion,
  type ProveedorFacturaOpcion,
  type RubroFacturaOpcion,
} from "@/components/flujo-fondos/factura-dialog";
import { PagoFacturasDialog } from "@/components/flujo-fondos/pago-facturas-dialog";
import {
  ArchivoMensualPanel,
  type PapelArchivado,
} from "@/components/flujo-fondos/archivo-mensual-panel";
import type { MedioPagoOpcion, MovimientoFondoOpcion } from "@/lib/flujo-fondos";
import {
  TRAMOS_ORDENADOS,
  TRAMO_LABELS,
  estaPendiente,
  tramoVencimiento,
  type FacturaOpcion,
  type TramoVencimiento,
} from "@/lib/facturas";
import { cn, formatFecha, formatMontoMoneda, formatNumeroPedido } from "@/lib/utils";

/**
 * Lo que falta pagar, una cifra por moneda y sin convertir nada.
 *
 * Se debe en la moneda en la que está la factura: el proveedor en pesos cobra
 * pesos. Pasar todo a dólares con la cotización de hoy inventa un número que
 * nadie va a pagar, y encima deja afuera a las facturas en pesos sin tipo de
 * cambio cargado. Las monedas sin deuda no se listan.
 */
function totalesPorMoneda(facturas: FacturaOpcion[]) {
  return (["ARS", "USD"] as const)
    .map((moneda) => ({
      moneda,
      total: facturas.filter((f) => f.moneda === moneda).reduce((acc, f) => acc + f.saldo, 0),
    }))
    .filter((t) => t.total > 0.01);
}

/** Solo el tramo vencido pinta en rojo: lo demás todavía no es un problema. */
const TRAMO_CLASES: Record<TramoVencimiento, string> = {
  VENCIDA: "text-error",
  ESTA_SEMANA: "text-foreground",
  ESTE_MES: "text-muted-foreground",
  MAS_ADELANTE: "text-muted-foreground",
  SIN_FECHA: "text-muted-foreground",
};

/**
 * Las facturas de la obra: lo que se debe, agrupado por cuánto aprieta.
 *
 * Es la solapa que responde "¿cuánto debo?", que hasta ahora no tenía respuesta
 * en ningún lado: el módulo sabía lo que ya se había gastado, nunca lo que
 * faltaba pagar.
 *
 * Ojo con la tentación de sumar las facturas al total gastado del proyecto: la
 * factura no es un gasto, el gasto es el pago que la cancela. Contar las dos
 * cosas duplicaría cada peso del resumen.
 */
export function FacturasSection({
  proyectoId,
  facturas,
  rubros,
  proveedores,
  pedidos,
  mediosPago,
  gastos,
  hoy,
}: {
  proyectoId: string;
  facturas: FacturaOpcion[];
  rubros: RubroFacturaOpcion[];
  proveedores: ProveedorFacturaOpcion[];
  pedidos: PedidoFacturaOpcion[];
  mediosPago: MedioPagoOpcion[];
  /** Solo para el archivo del mes: de acá salen los comprobantes y las facturas adjuntas. */
  gastos: MovimientoFondoOpcion[];
  /** "AAAA-MM-DD" calculado en el servidor. Ver `diaHoyArgentina`. */
  hoy: string;
}) {
  const [items, setItems] = useState(facturas);
  const [prevFacturas, setPrevFacturas] = useState(facturas);
  if (facturas !== prevFacturas) {
    setPrevFacturas(facturas);
    setItems(facturas);
  }

  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const [verPagadas, setVerPagadas] = useState(false);

  const handleSaved = (factura: FacturaOpcion) => {
    setItems((prev) => {
      const existe = prev.some((f) => f.id === factura.id);
      return existe ? prev.map((f) => (f.id === factura.id ? factura : f)) : [...prev, factura];
    });
  };

  const handleDeleted = (id: string) => {
    setItems((prev) => prev.filter((f) => f.id !== id));
    setSeleccionadas((prev) => prev.filter((s) => s !== id));
  };

  const handlePagado = (actualizadas: FacturaOpcion[]) => {
    setItems((prev) => prev.map((f) => actualizadas.find((a) => a.id === f.id) ?? f));
    // Se limpia la selección: las que se pagaron enteras ya no están en la
    // lista de pendientes y dejar tildadas las parciales invita a pagarlas dos
    // veces sin querer.
    setSeleccionadas([]);
  };

  const pendientes = items.filter(estaPendiente);
  const pagadas = items.filter((f) => !estaPendiente(f));
  const deudas = totalesPorMoneda(pendientes);

  const elegidas = pendientes.filter((f) => seleccionadas.includes(f.id));

  const toggle = (id: string) =>
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const grupos = TRAMOS_ORDENADOS.map((tramo) => ({
    tramo,
    facturas: pendientes
      .filter((f) => tramoVencimiento(f, hoy) === tramo)
      // Dentro del grupo, primero lo que vence antes. Las sin fecha, por
      // proveedor, que es lo único con lo que se las puede buscar.
      .sort((a, b) =>
        a.fechaVencimiento && b.fechaVencimiento
          ? a.fechaVencimiento.localeCompare(b.fechaVencimiento)
          : a.proveedorNombre.localeCompare(b.proveedorNombre)
      ),
  })).filter((g) => g.facturas.length > 0);

  // Los papeles para el archivo de abajo. El comprobante sale del gasto, y la
  // factura puede venir de dos lados: adjunta al gasto o cargada como factura
  // acá. Para archivar son lo mismo —una factura es una factura— así que van
  // las dos a la misma pila, sin distinguir de dónde salieron.
  const comprobantes: PapelArchivado[] = gastos.flatMap((g) =>
    g.archivoUrl
      ? [{ fecha: g.fecha, url: g.archivoUrl, nombre: g.proveedorNombre ?? g.descripcion }]
      : []
  );
  const papelesFactura: PapelArchivado[] = [
    ...gastos.flatMap((g) =>
      g.facturaUrl
        ? [{ fecha: g.fecha, url: g.facturaUrl, nombre: g.proveedorNombre ?? g.descripcion }]
        : []
    ),
    ...items.flatMap((f) =>
      f.archivoUrl
        ? [{ fecha: f.fecha, url: f.archivoUrl, nombre: `${f.proveedorNombre} ${f.numero}` }]
        : []
    ),
  ];

  const nuevaFacturaTrigger = (
    <Button>
      <Plus />
      Nueva factura
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border p-4">
        <div>
          <p className="text-xs text-muted-foreground">Deuda pendiente</p>
          {deudas.length === 0 ? (
            <p className="text-2xl font-semibold tabular-nums text-muted-foreground">—</p>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              {deudas.map((d) => (
                <p key={d.moneda} className="text-2xl font-semibold tabular-nums">
                  {formatMontoMoneda(d.total, d.moneda)}
                </p>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {pendientes.length === 0
              ? "Sin facturas pendientes"
              : `${pendientes.length} ${pendientes.length === 1 ? "factura pendiente" : "facturas pendientes"}`}
          </p>
        </div>
        <FacturaDialog
          proyectoId={proyectoId}
          rubros={rubros}
          proveedores={proveedores}
          pedidos={pedidos}
          trigger={nuevaFacturaTrigger}
          onSaved={handleSaved}
        />
      </div>

      {elegidas.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm">
            {elegidas.length} {elegidas.length === 1 ? "factura elegida" : "facturas elegidas"}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSeleccionadas([])}>
              Limpiar
            </Button>
            <PagoFacturasDialog
              proyectoId={proyectoId}
              facturas={elegidas}
              mediosPago={mediosPago}
              trigger={<Button>Registrar pago</Button>}
              onPagado={handlePagado}
            />
          </div>
        </div>
      )}

      {pendientes.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          No hay facturas pendientes de pago en esta obra. Cargá una desde acá o desde la pantalla
          de un pedido.
        </div>
      ) : (
        grupos.map((grupo) => (
          <div key={grupo.tramo} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className={cn("text-sm font-medium", TRAMO_CLASES[grupo.tramo])}>
                {TRAMO_LABELS[grupo.tramo]}
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {totalesPorMoneda(grupo.facturas)
                  .map((t) => formatMontoMoneda(t.total, t.moneda))
                  .join(" · ")}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {grupo.facturas.map((f) => (
                <FacturaFila
                  key={f.id}
                  factura={f}
                  seleccionada={seleccionadas.includes(f.id)}
                  onToggle={() => toggle(f.id)}
                  proyectoId={proyectoId}
                  rubros={rubros}
                  proveedores={proveedores}
                  pedidos={pedidos}
                  onSaved={handleSaved}
                  onDeleted={handleDeleted}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {pagadas.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setVerPagadas((v) => !v)}
            className="self-start text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            {verPagadas ? "Ocultar" : "Ver"} facturas pagadas ({pagadas.length})
          </button>
          {verPagadas && (
            <div className="flex flex-col gap-2">
              {pagadas.map((f) => (
                <FacturaFila
                  key={f.id}
                  factura={f}
                  proyectoId={proyectoId}
                  rubros={rubros}
                  proveedores={proveedores}
                  pedidos={pedidos}
                  onSaved={handleSaved}
                  onDeleted={handleDeleted}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <ArchivoMensualPanel comprobantes={comprobantes} facturas={papelesFactura} />
    </div>
  );
}

/**
 * Una factura de la lista.
 *
 * La edición se abre con su propio botón y no haciendo click en el renglón
 * entero, como en el resto de las listas del módulo: el renglón ya tiene
 * adentro el checkbox para elegirla y el link al archivo, y meter todo eso
 * dentro de un botón deja controles anidados que se pisan entre sí.
 */
function FacturaFila({
  factura,
  seleccionada,
  onToggle,
  proyectoId,
  rubros,
  proveedores,
  pedidos,
  onSaved,
  onDeleted,
}: {
  factura: FacturaOpcion;
  /** Sin esto (las pagadas) no se dibuja el checkbox: no hay nada que pagar. */
  seleccionada?: boolean;
  onToggle?: () => void;
  proyectoId: string;
  rubros: RubroFacturaOpcion[];
  proveedores: ProveedorFacturaOpcion[];
  pedidos: PedidoFacturaOpcion[];
  onSaved: (factura: FacturaOpcion) => void;
  onDeleted: (id: string) => void;
}) {
  const pagada = !estaPendiente(factura);
  const parcial = factura.pagado > 0 && !pagada;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-md border p-3 text-left",
        pagada && "opacity-70"
      )}
    >
      {onToggle && (
        <Checkbox
          checked={seleccionada}
          onCheckedChange={onToggle}
          aria-label={`Elegir la factura ${factura.numero}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{factura.proveedorNombre}</span>
          <span className="truncate text-xs text-muted-foreground">{factura.numero}</span>
          {pagada && <Badge variant="outline">Pagada</Badge>}
          {parcial && <Badge variant="secondary">Pago parcial</Badge>}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {factura.rubroNombre}
          {factura.subrubroNombre && ` · ${factura.subrubroNombre}`}
          {factura.fechaVencimiento
            ? // `formatFecha` lee el día en UTC, así que un "AAAA-MM-DD" pelado
              // no se corre de día al formatearse.
              ` · vence ${formatFecha(factura.fechaVencimiento)}`
            : " · sin vencimiento"}
          {factura.pedidos.length > 0 &&
            ` · ${factura.pedidos.map((p) => `#${formatNumeroPedido(p.numero)}`).join(", ")}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-medium tabular-nums">
          {formatMontoMoneda(pagada ? factura.monto : factura.saldo, factura.moneda)}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {pagada
            ? "pagada"
            : parcial
              ? `de ${formatMontoMoneda(factura.monto, factura.moneda)}`
              : "a pagar"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {factura.archivoUrl && (
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            aria-label={`Ver el archivo de la factura ${factura.numero}`}
            render={
              <a href={factura.archivoUrl} target="_blank" rel="noopener noreferrer">
                <FileText />
              </a>
            }
          />
        )}
        <FacturaDialog
          proyectoId={proyectoId}
          rubros={rubros}
          proveedores={proveedores}
          pedidos={pedidos}
          item={factura}
          trigger={
            <Button variant="outline" size="sm" aria-label={`Editar la factura ${factura.numero}`}>
              <Pencil />
            </Button>
          }
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  );
}
