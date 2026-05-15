import { create } from 'zustand';

export const useTasksStore = create((set) => ({
    tasks: [],

    setTasks: (tasks) =>
        set({
            tasks,
        }),
}));