import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next.js limita el body de las Server Actions a 1MB por defecto.
      // Los archivos adjuntos (trámites municipales, comprobantes, planos, pedidos)
      // suelen superar eso (fotos de celular, PDFs escaneados), lo que provoca
      // que el request sea rechazado y el navegador muestre un error genérico
      // de carga de página. Lo subimos a 4mb, quedando por debajo del límite
      // duro de ~4.5MB que impone la plataforma de Vercel para funciones serverless.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
