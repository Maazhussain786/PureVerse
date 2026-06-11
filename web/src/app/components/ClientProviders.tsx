"use client";

import React from "react";
import { AuthProvider } from "./AuthContext";
import { UserStateProvider } from "./UserStateContext";
import { NotificationProvider } from "./NotificationContext";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <UserStateProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </UserStateProvider>
    </AuthProvider>
  );
}
