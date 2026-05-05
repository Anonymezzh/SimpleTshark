import { createContext } from 'react';

export const GlobalContext = createContext<{
  lang?: string;
  setLang?: (value: string) => void;
  theme?: string;
  setTheme?: (value: string) => void;
  background?: string;
  setBackground?: (value: string) => void;
}>({});
