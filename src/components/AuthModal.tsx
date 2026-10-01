import React from 'react';
import { useStore } from '../context/StoreContext.js';
import { LoginPage } from './LoginPage.js';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, authMode } = useStore();

  if (!isAuthModalOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={() => setIsAuthModalOpen(false)}
    >
      <div 
        className="w-full max-w-md my-auto"
        onClick={e => e.stopPropagation()}
      >
        <LoginPage
          isModal={true}
          onClose={() => setIsAuthModalOpen(false)}
          initialMode={authMode}
        />
      </div>
    </div>
  );
};
