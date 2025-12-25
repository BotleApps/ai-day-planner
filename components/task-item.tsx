'use client';

import { Check, Trash2, Clock, GripVertical } from 'lucide-react';

interface Task {
  _id: string;
  title: string;
  description?: string;
  time?: string;
  completed: boolean;
}

interface TaskItemProps {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  return (
    <div className={`glass-card task-card rounded-2xl p-5 group ${task.completed ? 'opacity-75' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Drag Handle (visual only for now) */}
        <div className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-50 transition-opacity cursor-grab">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Checkbox */}
        <button
          onClick={() => onToggle(task._id, !task.completed)}
          className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
            task.completed
              ? 'bg-gradient-to-br from-green-500 to-emerald-500 border-transparent shadow-lg shadow-green-500/30'
              : 'border-border hover:border-green-500 hover:shadow-lg hover:shadow-green-500/20'
          }`}
        >
          <Check className={`h-4 w-4 text-white transition-all duration-300 ${task.completed ? 'scale-100' : 'scale-0'}`} />
        </button>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3
            className={`text-lg font-semibold transition-all duration-300 ${
              task.completed
                ? 'text-muted-foreground line-through'
                : 'text-foreground'
            }`}
          >
            {task.title}
          </h3>
          
          {task.description && (
            <p className={`mt-1.5 text-sm transition-colors ${task.completed ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
              {task.description}
            </p>
          )}
          
          {task.time && (
            <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              task.completed 
                ? 'bg-muted text-muted-foreground' 
                : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
            }`}>
              <Clock className="h-3.5 w-3.5" />
              <span>{task.time}</span>
            </div>
          )}
        </div>
        
        {/* Delete Button */}
        <button
          onClick={() => onDelete(task._id)}
          className="flex-shrink-0 p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100"
          aria-label="Delete task"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
