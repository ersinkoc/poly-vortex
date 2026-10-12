'use client';

import dynamic from 'next/dynamic';
const Hangar = dynamic(() => import('@/components/ship-hangar'), { ssr: false });
export default function HangarPage() { return <Hangar />; }
