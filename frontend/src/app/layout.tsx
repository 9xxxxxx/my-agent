import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

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
    <html lang="zh-CN" className="h-[100dvh]" suppressHydrationWarning>
      <body className="h-[100dvh] bg-background text-foreground antialiased overscroll-none">
        {children}
        <Toaster position="top-center" richColors toastOptions={{ style: { borderRadius: "12px", fontSize: "14px" } }} />
      </body>
    </html>
  );
}
