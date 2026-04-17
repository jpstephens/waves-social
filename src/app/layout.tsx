import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Waves Press Box",
  description: "Post-game highlights for the Waves 8U.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#22d3ee",
          colorBackground: "#0f2337",
          colorText: "#fafaf9",
          colorInputBackground: "#0a1929",
          colorInputText: "#fafaf9",
          borderRadius: "0.5rem",
        },
      }}
    >
      <html lang="en" className="h-full antialiased">
        <body className="min-h-full flex flex-col bg-navy-950 text-white">
          {children}
          <Toaster richColors theme="dark" position="top-right" />
        </body>
      </html>
    </ClerkProvider>
  );
}
