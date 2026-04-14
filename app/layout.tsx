import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "CraveNudge | AI-Powered Healthy Eating",
  description: "CraveNudge uses AI and behavioral science to guide you towards healthier food choices based on your personal fitness goals.",
  keywords: "health, AI, nutrition, fitness, diet tracking, nudges, CraveNudge",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`\${inter.variable} min-h-screen flex flex-col`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
