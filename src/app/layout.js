import "./globals.css";
import "../styles/platform.css";
import { authAppearance } from "../components/ui/authAppearance";
import AppActivityIndicator from "../components/AppActivityIndicator";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "AskSocial",
  description: "Ask the internet. Understand the people behind it. AI-powered audience intelligence from across the open web.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider appearance={authAppearance}>
      <html lang="en">
        <body><AppActivityIndicator />{children}</body>
      </html>
    </ClerkProvider>
  );
}
