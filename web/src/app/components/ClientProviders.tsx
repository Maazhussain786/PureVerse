"use client";

import React from "react";
import { AuthProvider } from "./AuthContext";
import { UserStateProvider } from "./UserStateContext";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <UserStateProvider>
        {children}
      </UserStateProvider>
    </AuthProvider>
  );
}
