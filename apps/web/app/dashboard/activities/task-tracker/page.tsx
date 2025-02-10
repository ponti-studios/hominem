"use client";

import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer, StopCircle, ListChecks } from "lucide-react";
import { TaskSchema } from "../../../../lib/tasks/types";
import { useTasks } from "../../../../lib/hooks/use-tasks";

const TaskTimerApp = () => {
	const [currentTask, setCurrentTask] = useState("");
	const [activeTimer, setActiveTimer] = useState<string | null>(null);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const { tasks, createTask, stopTask } = useTasks();

	const onStartTask = () => {
		if (currentTask.trim()) {
			try {
				const newTask = TaskSchema.parse({
					id: crypto.randomUUID(),
					name: currentTask,
					startTime: new Date(),
					duration: 0,
					isActive: true,
				});

				createTask(newTask);
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

	const onStopTask = useCallback(
		(taskId: string) => {
			try {
				stopTask({ taskId, elapsedTime });
				setActiveTimer(null);
				setElapsedTime(0);
				setError(null);
			} catch (err) {
				setError("Failed to stop timer");
				console.error("Validation error:", err);
			}
		},
		[elapsedTime, stopTask],
	);

	const formatTime = (seconds: number) => {
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
							onClick={onStartTask}
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
										<div className="grow">
											<div className="font-medium">{task.title}</div>
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
													onClick={() => onStopTask(task.id)}
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
