import React, { useState, useEffect, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
// import logo from './logo.svg';
// import './App.css';
import SimulationCanvas from './components/SimulationCanvas';
import ControlPanel from './components/ControlPanel';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
// import { SimulationState, Person, Environment } from './types'; // Temporarily commented out as types file/dir not found

// --- 型定義 ---
// バックエンドからの生データ形式に合わせた型 (オプショナル)
interface RawWallData extends Array<[number, number]> {}
// Updated RawObstacleData to potentially include rectangle data
// Note: Backend now sends a list of dictionaries directly, so this might be less needed
// type RawObstacleData = Array<number> | { type: string, center: [number, number], radius?: number, width?: number, height?: number };

interface RawEnvironmentData {
  walls: RawWallData[];
  obstacles: ObstacleData[]; // Use the updated ObstacleData directly
}

// フロントエンド内で扱いやすい構造化された型
interface Vector2D {
  position: [number, number];
}
interface WallData {
  start: Vector2D;
  end: Vector2D;
}
// Revert ObstacleData to Union Type
interface BaseObstacleData {
  type: 'circle' | 'rectangle';
  center: Vector2D;
}
interface CircleObstacleData extends BaseObstacleData {
  type: 'circle';
  radius: number;
}
interface RectangleObstacleData extends BaseObstacleData {
  type: 'rectangle';
  width: number;
  height: number;
}
type ObstacleData = CircleObstacleData | RectangleObstacleData;

interface EnvironmentData {
  walls: WallData[];
  obstacles: ObstacleData[]; // Use the union type again
}
interface PersonData {
  id: number;
  position: [number, number];
}
interface SimulationState {
  time: number;
  persons: PersonData[];
  is_running: boolean;
  environment: EnvironmentData;
}
// --- 型定義ここまで ---

// Socket.IO サーバーの URL (バックエンドと同じポート) - プロキシを使うので不要になる可能性あり
// const SOCKET_SERVER_URL = 'http://localhost:5001';

// --- API & Socket URLs --- - プロキシを使うので不要
// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function App() {
  // 初期状態を定義
  const initialEnvironment: EnvironmentData = { walls: [], obstacles: [] };
  const initialSimulationState: SimulationState = {
      time: 0,
      persons: [],
      is_running: false,
      environment: initialEnvironment
  };
  const [simulationState, setSimulationState] = useState<SimulationState>(initialSimulationState);
  // Socket インスタンスを保持するための ref
  const socketRef = useRef<Socket | null>(null);
  // API から受け取るデータ型の any を回避するための Raw 型 (より厳密に定義も可能)
  type RawSimulationState = Omit<SimulationState, 'environment'> & { environment: { walls: [number,number][][], obstacles: any[] } }; // Use any[] for raw obstacles initially
  // ControlPanel に渡す初期人数を state で管理
  const [activeNumPersons, setActiveNumPersons] = useState<number>(10);
  // --- Add state for obstacle parameters --- V
  const [activeNumObstacles, setActiveNumObstacles] = useState<number>(5); // Default 5 obstacles
  const [activeObstacleAvgRadius, setActiveObstacleAvgRadius] = useState<number>(0.5); // Default 0.5 radius
  // --- Add state for obstacle shape --- V
  const [activeObstacleShape, setActiveObstacleShape] = useState<'random' | 'circle' | 'rectangle'>('random'); // Default to random
  // --- Add state for obstacle parameters --- ^

  // --- API ハンドラ関数 ---
  const handleStart = async () => {
    try {
      // API_BASE_URL を削除し、プロキシ経由の相対パスを使用
      const response = await fetch(`/api/simulation/start`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Start simulation response:', data);
      // 状態更新は WebSocket 経由で行われるため、ここでは何もしない
    } catch (error) {
      console.error("Failed to start simulation:", error);
    }
  };

  const handleStop = async () => {
    try {
      // API_BASE_URL を削除し、プロキシ経由の相対パスを使用
      const response = await fetch(`/api/simulation/stop`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Stop simulation response:', data);
      // 状態更新は WebSocket 経由
    } catch (error) {
      console.error("Failed to stop simulation:", error);
    }
  };

  const handleReset = async (numPersons: number, numObs: number, avgRad: number, shape: string) => {
    console.log(`Resetting simulation with ${numPersons} persons, ${numObs} ${shape} obstacles, avg radius ${avgRad}...`);
    try {
      const response = await fetch(`/api/simulation/reset`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            num_persons: numPersons,
            num_obstacles: numObs,
            obstacle_avg_radius: avgRad,
            obstacle_shape: shape
         })
      });
      if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
      const data = await response.json();
      console.log('Reset simulation response:', data);
      // Update active settings state based on response (this confirms the applied settings)
      setActiveNumPersons(data.num_persons);
      setActiveNumObstacles(data.num_obstacles);
      setActiveObstacleAvgRadius(data.obstacle_avg_radius);
      // Backend currently doesn't echo back the shape, keep frontend state
      // setActiveObstacleShape(data.obstacle_shape); // Uncomment if backend sends it back
    } catch (error) {
      console.error("Failed to reset simulation:", error);
    }
  };

  // --- useEffect (WebSocket 関連) ---
  useEffect(() => {
    const fetchInitialState = async () => {
      try {
        const response = await fetch(`/api/simulation/state`);
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
        const initialState = await response.json() as SimulationState;
        setSimulationState(initialState);
        // Also set the initial active settings based on fetched state
        setActiveNumPersons(initialState.persons.length);
        // TODO: Infer initial obstacle settings from initialState.environment.obstacles if possible?
        // For now, keep the default active settings on initial load.
        // setActiveNumObstacles(initialState.environment.obstacles.length);
        // setActiveObstacleAvgRadius(...); // Hard to infer average radius
        // setActiveObstacleShape(...); // Hard to infer shape mix
        console.log('Fetched initial state:', initialState);
      } catch (error) { 
        console.error("Failed to fetch initial state:", error);
        setActiveNumPersons(10);
      }
    };
    fetchInitialState();

    socketRef.current = io({ reconnectionAttempts: 5, reconnectionDelay: 1000 });
    console.log('Connecting to Socket.IO server via proxy...');
    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server with id:', socket.id);
    });
    socket.on('simulation_state_update', (newState: SimulationState) => { // Type assert directly
       // No more manual mapping needed if backend format matches
      setSimulationState(newState);
      setActiveNumPersons(newState.persons.length);
    });
    socket.on('connect_error', (err) => { console.error('Socket.IO connection error:', err.message); });
    socket.on('disconnect', (reason) => { console.log('Disconnected from Socket.IO server:', reason); });

    return () => {
      console.log('Disconnecting from Socket.IO server...');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Handler for applying settings from ControlPanel
  const handleApplySettings = (settings: {
    numPersons: number;
    numObstacles: number;
    obstacleAvgRadius: number;
    obstacleShape: 'random' | 'circle' | 'rectangle';
  }) => {
    console.log("Applying settings:", settings);
    // Call handleReset with the new settings
    handleReset(
        settings.numPersons,
        settings.numObstacles,
        settings.obstacleAvgRadius,
        settings.obstacleShape
    );
    // Note: handleReset now updates the active... state variables upon successful response
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <header className="text-center py-4 px-4 sm:px-6 lg:px-8 flex-shrink-0 border-b border-gray-700">
        <h1 className="text-3xl font-bold mb-1">yamob</h1>
        <p className="text-sm text-gray-500 mb-3">"Yet Another Mobility". It is library for mobility simulator.</p>
        {/* Centered container for time, status toggle, and reset */}
        <div className="flex justify-center items-center gap-3 text-base">
          {/* Time Display */}
          <span className="bg-gray-700 px-3 py-1 rounded">
            Time: {simulationState.time.toFixed(2)}s
          </span>
          {/* Start/Stop Toggle Button */}
          <button
            onClick={simulationState.is_running ? handleStop : handleStart}
            className={`px-4 py-1 rounded font-semibold ${simulationState.is_running ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
          >
            {simulationState.is_running ? 'Stop' : 'Start'}
          </button>
          {/* Update reset button onClick to use *active* settings */}
          <button
            onClick={() => handleReset(activeNumPersons, activeNumObstacles, activeObstacleAvgRadius, activeObstacleShape)}
            title="Reset Simulation with Current Settings"
            className="p-1.5 rounded bg-gray-600 hover:bg-gray-500 text-white"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>
      </header>
      <main className="flex flex-1 overflow-hidden p-6 gap-6 min-h-0">
        <div className="flex-1 flex flex-col bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <h2 className="text-xl font-semibold p-4 bg-gray-700 border-b border-gray-600">Simulation View</h2>
          <div className="flex-1 relative">
            <SimulationCanvas
              persons={simulationState.persons}
              environment={simulationState.environment}
            />
          </div>
        </div>
        <div className="w-72 flex flex-col bg-gray-800 rounded-lg shadow-lg overflow-y-auto">
          {/* Changed title to Conditions and adjusted sticky header */}
          <h2 className="text-xl font-semibold p-4 bg-gray-700 border-b border-gray-600 sticky top-0 z-10">Conditions</h2>
          <div className="p-4">
            {/* Pass active settings state and the apply handler to ControlPanel */}
            <ControlPanel
              activeNumPersons={activeNumPersons}
              activeNumObstacles={activeNumObstacles}
              activeObstacleAvgRadius={activeObstacleAvgRadius}
              activeObstacleShape={activeObstacleShape}
              onApplySettings={handleApplySettings}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
