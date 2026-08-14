import 'react';

declare module 'react' {
  function useRef<T>(initialValue: T): React.RefObject<T>;
  function useRef<T>(initialValue: T | null): React.RefObject<T | null>;
  function useRef<T = undefined>(): React.RefObject<T | undefined>;
}
