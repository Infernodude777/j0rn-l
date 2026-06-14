import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'J0rn@l — Your personal check engine light',
  description: 'A mental wellness companion that helps you identify long-term trends in sleep, mood, stress, journaling, social interaction, outdoor activity, and work/school pressure.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Caveat:wght@500;600;700&family=Changa+One&family=Kalam:wght@400;700&family=Lexend:wght@300;400;500;600;700&family=Nanum+Gothic:wght@400;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="bg-background text-on-background font-body-md antialiased">{children}</body>
    </html>
  );
}
