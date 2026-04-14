// src/components/GoalSetup.tsx
"use client";
import { useState } from "react";
import { ActivityGoal } from "@/types";
import { updateUserGoal } from "@/lib/firestoreService";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { Target, Dumbbell, Scale, Loader2 } from "lucide-react";

export default function GoalSetup() {
  const { user, refreshProfile } = useAuth();
  const [goal, setGoal] = useState<ActivityGoal | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || !goal) return;
    setLoading(true);
    try {
      let cals = 2000;
      let protein = 50;
      
      if (goal === "WEIGHT_LOSS") { cals = 1600; protein = 80; }
      else if (goal === "MUSCLE_GAIN") { cals = 2800; protein = 140; }
      else if (goal === "MAINTENANCE") { cals = 2200; protein = 60; }

      await updateUserGoal(user.uid, goal, cals, protein);
      await refreshProfile();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel max-w-md w-full p-8 text-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-title"
      >
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
          <Target className="w-8 h-8" />
        </div>
        
        <h2 id="goal-title" className="text-2xl font-bold text-white mb-2">Welcome to CraveNudge</h2>
        <p className="text-text-muted mb-8">Choose your primary objective so our AI can personalize your health nudges perfectly.</p>
        
        <div className="space-y-3 mb-8">
          <button 
            onClick={() => setGoal("WEIGHT_LOSS")}
            className={`w-full flex items-center p-4 rounded-xl border \${goal === "WEIGHT_LOSS" ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-border-glass text-text-muted hover:bg-white/10'}`}
          >
            <Scale className="w-6 h-6 mr-4" />
            <div className="text-left">
              <div className="font-bold">Weight Loss</div>
              <div className="text-xs opacity-70">Focus on calorie deficit & low sugar</div>
            </div>
          </button>
          
          <button 
            onClick={() => setGoal("MUSCLE_GAIN")}
            className={`w-full flex items-center p-4 rounded-xl border \${goal === "MUSCLE_GAIN" ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-border-glass text-text-muted hover:bg-white/10'}`}
          >
            <Dumbbell className="w-6 h-6 mr-4" />
            <div className="text-left">
              <div className="font-bold">Muscle Gain</div>
              <div className="text-xs opacity-70">Focus on high protein & surplus</div>
            </div>
          </button>

          <button 
            onClick={() => setGoal("MAINTENANCE")}
            className={`w-full flex items-center p-4 rounded-xl border \${goal === "MAINTENANCE" ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-border-glass text-text-muted hover:bg-white/10'}`}
          >
            <ActivityGoalIcon />
            <div className="text-left">
              <div className="font-bold">Maintenance & Health</div>
              <div className="text-xs opacity-70">Focus on balanced macros & fiber</div>
            </div>
          </button>
        </div>

        <button 
          onClick={handleSubmit}
          disabled={!goal || loading}
          className="w-full primary-btn flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Set Goal"}
        </button>
      </motion.div>
    </div>
  );
}

const ActivityGoalIcon = () => (
  <svg className="w-6 h-6 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
