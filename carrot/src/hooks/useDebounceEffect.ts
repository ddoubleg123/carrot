import { useEffect, useRef } from 'react';

export function useDebounceEffect(
  effect: () => void,
  deps: any[],
  delay: number
) {
  const effectRef = useRef(effect);
  
  // Update the effect ref if the effect changes
  useEffect(() => {
    effectRef.current = effect;
  }, [effect]);

  useEffect(() => {
    const handler = setTimeout(() => {
      effectRef.current();
    }, delay);

    return () => {
      clearTimeout(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}
