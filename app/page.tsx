"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { LogIn, Sparkles, Activity } from "lucide-react";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // Wait for auth context to push route
    } catch (err: any) {
      console.error("Sign in failed:", err);
      setError(err.message || "Failed to sign in with Google.");
      setIsSigningIn(false); // only stop loading on error, on success route push handles it
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-text-muted">Loading...</div>;
  if (user) return <div className="min-h-screen flex items-center justify-center text-primary animate-pulse">Redirecting to Dashboard...</div>;

  return (
    <main className="flex-grow flex flex-col items-center justify-center p-6 bg-gradient-to-b from-dark to-zinc-950 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-secondary/20 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="glass-panel max-w-lg w-full p-10 flex flex-col items-center text-center space-y-8 relative z-10"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30">
          <Activity className="w-10 h-10 text-white" />
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
            Crave<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-300">Nudge</span>
          </h1>
          <p className="text-lg text-text-muted">
            Your intelligent compass for food. Upload a meal, get AI-powered health scores, and stay accountable to your goals.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm w-full" role="alert">
            {error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white py-4 rounded-xl font-medium transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          aria-label="Sign in with Google"
        >
          {isSigningIn ? (
            <Sparkles className="w-5 h-5 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
            </svg>
          )}
          {isSigningIn ? "Connecting..." : "Continue with Google"}
        </button>

        <p className="text-xs text-text-muted mt-4">
          By signing in, you are agreeing to completely transform your dietary habits.
        </p>
      </motion.div>
    </main>
  );
}
