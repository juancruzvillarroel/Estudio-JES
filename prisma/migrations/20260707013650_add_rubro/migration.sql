-- CreateTable
CREATE TABLE "Rubro" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rubro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProveedorToRubro" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProveedorToRubro_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rubro_nombre_key" ON "Rubro"("nombre");

-- CreateIndex
CREATE INDEX "_ProveedorToRubro_B_index" ON "_ProveedorToRubro"("B");

-- AddForeignKey
ALTER TABLE "_ProveedorToRubro" ADD CONSTRAINT "_ProveedorToRubro_A_fkey" FOREIGN KEY ("A") REFERENCES "Proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProveedorToRubro" ADD CONSTRAINT "_ProveedorToRubro_B_fkey" FOREIGN KEY ("B") REFERENCES "Rubro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
