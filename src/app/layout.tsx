import type { Metadata, Viewport } from 'next';
import './globals.css';
import './expedition.css';
import './charges.css';
import './rovers.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://poly-vortex.oxog.dev'),
  title: 'POLY-VORTEX — Neon Protocol',
  description: 'One core. Infinite chaos. A procedural 3D roguelite bullet heaven. Survive the swarm, evolve your arsenal, break the protocol.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#080b0b' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
