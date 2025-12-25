'use client';

import { useState } from 'react';
import { Plus, X, Clock, FileText, Type } from 'lucide-react';

interface TaskFormProps {
  onSubmit: (task: { title: string; description: string; time: string }) => void;
}

export function TaskForm({ onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSubmit({ title, description, time });
      setTitle('');
      setDescription('');
      setTime('');
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full group relative overflow-hidden flex items-center justify-center gap-3 py-5 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl transition-all duration-300 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-[1.02]"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
        <div className="p-2 bg-white/20 rounded-xl">
          <Plus className="h-5 w-5" />
        </div>
        <span className="font-semibold text-lg">Add New Task</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 animate-scale-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
            <Plus className="h-4 w-4 text-white" />
          </div>
          New Task
        </h2>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setTitle('');
            setDescription('');
            setTime('');
          }}
          className="p-2 hover:bg-secondary rounded-xl transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-5">
        {/* Title Input */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Type className="h-5 w-5" />
          </div>
          <input
            type="text"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-modern w-full pl-12 pr-4"
            autoFocus
          />
        </div>

        {/* Description Input */}
        <div className="relative">
          <div className="absolute left-4 top-4 text-muted-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <textarea
            placeholder="Add a description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-modern w-full pl-12 pr-4 resize-none min-h-[100px]"
            rows={3}
          />
        </div>

        {/* Time Input */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Clock className="h-5 w-5" />
          </div>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="input-modern w-full pl-12 pr-4"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={!title.trim()}
            className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 disabled:shadow-none"
          >
            Add Task
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setTitle('');
              setDescription('');
              setTime('');
            }}
            className="flex-1 py-3.5 bg-secondary hover:bg-muted text-secondary-foreground rounded-xl font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
