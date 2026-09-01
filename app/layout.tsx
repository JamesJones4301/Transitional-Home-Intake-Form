import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ashrei Impact Foundation | Resident Care Portal',
  description: 'A resident care workspace for Ashrei Impact Foundation.',
  openGraph: {
    title: 'Ashrei Impact Foundation',
    description: 'Resident care, coordinated with dignity.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Ashrei Impact Foundation' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ashrei Impact Foundation',
    description: 'Resident care, coordinated with dignity.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

