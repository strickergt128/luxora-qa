import { useSelector } from "react-redux";
import type { RootState } from "../store";

export const useAuth = () => {
  const { user, loading, hydrated, error } = useSelector((s: RootState) => s.auth);
  return { user, loading, hydrated, error };
};