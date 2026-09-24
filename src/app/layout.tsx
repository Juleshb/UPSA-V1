import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RUPSA NEXT | Securely powering education",
  description:
    "A secure digital ecosystem connecting schools, families and financial institutions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
