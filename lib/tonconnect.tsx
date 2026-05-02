'use client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { ReactNode } from 'react';

export function TONProvider({ children }: { children: ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl="https://raw.githubusercontent.com/ton-connect/manifest-demo/main/tonconnect-manifest.json">
      {children}
    </TonConnectUIProvider>
  );
}
