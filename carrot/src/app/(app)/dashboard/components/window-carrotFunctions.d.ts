declare global {
  interface Window {
    carrotFunctions?: {
      httpsCallable: (name: string) => any;
    };
  }
}

export {};
