'use client';

import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, ListTodo, Sparkles, Target, TrendingUp } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { TaskForm } from '@/components/task-form';
import { TaskItem } from '@/components/task-item';

interface Task {
  _id: string;
  title: string;
  description?: string;
  time?: string;
  completed: boolean;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (taskData: { title: string; description: string; time: string }) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      const data = await response.json();
      setTasks([data.task, ...tasks]);
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const toggleTask = async (id: string, completed: boolean) => {
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, completed }),
      });
      setTasks(tasks.map((task) => (task._id === id ? { ...task, completed } : task)));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
      setTasks(tasks.filter((task) => task._id !== id));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const completedTasks = tasks.filter((task) => task.completed).length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="min-h-screen gradient-bg relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-40 right-1/4 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <header className="animate-fade-in">
          <div className="glass-card rounded-2xl p-6 sm:p-8 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/30">
                    <Calendar className="h-8 w-8 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                      AI Day Planner
                    </h1>
                    <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse" />
                  </div>
                  <p className="text-muted-foreground mt-1">
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {/* Total Tasks */}
          <div className="glass-card rounded-2xl p-6 group hover:scale-[1.02] transition-transform duration-300">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
                <ListTodo className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                <p className="text-3xl font-bold text-foreground">{totalTasks}</p>
              </div>
            </div>
          </div>

          {/* Completed Tasks */}
          <div className="glass-card rounded-2xl p-6 group hover:scale-[1.02] transition-transform duration-300">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-lg shadow-green-500/20 group-hover:shadow-green-500/40 transition-shadow">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold text-foreground">{completedTasks}</p>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="glass-card rounded-2xl p-6 group hover:scale-[1.02] transition-transform duration-300">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-shadow">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">Progress</p>
                  <span className="text-sm font-semibold text-foreground">{progressPercentage}%</span>
                </div>
                <div className="progress-bar h-2">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Motivational Banner */}
        {totalTasks > 0 && completedTasks === totalTasks && (
          <div className="glass-card rounded-2xl p-6 mb-8 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20 animate-scale-in">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-green-600 dark:text-green-400">All tasks completed! 🎉</h3>
                <p className="text-sm text-muted-foreground">You&apos;re on fire! Keep up the great work.</p>
              </div>
            </div>
          </div>
        )}

        {/* Add Task Form */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <TaskForm onSubmit={addTask} />
        </div>

        {/* Tasks List */}
        <div className="space-y-4">
          {loading ? (
            <div className="glass-card rounded-2xl p-12 text-center animate-fade-in">
              <div className="relative inline-block">
                <div className="h-12 w-12 rounded-full border-4 border-indigo-200 dark:border-indigo-900" />
                <div className="absolute top-0 left-0 h-12 w-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
              </div>
              <p className="mt-4 text-muted-foreground font-medium">Loading your tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center animate-fade-in">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 mb-4">
                <ListTodo className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No tasks yet</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Start your productive day by adding your first task. Click the button above to get started!
              </p>
            </div>
          ) : (
            tasks.map((task, index) => (
              <div 
                key={task._id} 
                className="animate-fade-in"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <TaskItem
                  task={task}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <p>Built with ❤️ using Next.js, TypeScript & MongoDB</p>
        </footer>
      </div>
    </div>
  );
}
