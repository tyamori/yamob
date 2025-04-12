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
interface RawObstacleData extends Array<number> {} // [x, y, radius]
interface RawEnvironmentData {
  walls: RawWallData[];
  obstacles: RawObstacleData[];
}

// フロントエンド内で扱いやすい構造化された型
interface Vector2D {
  position: [number, number];
}
interface WallData {
  start: Vector2D;
  end: Vector2D;
}
interface ObstacleData {
  center: Vector2D;
  radius: number;
}
interface EnvironmentData {
  walls: WallData[];
  obstacles: ObstacleData[];
}
interface PersonData {
  id: number;
  position: [number, number];
}
interface SimulationState {
  time: number;
  persons: PersonData[];
  is_running: boolean;
  environment: EnvironmentData; // 構造化された環境データ
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
  type RawSimulationState = Omit<SimulationState, 'environment'> & { environment: { walls: [number,number][][], obstacles: [number,number,number][] } };
  // ControlPanel に渡す初期人数を state で管理
  const [initialNumPersons, setInitialNumPersons] = useState<number>(10); // デフォルト値

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

  const handleReset = async (numPersons: number) => {
    console.log(`Resetting simulation with ${numPersons} persons...`);
    try {
      // API_BASE_URL を削除し、プロキシ経由の相対パスを使用
      const response = await fetch(`/api/simulation/reset`, {
         method: 'POST',
         headers: {
             'Content-Type': 'application/json',
         },
         body: JSON.stringify({ num_persons: numPersons })
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Reset simulation response:', data);
      // 状態更新は WebSocket 経由
      // リセット成功時に ControlPanel の人数も更新するために initialNumPersons を更新
      setInitialNumPersons(numPersons);
    } catch (error) {
      console.error("Failed to reset simulation:", error);
    }
  };

  // --- useEffect (WebSocket 関連) ---
  useEffect(() => {
    // fetchInitialState もプロキシ経由 (/api/simulation/state) を使用
    const fetchInitialState = async () => {
      try {
        const response = await fetch(`/api/simulation/state`); // プロキシ経由
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const initialState: RawSimulationState = await response.json();
        const formattedState: SimulationState = {
          ...initialState,
          environment: {
              walls: initialState.environment.walls.map((w) => ({ start: { position: w[0] }, end: { position: w[1] } })),
              obstacles: initialState.environment.obstacles.map((o) => ({ center: { position: [o[0], o[1]] }, radius: o[2] }))
          }
        };
        setSimulationState(formattedState);
        setInitialNumPersons(formattedState.persons.length);
        console.log('Fetched initial state:', formattedState);
      } catch (error) {
        console.error("Failed to fetch initial state:", error);
        setInitialNumPersons(10);
      }
    };
    fetchInitialState();

    // Socket.IO 接続 (引数なしでプロキシ経由 - vite.config.ts の設定に依存)
    socketRef.current = io({ // 引数を空にする
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });
    console.log('Connecting to Socket.IO server via proxy...');
    const socket = socketRef.current;

    // ... (socket.on イベントリスナー - 変更なし) ...
    socket.on('connect', () => {
      console.log('Connected to Socket.IO server with id:', socket.id);
    });
    socket.on('simulation_state_update', (newState: RawSimulationState) => {
      const formattedState: SimulationState = {
         ...newState,
          environment: {
              walls: newState.environment.walls.map((w) => ({ start: { position: w[0] }, end: { position: w[1] } })),
              obstacles: newState.environment.obstacles.map((o) => ({ center: { position: [o[0], o[1]] }, radius: o[2] }))
          }
      };
      setSimulationState(formattedState);
      setInitialNumPersons(formattedState.persons.length);
    });
    socket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err.message);
    });
    socket.on('disconnect', (reason) => {
        console.log('Disconnected from Socket.IO server:', reason);
    });

    return () => {
      console.log('Disconnecting from Socket.IO server...');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Handler for number of persons change from ControlPanel
  const handleNumPersonsChange = (newNumPersons: number) => {
    // Currently, reset is the only way to change numPersons in backend
    handleReset(newNumPersons);
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
          {/* Reset Button with Icon */}
          <button
            onClick={() => handleReset(initialNumPersons)}
            title="Reset Simulation"
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
            {/* Pass updated props to ControlPanel */}
            <ControlPanel
              initialNumPersons={initialNumPersons}
              onNumPersonsChange={handleNumPersonsChange} // Pass the new handler
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
