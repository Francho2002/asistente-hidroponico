import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Raíz — Asistente hidropónico",
    template: "%s · Raíz",
  },
  description:
    "Seguimiento local-first para cultivar con contexto, tareas, alertas e historial, sin depender de una cuenta ni de un servidor.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Raíz — Asistente hidropónico local-first",
    description: "Seguimiento, alertas, historial y orientación contextual para todo el ciclo de cultivo.",
    type: "website",
    locale: "es_AR",
    images: [{ url: "/og.png", width: 1730, height: 909, alt: "Cuatro DWC independientes acompañados por el asistente Raíz" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Raíz — Asistente hidropónico local-first",
    description: "Tus datos, tareas y alertas de cultivo permanecen bajo tu control.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
