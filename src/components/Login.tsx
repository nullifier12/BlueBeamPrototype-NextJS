"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { LogIn, Loader2, UserPlus } from "lucide-react";
import { User } from "@/types";

interface LoginProps {
  onLoginSuccess: (user: User, projectId?: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (isRegistering) {
        // Registration
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password, email, name }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error("❌ Registration failed:", data.error);
          setError(data.error || "Registration failed");
          setLoading(false);
          return;
        }

        console.log("✅ Registration successful:", data.user);
        setSuccess("Account created successfully! You can now login.");
        setIsRegistering(false);
        setPassword("");
        setEmail("");
        setName("");
      } else {
        // Login
        const loginPayload = {
          username,
          password,
          projectId: projectId?.trim() || undefined,
        };

        console.log("🔐 Sending login request:", {
          username,
          hasPassword: !!password,
          projectId: projectId?.trim() || "NOT PROVIDED",
        });

        // Use NextAuth signIn
        const result = await signIn("credentials", {
          username,
          password,
          projectId: projectId?.trim() || undefined,
          redirect: false,
        });

        if (result?.error) {
          setError(result.error || "Login failed");
          setLoading(false);
          return;
        }

        if (!result?.ok) {
          setError("Login failed. Please check your credentials.");
          setLoading(false);
          return;
        }

        // Get session to get user data
        const sessionResponse = await fetch("/api/auth/session");
        const session = await sessionResponse.json();

        if (!session?.user) {
          setError("Failed to get user session");
          setLoading(false);
          return;
        }

        console.log("🔐 Login successful:", {
          user: session.user,
          projectId: session.projectId,
        });

        // Map NextAuth session to our User type
        const user: User = {
          id: session.user.id,
          username: session.user.username,
          name: session.user.name || "",
          email: session.user.email || "",
          color: session.user.color,
        };

        onLoginSuccess(user, session.projectId || undefined);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 bg-card border border-border rounded-lg shadow-lg">
        <div className="flex items-center justify-center mb-6">
          <LogIn className="w-12 h-12 text-primary" />
        </div>
        <h6 className="font-bold text-center mb-6 whitespace-nowrap">
          Web-Based PDF Markup Inspection Tool
        </h6>
        <h2 className="text-xl font-semibold text-center mb-6">
          {isRegistering ? "Create Account" : "Login"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <>
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium mb-2"
                >
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-border rounded-md bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-2"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-border rounded-md bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter your email"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium mb-2"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-input focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-input focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter password"
            />
          </div>

          {!isRegistering && (
            <div>
              <label
                htmlFor="projectId"
                className="block text-sm font-medium mb-2"
              >
                Project ID (Optional)
              </label>
              <input
                id="projectId"
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter project ID (e.g., PROJ-001)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to login without a project
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded-md text-destructive text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500 rounded-md text-green-600 text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isRegistering ? "Creating account..." : "Logging in..."}
              </>
            ) : (
              <>
                {isRegistering ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Create Account
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Login
                  </>
                )}
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError("");
              setSuccess("");
              setPassword("");
              if (isRegistering) {
                setEmail("");
                setName("");
              }
            }}
            className="text-sm text-primary hover:underline"
          >
            {isRegistering
              ? "Already have an account? Login"
              : "Don't have an account? Create Account"}
          </button>
        </div>

        {/* <div className="mt-6 p-4 bg-muted rounded-md text-sm">
          <p className="font-semibold mb-2">Default Credentials:</p>
          <p>
            Username:{" "}
            <code className="bg-background px-2 py-1 rounded">admin</code>
          </p>
          <p>
            Password:{" "}
            <code className="bg-background px-2 py-1 rounded">admin123</code>
          </p>
          <p className="mt-2 text-muted-foreground">
            ⚠️ Change the default password in production!
          </p>
        </div> */}
      </div>
    </div>
  );
}
