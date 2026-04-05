"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";




interface RoleContextType {
  role: string | null;
  setRole: (role: string | null) => void;
}

const RoleContext = createContext<RoleContextType>({
  role: null,
  setRole: () => {},
});

interface RoleProviderProps {
  children: ReactNode;
}

export function RoleProvider({ children }: RoleProviderProps) {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const savedRole = localStorage.getItem("role");
    if (savedRole) setRole(savedRole);
  }, []);

  useEffect(() => {
    if (role) {
      localStorage.setItem("role", role);
    } else {
      localStorage.removeItem("role"); 
    }
  }, [role]);

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);