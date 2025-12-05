import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  chainId: number | null;
  signer: ethers.JsonRpcSigner | null;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    chainId: null,
    signer: null
  });

  const connect = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      alert('Please install MetaMask!');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      setWallet({
        address,
        isConnected: true,
        chainId: Number(network.chainId),
        signer
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
        (window as any).ethereum.on('accountsChanged', () => {
            window.location.reload();
        });
        (window as any).ethereum.on('chainChanged', () => {
            window.location.reload();
        });
    }
  }, []);

  return { ...wallet, connect };
}

