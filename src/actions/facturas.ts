"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import {
  FacturaSchema,
  RegistrarPagoFacturasSchema,
  type FacturaInput,
  type RegistrarPagoFacturasInput,
} from "@/lib/validations/factura";
import { facturaInclude, mapFactura, type FacturaOpcion } from "@/lib/facturas";

export type FacturaActionResult =
  | { success: true; factura: FacturaOpcion }
  | { success: false; error: string };

export type PagoFacturasActionResult =
  | { success: true; facturas: FacturaOpcion[] }
  | { success: false; error: string };

/**
 * Las fechas de factura se guardan al mediodía UTC, igual que la fecha de
 * inicio de obra: así ningún huso las corre de día al viajar al navegador.
 */
function aFechaUTC(dia: string) {
  return new Date(`${dia}T12:00:00.000Z`);
}

/**
 * Refresca la obra y, además, la pantalla de cada pedido tocado.
 *
 * Los pedidos se revalidan de a uno porque la pantalla de un pedido muestra su
 * factura, y al vincularlo o desvincularlo esa pantalla queda mintiendo. Se
 * pasan los ids de antes y los de después: al editar, los que salieron de la
 * factura también cambiaron.
 */
function refrescar(proyectoId: string, pedidoIds: string[]) {
  revalidatePath(`/proyectos/${proyectoId}`);
  for (const pedidoId of new Set(pedidoIds)) {
    revalidatePath(`/pedidos/${pedidoId}`);
  }
}

async function subirComprobante(archivo?: File) {
  if (!archivo || archivo.size === 0) return undefined;
  const blob = await put(`facturas/${crypto.randomUUID()}-${archivo.name}`, archivo, {
    access: "public",
  });
  return blob.url;
}

/**
 * Traduce los errores de Prisma que el usuario puede provocar sin hacer nada
 * raro. El único acá es repetir el número de factura de un mismo proveedor,
 * que la base rechaza por el índice único: sin esto llegaría a pantalla el
 * texto crudo de la restricción.
 */
function mensajeDeError(e: unknown, fallback: string) {
  if (e instanceof Error && e.message.includes("proveedorId")) {
    return "Ya hay una factura con ese número para ese proveedor.";
  }
  return e instanceof Error ? e.message : fallback;
}

export async function createFactura(
  input: FacturaInput,
  archivo?: File
): Promise<FacturaActionResult> {
  await requireSeccion("flujo-fondos");

  const validated = FacturaSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = validated.data;

  const archivoUrl = await subirComprobante(archivo);

  try {
    const factura = await prisma.factura.create({
      data: {
        proyectoId: data.proyectoId,
        proveedorId: data.proveedorId,
        numero: data.numero,
        fecha: aFechaUTC(data.fecha),
        fechaVencimiento: data.fechaVencimiento ? aFechaUTC(data.fechaVencimiento) : null,
        monto: data.monto,
        moneda: data.moneda,
        tipoCambio: data.tipoCambio,
        rubroId: data.rubroId,
        subrubroId: data.subrubroId || undefined,
        notas: data.notas,
        archivoUrl,
        // Los pedidos que respalda. `connect` y no `set` porque al crear no hay
        // nada de qué desvincular.
        pedidos: { connect: data.pedidoIds.map((id) => ({ id })) },
      },
      include: facturaInclude,
    });

    refrescar(data.proyectoId, data.pedidoIds);
    return { success: true, factura: mapFactura(factura) };
  } catch (e) {
    return { success: false, error: mensajeDeError(e, "No se pudo crear la factura.") };
  }
}

export async function updateFactura(
  id: string,
  input: FacturaInput,
  archivo?: File,
  quitarArchivo?: boolean
): Promise<FacturaActionResult> {
  await requireSeccion("flujo-fondos");

  const validated = FacturaSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = validated.data;

  // Los pedidos que tenía antes, para poder refrescar también las pantallas de
  // los que queden afuera con esta edición.
  const previos = await prisma.pedido.findMany({
    where: { facturaId: id },
    select: { id: true },
  });

  const subido = await subirComprobante(archivo);
  // Subir uno nuevo gana sobre el tilde de "quitar": si marcó los dos, lo que
  // quiso fue reemplazarlo.
  const archivoUrl = subido ?? (quitarArchivo ? null : undefined);

  try {
    const factura = await prisma.factura.update({
      where: { id },
      data: {
        proyectoId: data.proyectoId,
        proveedorId: data.proveedorId,
        numero: data.numero,
        fecha: aFechaUTC(data.fecha),
        fechaVencimiento: data.fechaVencimiento ? aFechaUTC(data.fechaVencimiento) : null,
        monto: data.monto,
        moneda: data.moneda,
        tipoCambio: data.tipoCambio ?? null,
        rubroId: data.rubroId,
        subrubroId: data.subrubroId || null,
        notas: data.notas,
        ...(archivoUrl !== undefined ? { archivoUrl } : {}),
        // `set` y no `connect`: la lista que llega es la definitiva, así que a
        // los pedidos que salieron hay que soltarlos.
        pedidos: { set: data.pedidoIds.map((pedidoId) => ({ id: pedidoId })) },
      },
      include: facturaInclude,
    });

    refrescar(data.proyectoId, [...previos.map((p) => p.id), ...data.pedidoIds]);
    return { success: true, factura: mapFactura(factura) };
  } catch (e) {
    return { success: false, error: mensajeDeError(e, "No se pudo actualizar la factura.") };
  }
}

