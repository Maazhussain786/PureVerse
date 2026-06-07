"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface UserProfile {
  name: string;
  email: string;
  avatar: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isSignedIn: boolean;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isSignedIn: false,
  signIn: () => {},
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);

  // Load persisted user on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("pureverse_user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleCredentialResponse = useCallback((response: any) => {
    try {
      // Decode JWT payload (Google ID token)
      const payload = JSON.parse(atob(response.credential.split(".")[1]));
      const profile: UserProfile = {
        name: payload.name || "User",
        email: payload.email || "",
        avatar: payload.picture || "",
      };
      setUser(profile);
      localStorage.setItem("pureverse_user", JSON.stringify(profile));
    } catch {
      console.error("Failed to decode Google credential");
    }
  }, []);

  // Load Google Identity Services script
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return; // Skip if no client ID configured

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const google = (window as any).google;
      if (google?.accounts?.id) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [handleCredentialResponse]);

  const signIn = useCallback(() => {
    const google = (window as any).google;
    if (google?.accounts?.id) {
      google.accounts.id.prompt();
    } else {
      // Fallback: mock sign in for development
      const mockUser: UserProfile = {
        name: "Guest User",
        email: "guest@pureverse.app",
        avatar: "",
      };
      setUser(mockUser);
      localStorage.setItem("pureverse_user", JSON.stringify(mockUser));
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem("pureverse_user");
    const google = (window as any).google;
    if (google?.accounts?.id) {
      google.accounts.id.disableAutoSelect();
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isSignedIn: !!user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
