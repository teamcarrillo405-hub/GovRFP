import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { ChatWidget } from "@/components/chat/ChatWidget";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProposalAI — Government Proposal Writing",
  description: "AI-powered government proposal writing for contractors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
        <ChatWidget
          accentColor="#2F80FF"
          title="ProposalAI Assistant"
          subtitle="Ask about features, the workflow, or getting started"
          emptyText="Hi! Ask me anything about ProposalAI — how it works, the free trial, or writing proposals."
        />
      </body>
    </html>
  );
}