/**
 * Borra la factura.
 *
 * Los pagos que ya se le hicieron NO se borran: son gastos reales, la plata
 * salió. Quedan sueltos, como cualquier gasto cargado a mano (el `onDelete:
 * SetNull` del esquema). Lo mismo con los pedidos que respaldaba: vuelven a
 * quedar sin factura, intactos.
 */
export async function deleteFactura(id: string): Promise<{ error?: string; success?: boolean }> {
  await requireSeccion("flujo-fondos");

  try {
    const pedidos = await prisma.pedido.findMany({ where: { facturaId: id }, select: { id: true } });
    const factura = await prisma.factura.delete({ where: { id } });
    refrescar(
      factura.proyectoId,
      pedidos.map((p) => p.id)
    );
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo borrar la factura." };
  }
}

/**
 * Paga un conjunto de facturas: genera un gasto por cada una.
 *
 * Uno por factura y no uno solo agrupado porque el gasto es el que lleva el
 * rubro, y dos facturas del mismo pago pueden ser de rubros distintos (una de
 * ventanas es Carpinterías, una de hierro es Estructura). Un movimiento único
 * no podría tener rubro y rompería en silencio el análisis por rubro, el costo
 * por m² y la comparación contra el presupuesto.
 *
 * Cada gasto hereda proveedor, rubro, subrubro y moneda de su factura; la fecha
 * y el medio de pago son del pago entero y se cargan una sola vez.
 */
export async function registrarPagoFacturas(
  input: RegistrarPagoFacturasInput
): Promise<PagoFacturasActionResult> {
  await requireSeccion("flujo-fondos");

  const validated = RegistrarPagoFacturasSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = validated.data;

  const ids = data.facturas.map((f) => f.facturaId);
  const facturas = await prisma.factura.findMany({
    where: { id: { in: ids }, proyectoId: data.proyectoId },
    include: { proveedor: { select: { nombre: true } } },
  });

  if (facturas.length !== ids.length) {
    return { success: false, error: "Alguna de las facturas ya no existe. Recargá la página." };
  }

  try {
    await prisma.$transaction(
      data.facturas.map((pago) => {
        const factura = facturas.find((f) => f.id === pago.facturaId)!;
        return prisma.movimientoFondo.create({
          data: {
            proyectoId: factura.proyectoId,
            tipo: "GASTO",
            // Igual que el resto de los movimientos, que se guardan con la fecha
            // cruda del formulario.
            fecha: new Date(data.fecha),
            descripcion:
              data.descripcion || `Pago factura ${factura.numero} - ${factura.proveedor.nombre}`,
            monto: pago.monto,
            moneda: factura.moneda,
            // El cambio del día para las de pesos. Si el pago no trajo uno, se
            // usa el que tenía cargado la factura.
            tipoCambio:
              factura.moneda === "ARS"
                ? (data.tipoCambio ?? (factura.tipoCambio ? Number(factura.tipoCambio) : undefined))
                : undefined,
            medioPagoId: data.medioPagoId || undefined,
            rubroId: factura.rubroId,
            subrubroId: factura.subrubroId ?? undefined,
            proveedorId: factura.proveedorId,
            facturaId: factura.id,
          },
        });
      })
    );

    const actualizadas = await prisma.factura.findMany({
      where: { id: { in: ids } },
      include: facturaInclude,
    });

    refrescar(
      data.proyectoId,
      actualizadas.flatMap((f) => f.pedidos.map((p) => p.id))
    );
    return { success: true, facturas: actualizadas.map(mapFactura) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo registrar el pago.",
    };
  }
}
