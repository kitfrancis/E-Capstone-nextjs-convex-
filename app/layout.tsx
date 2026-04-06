import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { SyncUser } from "@/components/SyncUsers";
import ThemeProviderWrapper from "@/components/ui/ThemeProviderWrapper";
import { ThemeToggle } from "@/components/ui/theme-provider";
import "./globals.css";

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
          <ThemeProviderWrapper>
            <div className="fixed top-20 right-4 z-50">
              <ThemeToggle />
            </div>
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