import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Australian Home Loan Calculator",
  description: "Privacy-first borrowing power and cashflow modelling for Australian households."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
