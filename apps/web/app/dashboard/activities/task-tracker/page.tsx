"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer, StopCircle, ListChecks } from "lucide-react";
import { TaskSchema, TasksSchema, type Task } from "./types";

const STORAGE_KEY = "task-tracker-tasks";

const TaskTimerApp = () => {
	const [tasks, setTasks] = useState<Task[]>([]);
	const [currentTask, setCurrentTask] = useState("");
	const [activeTimer, setActiveTimer] = useState<string | null>(null);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [error, setError] = useState<string | null>(null);

	// Load tasks from localStorage
	useEffect(() => {
		try {
			const savedTasks = localStorage.getItem(STORAGE_KEY);
			if (savedTasks) {
				const parsedTasks = JSON.parse(savedTasks);
				const validatedTasks = TasksSchema.parse(
					parsedTasks.map((task) => ({
						...task,
						startTime: new Date(task.startTime),
					})),
				);
				setTasks(validatedTasks);
			}
		} catch (err) {
			console.error("Failed to load tasks:", err);
			setError("Failed to load saved tasks");
		}
	}, []);

	// Save tasks to localStorage whenever they change
	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
	}, [tasks]);

	useEffect(() => {
		let intervalId: NodeJS.Timer;

		if (activeTimer) {
			intervalId = setInterval(() => {
				setElapsedTime((prev) => prev + 1);
			}, 1000);
		}

		return () => clearInterval(intervalId);
	}, [activeTimer]);

	const startTimer = () => {
		if (currentTask.trim()) {
			try {
				const newTask = TaskSchema.parse({
					id: crypto.randomUUID(),
					name: currentTask,
					startTime: new Date(),
					duration: 0,
					isActive: true,
				});

				setTasks((prev) => [...prev, newTask]);
				setActiveTimer(newTask.id);
				setElapsedTime(0);
				setCurrentTask("");
				setError(null);
			} catch (err) {
				setError("Invalid task data");
				console.error("Validation error:", err);
			}
		}
	};

	const stopTimer = (taskId: string) => {
		try {
			setTasks((prev) =>
				prev.map((task) =>
					task.id === taskId
						? TaskSchema.parse({
								...task,
								duration: task.duration + elapsedTime,
								isActive: false,
							})
						: task,
				),
			);
			setActiveTimer(null);
			setElapsedTime(0);
			setError(null);
		} catch (err) {
			setError("Failed to stop timer");
			console.error("Validation error:", err);
		}
	};

	const formatTime = (seconds) => {
		const hrs = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<div className="container mx-auto p-4 max-w-2xl">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Timer /> Task Timer Tracker
					</CardTitle>
					{error && <div className="text-red-500 text-sm">{error}</div>}
				</CardHeader>
				<CardContent>
					<div className="flex space-x-2 mb-4">
						<Input
							value={currentTask}
							onChange={(e) => setCurrentTask(e.target.value)}
							placeholder="Enter task name"
							disabled={!!activeTimer}
						/>
						<Button
							onClick={startTimer}
							disabled={!currentTask.trim() || !!activeTimer}
						>
							Start Task
						</Button>
					</div>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<ListChecks /> Task History
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								{tasks.map((task) => (
									<div
										key={task.id}
										className="flex justify-between items-center border p-2 rounded"
									>
										<div className="flex-grow">
											<div className="font-medium">{task.name}</div>
											<div className="text-sm text-gray-500">
												Started: {task.startTime.toLocaleString()}
											</div>
										</div>
										<div className="flex items-center space-x-2">
											<div className="font-bold">
												{formatTime(
													task.duration +
														(task.id === activeTimer ? elapsedTime : 0),
												)}
											</div>
											{task.id === activeTimer && (
												<Button
													variant="destructive"
													size="sm"
													onClick={() => stopTimer(task.id)}
												>
													<StopCircle className="mr-2" /> Stop
												</Button>
											)}
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</CardContent>
			</Card>
		</div>
	);
};

export default TaskTimerApp;
