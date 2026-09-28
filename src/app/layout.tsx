import type { Metadata } from "next";
import { Fragment_Mono, Libre_Franklin, Mrs_Saint_Delafield, Source_Serif_4 } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const libreFranklin = Libre_Franklin({
  variable: "--font-libre-franklin",
  subsets: ["latin"],
  weight: ["400", "500", "600", "800"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const fragmentMono = Fragment_Mono({
  variable: "--font-fragment-mono",
  subsets: ["latin"],
  weight: ["400"],
});

const saintDelafield = Mrs_Saint_Delafield({
  variable: "--font-saint-delafield",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Countersign",
  description: "A payment firewall for AI agents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${libreFranklin.variable} ${sourceSerif.variable} ${fragmentMono.variable} ${saintDelafield.variable} h-full antialiased`}
    >
      <body className="h-full">
        <TooltipProvider delay={150}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
