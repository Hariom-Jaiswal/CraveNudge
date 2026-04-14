// src/components/StreakBadge.tsx
"use client";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";

interface StreakBadgeProps {
  currentStreak: number;
}

export default function StreakBadge({ currentStreak }: StreakBadgeProps) {
  if (currentStreak === 0) return null;

  return (
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 px-3 py-1.5 rounded-full font-bold shadow-[0_0_15px_rgba(249,115,22,0.2)]"
      title={`\${currentStreak} day streak!`}
    >
      <motion.div
        animate={{ rotate: [-5, 5, -5] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      >
        <Flame className="w-4 h-4 fill-orange-400" />
      </motion.div>
      <span className="text-sm">{currentStreak}</span>
    </motion.div>
  );
}
