import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const RUBRO_ELECTRICIDAD = "cmralcfj90007w0mcjdch48xr"; // 8_INSTALACIÓN_ELÉCTRICA
const RUBRO_PUERTAS = "cmralch9f000fw0mcqewd6qai"; // 16_PUERTAS_Y_ABERTURAS
const RUBRO_GAS_SANITARIA = "cmralcfbu0006w0mcxpm90xd9"; // 7_INSTALACIÓN_GAS_Y_SANITARIA

const RUBRO_POR_CATEGORIA: Record<string, string> = {
  ELECTRICIDAD: RUBRO_ELECTRICIDAD,
  "FERRETERÍA GRAL": RUBRO_ELECTRICIDAD,
  HERRAJERÍA: RUBRO_PUERTAS,
  ARTEFACTOS: RUBRO_GAS_SANITARIA,
  GAS: RUBRO_GAS_SANITARIA,
  SANITARIAS: RUBRO_GAS_SANITARIA,
};

type Item = { nombre: string; cantidad: number; categoria: string; unidad?: string };

const ITEMS: Item[] = [
  { nombre: "Bastidor 10X5 jeluz", cantidad: 413, categoria: "ELECTRICIDAD" },
  { nombre: "Bastidor 5X5 jeluz", cantidad: 10, categoria: "ELECTRICIDAD" },
  { nombre: "Batidor linea cambre", cantidad: 6, categoria: "ELECTRICIDAD" },
  { nombre: "Brazo OCB", cantidad: 10, categoria: "HERRAJERÍA" },
  { nombre: "cable unipolar 1X2.5mm x mts C/M va", cantidad: 300, categoria: "ELECTRICIDAD", unidad: "m" },
  { nombre: "Caja de pase 115x115x8", cantidad: 9, categoria: "FERRETERÍA GRAL" },
  { nombre: "Cerraduras de puertas principales", cantidad: 16, categoria: "HERRAJERÍA" },
  { nombre: "Codos de sigas ø32x1", cantidad: 7, categoria: "GAS" },
  { nombre: "Codos sigas 90 ø32", cantidad: 17, categoria: "GAS" },
  { nombre: "Conector", cantidad: 35, categoria: "ARTEFACTOS" },
  { nombre: "Conector grandes", cantidad: 38, categoria: "ARTEFACTOS" },
  { nombre: "Conector ø22mm", cantidad: 370, categoria: "ARTEFACTOS" },
  { nombre: "Contactor 18a 24v", cantidad: 2, categoria: "ELECTRICIDAD" },
  { nombre: "Control de nivel hermético", cantidad: 1, categoria: "ELECTRICIDAD" },
  { nombre: "fuente switching 3 amp", cantidad: 14, categoria: "ELECTRICIDAD" },
  { nombre: "Grampas ø2", cantidad: 15, categoria: "ARTEFACTOS" },
  { nombre: "Grapas ø32", cantidad: 20, categoria: "ARTEFACTOS" },
  { nombre: "Grifera de ducha de alta pared", cantidad: 17, categoria: "SANITARIAS" },
  { nombre: "Interruptor diferencial gralf", cantidad: 0, categoria: "ELECTRICIDAD" },
  { nombre: "Interruptor diferencial gralf 25", cantidad: 0, categoria: "ELECTRICIDAD" },
  { nombre: "Interruptor diferencial gralf 40", cantidad: 0, categoria: "ELECTRICIDAD" },
  { nombre: "Interruptor diferencial tetrapolar de 125", cantidad: 0, categoria: "ELECTRICIDAD" },
  { nombre: "Interruptor diferencial tetrapolar de 63", cantidad: 0, categoria: "ELECTRICIDAD" },
  { nombre: "Interruptor termomagnético simple 10", cantidad: 0, categoria: "ELECTRICIDAD" },
  { nombre: "Interruptor termomagnético simple 16", cantidad: 0, categoria: "ELECTRICIDAD" },
  { nombre: "Interruptor termomagnético simple 20", cantidad: 0, categoria: "ELECTRICIDAD" },
  { nombre: "Interruptor termomagnético simple 32", cantidad: 0, categoria: "ELECTRICIDAD" },
  { nombre: "Interruptor termomagnético tetrapolar 32", cantidad: 0, categoria: "ELECTRICIDAD" },
  { nombre: "Interruptor termomagnético tetrapolar 40", cantidad: 0, categoria: "ELECTRICIDAD" },
  { nombre: "Lampara 12w e27 luz calida", cantidad: 3, categoria: "ELECTRICIDAD" },
  { nombre: "Lámpara led 10W", cantidad: 6, categoria: "ELECTRICIDAD" },
  { nombre: "Lámpara luz cálida 7w", cantidad: 34, categoria: "ELECTRICIDAD" },
  { nombre: "Lampats dicroica gu10 7w 3k", cantidad: 7, categoria: "ELECTRICIDAD" },
  { nombre: "Llave commutadora monofasica 16a a panel", cantidad: 3, categoria: "ELECTRICIDAD" },
  { nombre: "Llaves de puertas placa", cantidad: 45, categoria: "HERRAJERÍA" },
  { nombre: "Luz de emergencia vigia 60 leds", cantidad: 22, categoria: "ELECTRICIDAD" },
  { nombre: "Manija recta doble balancín de acero inoxidable Brozen", cantidad: 42, categoria: "HERRAJERÍA" },
  { nombre: "Manijon y media manija de acero inoxidable Brozen", cantidad: 10, categoria: "HERRAJERÍA" },
  { nombre: "Mob. Punto combinado jeluz platinum blanco", cantidad: 64, categoria: "ELECTRICIDAD" },
  { nombre: "Mob. Punto jeluz platinum blanco", cantidad: 52, categoria: "ELECTRICIDAD" },
  { nombre: "Mob. Tapon ciego jeluz platinum blanco", cantidad: 431, categoria: "ELECTRICIDAD" },
  { nombre: "Mob. Toma doble jeluz platinum blanco", cantidad: 136, categoria: "ELECTRICIDAD" },
  { nombre: "Mob. Toma jeluz platinum blanco", cantidad: 110, categoria: "ELECTRICIDAD" },
  { nombre: "Mod. Pulsador jeluz platinum blanco", cantidad: 12, categoria: "ELECTRICIDAD" },
  { nombre: "ojo de buey 24v rojo led", cantidad: 2, categoria: "ELECTRICIDAD" },
  { nombre: "ojo de buey 24v verde led", cantidad: 2, categoria: "ELECTRICIDAD" },
  { nombre: "Plafon circular 18 w 3k marco acero", cantidad: 20, categoria: "ELECTRICIDAD" },
  { nombre: "Plafon circular 24 w 3k marco acero", cantidad: 6, categoria: "ELECTRICIDAD" },
  { nombre: "riel para tablero", cantidad: 0, categoria: "ELECTRICIDAD" },
  { nombre: "Rosca de conectores ø22 mm bolsa grande", cantidad: 195, categoria: "ARTEFACTOS" },
  { nombre: "Rosca de conectores ø22 mm bolsas chica", cantidad: 150, categoria: "ARTEFACTOS" },
  { nombre: "Sensor de mov. Emb jeluz platinum blanco", cantidad: 31, categoria: "ELECTRICIDAD" },
  { nombre: "Sensor de movimiento", cantidad: 3, categoria: "ELECTRICIDAD" },
  { nombre: "Sensor de movimiento tencho marco blanco", cantidad: 2, categoria: "ELECTRICIDAD" },
  { nombre: "spot semiembutido negro texturado gu10", cantidad: 7, categoria: "ELECTRICIDAD" },
  { nombre: "tablero exterior", cantidad: 0, categoria: "ELECTRICIDAD" },
  { nombre: "Tapa blanca 10X5 jeluz platinum", cantidad: 413, categoria: "ELECTRICIDAD" },
  { nombre: "Tapa blanca 5X5 jeluz platinum", cantidad: 10, categoria: "ELECTRICIDAD" },
  { nombre: "Tapa de tablero", cantidad: 1, categoria: "ELECTRICIDAD" },
  { nombre: "tapa doble", cantidad: 10, categoria: "ELECTRICIDAD" },
  { nombre: "Tapas de luz cambre", cantidad: 6, categoria: "ELECTRICIDAD" },
  { nombre: "Tapas de luz cambre chicas", cantidad: 3, categoria: "ELECTRICIDAD" },
  { nombre: "Tapas de luz cambre grande", cantidad: 1, categoria: "ELECTRICIDAD" },
  { nombre: "Tapas de luz jeluz", cantidad: 0, categoria: "ELECTRICIDAD" },
  { nombre: "Tapas de luz jeluz grande", cantidad: 1, categoria: "ELECTRICIDAD" },
  { nombre: "Tapas de luz kalop", cantidad: 1, categoria: "ELECTRICIDAD" },
  { nombre: "Timer digital diletta 2mod din", cantidad: 1, categoria: "ELECTRICIDAD" },
  { nombre: "tira de neon flex 12v luz calidad", cantidad: 1, categoria: "ELECTRICIDAD" },
  { nombre: "transformador 220/24v 30 ma", cantidad: 1, categoria: "ELECTRICIDAD" },
  { nombre: "Extractor de 4 pvc blanco Gralf", cantidad: 16, categoria: "SANITARIAS" },
  { nombre: "girferias de bidet FV Arizona", cantidad: 5, categoria: "SANITARIAS" },
  { nombre: "grifería de pileta de cocina FV arizona", cantidad: 1, categoria: "SANITARIAS" },
];

