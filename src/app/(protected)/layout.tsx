import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();
  const puedeVerProyectos = session.esAdmin || session.paginasPermitidas.includes("proyectos");
  const proyectos = puedeVerProyectos
    ? await prisma.proyecto.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } })
    : [];

  return (
    <div className="flex min-h-screen">
      <Sidebar
        nombre={session.nombre}
        esAdmin={session.esAdmin}
        paginasPermitidas={session.paginasPermitidas}
        proyectos={proyectos}
      />
      <main className="min-w-0 flex-1 pb-20 md:ml-56 md:pb-0">
        {/* Sin ancho máximo: el contenido usa toda la pantalla y el margen es
            solo el aire del padding, que crece con el viewport. Había un
            max-w-5xl acá que dejaba dos franjas blancas enormes en cualquier
            monitor grande, y las tablas anchas —flujo de fondos, presupuesto,
            cronograma— son justo las que más lugar necesitan. */}
        <div className="p-4 md:px-8 md:py-8 2xl:px-12">{children}</div>
      </main>
      <MobileNav esAdmin={session.esAdmin} paginasPermitidas={session.paginasPermitidas} />
    </div>
  );
}
