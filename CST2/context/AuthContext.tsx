import React, { createContext, useState, ReactNode } from "react";

/* ================= USER TYPE ================= */

export type User = {
  name: string;
  email: string;
  password: string;
};

/* ================= CONTEXT TYPE ================= */

type AuthContextType = {
  user: User | null;
  register: (name: string, email: string, password: string) => void;
  login: (email: string, password: string) => boolean;
  logout: () => void;
};

/* ================= CREATE CONTEXT ================= */

export const AuthContext = createContext<AuthContextType>(
  {} as AuthContextType
);

/* ================= PROVIDER ================= */

export const AuthProvider = ({ children }: { children: ReactNode }) => {

  // this stores the currently registered/logged-in user (RAM only)
  const [users, setUsers] = useState<User[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  /* ---------- REGISTER ---------- */
  const register = (name: string, email: string, password: string) => {
    const newUser: User = { name, email, password };

    setUsers(prev => [...prev, newUser]); // save to "database"

  };

  /* ---------- LOGIN ---------- */
  const login = (email: string, password: string) => {
    const foundUser = users.find(

      u => u.email === email && u.password === password

    );

    if (foundUser) {
      setCurrentUser(foundUser);
      return true;
    }

    return false;
  };

  /* ---------- LOGOUT ---------- */
  const logout = () => {
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ user: currentUser, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
