import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Data Analyst Agent",
  description: "AI-powered data analysis assistant",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${jetbrainsMono.variable} h-[100dvh]`} suppressHydrationWarning>
      <body className="h-[100dvh] bg-background text-foreground antialiased overscroll-none">
        {children}
        <Toaster position="top-center" richColors toastOptions={{ style: { borderRadius: "12px", fontSize: "14px" } }} />
      </body>
    </html>
  );
}
