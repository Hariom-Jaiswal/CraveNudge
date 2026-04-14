// src/components/WeeklyInsights.tsx
"use client";
import { PatternAnalysisResult } from "@/lib/patternDetector";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, CheckCircle, Info } from "lucide-react";

interface WeeklyInsightsProps {
  insights: PatternAnalysisResult;
}

export default function WeeklyInsights({ insights }: WeeklyInsightsProps) {
  if (insights.insightCount === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
        <Activity className="w-4 h-4" /> Weekly Pattern Analysis
      </h3>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
        {insights.patterns.map((pattern, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`glass-panel p-5 border-l-4 \${
              pattern.severity === 'warning' ? 'border-l-amber-500' : 
              pattern.severity === 'positive' ? 'border-l-primary' : 'border-l-secondary'
            }`}
          >
            <div className="flex gap-3 mb-2">
              {pattern.severity === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />}
              {pattern.severity === 'positive' && <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />}
              {pattern.severity === 'info' && <Info className="w-5 h-5 text-secondary flex-shrink-0" />}
              
              <h4 className="font-bold text-white">{pattern.title}</h4>
            </div>
            <p className="text-sm text-zinc-300 ml-8 mb-2 leading-relaxed">{pattern.message}</p>
            <div className="ml-8 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-3 py-2 rounded-lg inline-block">
              💡 {pattern.suggestion}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
