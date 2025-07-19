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
  title: "To-Do List App",
  description: "Uma aplicação simples de lista de tarefas para organizar suas atividades diárias.",
  keywords: "todo, tarefas, lista, organização, produtividade",
  authors: [{ name: "To-Do App" }],
  openGraph: {
    title: "To-Do List App",
    description: "Organize suas tarefas de forma simples e eficiente",
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
