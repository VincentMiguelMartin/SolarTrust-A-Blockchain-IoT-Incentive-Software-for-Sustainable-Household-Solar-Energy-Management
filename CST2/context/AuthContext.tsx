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
  updateAccount: (email: string, oldPassword: string, newPassword: string) => boolean;
};

/* ================= CREATE CONTEXT ================= */

export const AuthContext = createContext<AuthContextType>(
  {} as AuthContextType
);

/* ================= PROVIDER ================= */

export const AuthProvider = ({ children }: { children: ReactNode }) => {

  // "database" of accounts (RAM only)
  const [users, setUsers] = useState<User[]>([]);

  // currently logged-in user
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  /* ---------- REGISTER ---------- */
  const register = (name: string, email: string, password: string) => {

    // prevent duplicate email
    const exists = users.find(u => u.email === email);
    if (exists) {
      alert("Email already registered");
      return;
    }

    const newUser: User = { name, email, password };

    setUsers(prev => [...prev, newUser]);   // save account
    setCurrentUser(newUser);                // auto login after register
  };

  /* ---------- LOGIN ---------- */
  const login = (email: string, password: string) => {

    const found = users.find(
      u => u.email === email && u.password === password
    );

    if (!found) return false;

    setCurrentUser(found);
    return true;
  };

  /* ---------- LOGOUT ---------- */
  const logout = () => {
    setCurrentUser(null);
  };

  /* ---------- UPDATE ACCOUNT ---------- */
  const updateAccount = (email: string, oldPassword: string, newPassword: string) => {

    if (!currentUser) return false;

    // verify current password
    if (currentUser.password !== oldPassword) return false;

    // update user inside users array
    const updatedUsers = users.map(u => {
      if (u.email === currentUser.email) {
        return {
          ...u,
          email: email.trim(),
          password: newPassword.trim(),
        };
      }
      return u;
    });

    setUsers(updatedUsers);

    // update the logged-in user
    setCurrentUser({
      ...currentUser,
      email: email.trim(),
      password: newPassword.trim(),
    });

    return true;
  };

  /* ---------- PROVIDER ---------- */
  return (
    <AuthContext.Provider
      value={{
        user: currentUser,   // IMPORTANT: screens still use "user"
        register,
        login,
        logout,
        updateAccount
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
