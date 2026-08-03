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
        <div className="mx-auto max-w-5xl p-4 md:p-8">{children}</div>
      </main>
      <MobileNav esAdmin={session.esAdmin} paginasPermitidas={session.paginasPermitidas} />
    </div>
  );
}
