import type { Metadata } from "next";
import {
  Caveat,
  Hanken_Grotesk,
  Instrument_Serif,
  JetBrains_Mono,
  Source_Serif_4,
} from "next/font/google";
import { Providers } from "@/components/providers/providers";
import "./globals.css";

const sans = Hanken_Grotesk({ variable: "--font-sans", subsets: ["latin"] });
const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
const serif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin"] });
const hand = Caveat({ variable: "--font-hand", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Korasa", template: "%s · Korasa" },
  description: "A personal workspace for courses, projects and A4 notes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${serif.variable} ${hand.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
