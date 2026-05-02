import { createContext, useContext, useState, useMemo, useCallback, ReactNode } from "react";

interface FilterContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  availableCategories: string[];
  setAvailableCategories: (categories: string[]) => void;
  hasTrendingMarkets: boolean;
  setHasTrendingMarkets: (v: boolean) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [availableCategories, setAvailableCategories] = useState<string[]>(["All"]);
  const [hasTrendingMarkets, setHasTrendingMarkets] = useState(false);

  const handleSetSearchQuery = useCallback((query: string) => setSearchQuery(query), []);
  const handleSetSelectedCategory = useCallback((category: string) => setSelectedCategory(category), []);
  const handleSetAvailableCategories = useCallback((categories: string[]) => setAvailableCategories(categories), []);
  const handleSetHasTrendingMarkets = useCallback((v: boolean) => setHasTrendingMarkets(v), []);

  const value = useMemo(() => ({
    searchQuery,
    setSearchQuery: handleSetSearchQuery,
    selectedCategory,
    setSelectedCategory: handleSetSelectedCategory,
    availableCategories,
    setAvailableCategories: handleSetAvailableCategories,
    hasTrendingMarkets,
    setHasTrendingMarkets: handleSetHasTrendingMarkets,
  }), [
    searchQuery,
    selectedCategory,
    availableCategories,
    hasTrendingMarkets,
    handleSetSearchQuery,
    handleSetSelectedCategory,
    handleSetAvailableCategories,
    handleSetHasTrendingMarkets,
  ]);

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error("useFilter must be used within a FilterProvider");
  }
  return context;
}
