import { createContext } from 'react';

export const LayoutContext = createContext<{
  refreshLoading?: number;
  workStatus?: number
}>({});
