import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Farmácia Hospitalar | Simulador Longitudinal",
  description: "Plataforma educacional para acompanhamento farmacoterapêutico longitudinal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
