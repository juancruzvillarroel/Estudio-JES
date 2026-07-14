import { verifySession } from "@/lib/dal";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        nombre={session.nombre}
        esAdmin={session.esAdmin}
        paginasPermitidas={session.paginasPermitidas}
      />
      <main className="min-w-0 flex-1 pb-16 md:pb-0">
        <div className="mx-auto max-w-5xl p-4 md:p-8">{children}</div>
      </main>
      <MobileNav esAdmin={session.esAdmin} paginasPermitidas={session.paginasPermitidas} />
    </div>
  );
}
