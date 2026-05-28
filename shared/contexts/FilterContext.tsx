import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from "react";

interface FilterContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  selectedSubcategory: string;
  setSelectedSubcategory: (subcategory: string) => void;
  availableCategories: string[];
  setAvailableCategories: (categories: string[]) => void;
  hasTrendingMarkets: boolean;
  setHasTrendingMarkets: (v: boolean) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSubcategory, setSelectedSubcategory] = useState("All");
  const [availableCategories, setAvailableCategories] = useState<string[]>([
    "All",
  ]);
  const [hasTrendingMarkets, setHasTrendingMarkets] = useState(false);

  const handleSetSearchQuery = useCallback(
    (query: string) => setSearchQuery(query),
    [],
  );
  const handleSetSelectedCategory = useCallback((category: string) => {
    setSelectedCategory(category);
    setSelectedSubcategory("All"); // reset subcategory when category changes
  }, []);
  const handleSetSelectedSubcategory = useCallback(
    (subcategory: string) => setSelectedSubcategory(subcategory),
    [],
  );
  const handleSetAvailableCategories = useCallback(
    (categories: string[]) => setAvailableCategories(categories),
    [],
  );
  const handleSetHasTrendingMarkets = useCallback(
    (v: boolean) => setHasTrendingMarkets(v),
    [],
  );

  const value = useMemo(
    () => ({
      searchQuery,
      setSearchQuery: handleSetSearchQuery,
      selectedCategory,
      setSelectedCategory: handleSetSelectedCategory,
      selectedSubcategory,
      setSelectedSubcategory: handleSetSelectedSubcategory,
      availableCategories,
      setAvailableCategories: handleSetAvailableCategories,
      hasTrendingMarkets,
      setHasTrendingMarkets: handleSetHasTrendingMarkets,
    }),
    [
      searchQuery,
      selectedCategory,
      selectedSubcategory,
      availableCategories,
      hasTrendingMarkets,
      handleSetSearchQuery,
      handleSetSelectedCategory,
      handleSetSelectedSubcategory,
      handleSetAvailableCategories,
      handleSetHasTrendingMarkets,
    ],
  );

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error("useFilter must be used within a FilterProvider");
  }
  return context;
}
