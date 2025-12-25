'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <div className="p-3 rounded-xl bg-secondary">
        <div className="h-5 w-5" />
      </div>
    );
  }

  const cycleTheme = () => {
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className="relative p-3 rounded-xl bg-secondary hover:bg-muted transition-all duration-300 group overflow-hidden"
      aria-label={`Current theme: ${theme}. Click to change.`}
    >
      <div className="relative w-5 h-5">
        {/* Sun Icon */}
        <Sun 
          className={`absolute inset-0 h-5 w-5 text-yellow-500 transition-all duration-500 ${
            resolvedTheme === 'light' && theme !== 'system'
              ? 'rotate-0 scale-100 opacity-100' 
              : 'rotate-90 scale-0 opacity-0'
          }`}
        />
        
        {/* Moon Icon */}
        <Moon 
          className={`absolute inset-0 h-5 w-5 text-indigo-400 transition-all duration-500 ${
            resolvedTheme === 'dark' && theme !== 'system'
              ? 'rotate-0 scale-100 opacity-100' 
              : '-rotate-90 scale-0 opacity-0'
          }`}
        />
        
        {/* System Icon */}
        <Monitor 
          className={`absolute inset-0 h-5 w-5 text-muted-foreground transition-all duration-500 ${
            theme === 'system'
              ? 'rotate-0 scale-100 opacity-100' 
              : 'rotate-90 scale-0 opacity-0'
          }`}
        />
      </div>
      
      {/* Hover tooltip */}
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs font-medium bg-foreground text-background rounded-md opacity-0 group-hover:opacity-100 group-hover:-bottom-10 transition-all duration-300 whitespace-nowrap pointer-events-none">
        {theme === 'system' ? 'System' : theme === 'light' ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
