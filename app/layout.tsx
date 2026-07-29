import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEMOBICN IA | Informações Topográficas",
  description:
    "Análise de croquis e geração padronizada de Informações Topográficas.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
