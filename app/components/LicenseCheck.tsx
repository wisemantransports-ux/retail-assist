'use client';

import { useEffect, useState } from 'react';

export default function LicenseCheck({ children }: { children: React.ReactNode }) {
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    checkLicenseStatus();
  }, []);

  const checkLicenseStatus = async () => {
    try {
      const res = await fetch('/api/license');
      const data = await res.json();
      setLicensed(data.valid);
      if (!data.valid) {
        setMessage(data.message || 'Unlicensed installation');
      }
    } catch (error) {
      setLicensed(true);
    }
  };

  if (licensed === null) {
    return null;
  }

  if (!licensed) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-center py-2 px-4 z-50 font-medium">
          {message}
        </div>
        <div className="pt-10">
          {children}
        </div>
      </>
    );
  }

  return <>{children}</>;
}
