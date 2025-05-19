import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/context/AuthContext';
import ConsoleWarningSuppressor from '@/components/utils/ConsoleWarningSuppressor'; // Import the suppressor

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fiji",
  description: "Fiji",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
      </head>
      <body className={inter.className}>
        <ConsoleWarningSuppressor /> {/* Add the suppressor component here */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}