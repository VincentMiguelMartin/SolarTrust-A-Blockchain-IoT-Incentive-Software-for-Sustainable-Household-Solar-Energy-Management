import React, { createContext, useState, ReactNode } from "react";
import { supabase } from "../lib/supabase";

export type UserRole = "admin" | "user";

type AuthContextType = {
  role: UserRole;
  setRole: (role: UserRole) => void;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>(
  {} as AuthContextType
);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<UserRole>("user");

  const logout = async () => {
    await supabase.auth.signOut();
    setRole("user");
  };

  return (
    <AuthContext.Provider value={{ role, setRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
