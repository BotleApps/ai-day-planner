'use client';

import { Check, Trash2, Clock } from 'lucide-react';

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
    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-100 dark:border-gray-700">
      <div className="flex items-start gap-4">
        <button
          onClick={() => onToggle(task._id, !task.completed)}
          className={`flex-shrink-0 mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            task.completed
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
          }`}
        >
          {task.completed && <Check className="h-4 w-4 text-white" />}
        </button>
        
        <div className="flex-1 min-w-0">
          <h3
            className={`text-lg font-semibold ${
              task.completed
                ? 'text-gray-400 dark:text-gray-500 line-through'
                : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {task.title}
          </h3>
          
          {task.description && (
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
              {task.description}
            </p>
          )}
          
          {task.time && (
            <div className="flex items-center gap-1 mt-2 text-blue-600 dark:text-blue-400 text-sm">
              <Clock className="h-4 w-4" />
              <span>{task.time}</span>
            </div>
          )}
        </div>
        
        <button
          onClick={() => onDelete(task._id)}
          className="flex-shrink-0 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          aria-label="Delete task"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
