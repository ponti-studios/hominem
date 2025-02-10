import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Task, TasksSchema } from "../tasks/types";
// import { TasksSchema, type Task } from '../types'; // adjust import path as needed

const QUERY_KEY = ["tasks"];
const STORAGE_KEY = "tasks";

// Function to fetch tasks from localStorage
const fetchTasks = async (search?: string): Promise<Task[]> => {
	const savedTasks = localStorage.getItem(STORAGE_KEY);
	if (!savedTasks) return [];

	const parsedTasks = JSON.parse(savedTasks);
	const validatedTasks = TasksSchema.parse(
		parsedTasks.map((task: Task) => ({
			...task,
			startTime: new Date(task.startTime),
		})),
	);

	if (search) {
		return validatedTasks.filter((task) =>
			task.title.toLowerCase().includes(search.toLowerCase()),
		);
	}

	return validatedTasks;
};

// CRUD operations
const createTask = async (newTask: Task): Promise<Task> => {
	const tasks = await fetchTasks();
	const updatedTasks = [...tasks, newTask];
	localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
	return newTask;
};

const updateTask = async (updatedTask: Task): Promise<Task> => {
	const tasks = await fetchTasks();
	const updatedTasks = tasks.map((task) =>
		task.id === updatedTask.id ? updatedTask : task,
	);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
	return updatedTask;
};

const deleteTask = async (taskId: string): Promise<void> => {
	const tasks = await fetchTasks();
	const filteredTasks = tasks.filter((task) => task.id !== taskId);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredTasks));
};

type StopTaskParams = { taskId: string; elapsedTime: number };

export function useTasks(search?: string) {
	const queryClient = useQueryClient();

	const { data: tasks = [], error } = useQuery({
		queryKey: [...QUERY_KEY, search],
		queryFn: () => fetchTasks(search),
	});

	const createMutation = useMutation({
		mutationFn: createTask,
		onSuccess: (newTask) => {
			queryClient.setQueryData(QUERY_KEY, (oldTasks: Task[] = []) => [
				...oldTasks,
				newTask,
			]);
		},
	});

	const updateMutation = useMutation({
		mutationFn: updateTask,
		onSuccess: (updatedTask) => {
			queryClient.setQueryData(QUERY_KEY, (oldTasks: Task[] = []) =>
				oldTasks.map((task) =>
					task.id === updatedTask.id ? updatedTask : task,
				),
			);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: deleteTask,
		onSuccess: (_, taskId) => {
			queryClient.setQueryData(QUERY_KEY, (oldTasks: Task[] = []) =>
				oldTasks.filter((task) => task.id !== taskId),
			);
		},
	});

	const stopMutation = useMutation<Task, null, StopTaskParams>({
		// mutationFn: stopTask,
		onMutate: async ({ taskId, elapsedTime }) => {
			const tasks = queryClient.getQueryData<Task[]>(QUERY_KEY) || [];
			const task = tasks.find((task) => task.id === taskId);
			if (!task) return;

			const updatedTask = {
				...task,
				isActive: false,
				duration: task.duration + elapsedTime,
			};

			// create updated tasks array
			const updatedTasks = tasks.map((task) =>
				task.id === taskId ? updatedTask : task,
			);

			// update localStorage and query data
			localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));

			// update query data
			queryClient.setQueryData(QUERY_KEY, updatedTasks);

			return updateTask;
		},
	});

	return {
		tasks,
		error,
		createTask: createMutation.mutate,
		updateTask: updateMutation.mutate,
		deleteTask: deleteMutation.mutate,
		stopTask: stopMutation.mutate,
		isLoading:
			createMutation.isPending ||
			updateMutation.isPending ||
			deleteMutation.isPending,
	};
}