async function main() {
  if (ITEMS.length !== 72) {
    throw new Error(`Se esperaban 72 items, hay ${ITEMS.length}`);
  }

  const existentes = await prisma.material.findMany({ select: { id: true, nombre: true } });
  const existentesPorNombre = new Map(existentes.map((m) => [m.nombre.trim().toLowerCase(), m.id]));

  let creados = 0;
  let omitidos = 0;
  let movimientosCreados = 0;
  const porRubro: Record<string, number> = {};
  const fallidos: string[] = [];

  for (const item of ITEMS) {
    const rubroId = RUBRO_POR_CATEGORIA[item.categoria];
    if (!rubroId) {
      fallidos.push(`${item.nombre} (categoría desconocida: ${item.categoria})`);
      continue;
    }

    const key = item.nombre.trim().toLowerCase();
    if (existentesPorNombre.has(key)) {
      omitidos++;
      console.log(`OMITIDO (ya existe): ${item.nombre}`);
      continue;
    }

    const material = await prisma.material.create({
      data: {
        nombre: item.nombre,
        unidad: item.unidad ?? "unidad",
        rubroId,
      },
    });
    existentesPorNombre.set(key, material.id);
    creados++;
    porRubro[item.categoria] = (porRubro[item.categoria] ?? 0) + 1;

    if (item.cantidad > 0) {
      await prisma.inventarioMovimiento.create({
        data: {
          materialId: material.id,
          tipo: "ENTRADA",
          cantidad: item.cantidad,
          notas: "Carga inicial de inventario",
        },
      });
      movimientosCreados++;
    }
  }

  console.log("\n--- RESUMEN ---");
  console.log(`Materiales creados: ${creados}`);
  console.log(`Materiales omitidos (ya existían): ${omitidos}`);
  console.log(`Movimientos de entrada creados: ${movimientosCreados}`);
  console.log("Por categoría:", JSON.stringify(porRubro, null, 2));
  if (fallidos.length) {
    console.log("FALLIDOS:", fallidos);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
