import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { SyncUser } from "@/components/SyncUsers";
import ThemeProviderWrapper from "@/components/ui/ThemeProviderWrapper";
import "./globals.css";
import { ThemeToggle } from "@/components/ui/theme-provider";

export const metadata: Metadata = {
  title: "E-capstone",
  description: "Thesis Management System for Students, Instructors, and Advisers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className="min-h-full flex flex-col">
          <div className="fixed top-4 right-4 z-50">
            <ThemeToggle />
          </div>
          <ThemeProviderWrapper>
            <ConvexClientProvider>
              <SyncUser />
              <main>
                {children}
              </main>
            </ConvexClientProvider>
          </ThemeProviderWrapper>
        </body>
      </html>
    </ClerkProvider>
  );
}