import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { SyncUser } from "@/components/SyncUsers";
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
        <html
      lang="en"
    >
      <body className="min-h-full flex flex-col"><ConvexClientProvider><SyncUser /> {children}</ConvexClientProvider></body>
    </html>
    </ClerkProvider>
    
  );
}
