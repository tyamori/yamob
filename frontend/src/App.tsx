import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
// import logo from './logo.svg';
// import './App.css';
import SimulationCanvas from './components/SimulationCanvas';
import ControlPanel from './components/ControlPanel';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
// import { SimulationState } from './types'; // SimulationState 型をインポート
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
  destinations?: Vector2D[];
}
// --- 型定義ここまで ---

// WebSocketサーバーのURL (環境変数から取得するか、デフォルト値を設定)
// Linter Error: Cannot find name 'process' -> Use import.meta.env for Vite
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';

// Linter Error 修正: 重複定義を削除
// type SimulationState = any;

function App() {
  const [simulationState, setSimulationState] = useState<any | null>(null); // Use any for now
  const [socket, setSocket] = useState<any>(null); // Socket.IOクライアントインスタンス
  const [isConnected, setIsConnected] = useState(false); // WebSocket接続状態
  const [error, setError] = useState<string | null>(null);

  // ControlPanel のための状態 (設定適用時にAPIに送る用)
  const [numPersons, setNumPersons] = useState<number>(10); // Default value
  const [numObstacles, setNumObstacles] = useState<number>(5); // Default value
  const [obstacleAvgRadius, setObstacleAvgRadius] = useState<number>(0.5); // Default value
  const [obstacleShape, setObstacleShape] = useState<'random' | 'circle' | 'rectangle'>('random'); // Default value
  const [numDestinations, setNumDestinations] = useState<number>(1); // 目的地数の状態を追加 (初期値1)

  useEffect(() => {
    // Socket.IOクライアントの初期化と接続
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server.');
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server.');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setError(`WebSocket connection error: ${err.message}. Is the backend running?`);
      setIsConnected(false);
    });

    // シミュレーション状態更新イベントのリスナー
    newSocket.on('simulation_state_update', (data: any) => { // Use any for now
      if (import.meta.env.DEV) {
        console.log("Received state via WebSocket:", data); // ★ デバッグログ追加
      }
      setSimulationState(data);
      // TODO: Sync other control panel settings if needed based on received state
    });

    // コンポーネントのアンマウント時にクリーンアップ
    return () => {
      console.log("Disconnecting socket...");
      newSocket.disconnect();
    };
    // Empty dependency array: run only on mount/unmount
  }, []);

  // Generic API call handler
  const handleApiCall = async (endpoint: string, method: string = 'POST', body: object | null = null): Promise<any | null> => {
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${SOCKET_URL}${endpoint}`, options);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`API Error (${response.status}): ${errorData.message || 'Failed to fetch'}`);
      }
      return await response.json(); // Returns parsed JSON or null on error
    } catch (err: any) {
      console.error(`Error calling API endpoint ${endpoint}:`, err);
      setError(`API Call Error: ${err.message}`);
      return null; // Indicate error by returning null
    }
  };

  const handleStart = () => handleApiCall('/api/simulation/start');
  const handleStop = () => handleApiCall('/api/simulation/stop');

  // Apply Settings handler
  const handleApplySettings = useCallback(async (settings: {
    numPersons: number;
    numObstacles: number;
    obstacleAvgRadius: number;
    obstacleShape: 'random' | 'circle' | 'rectangle';
    numDestinations: number;
  }) => {
    console.log("Applying settings:", settings);
    // Update local state immediately
    setNumPersons(settings.numPersons);
    setNumObstacles(settings.numObstacles);
    setObstacleAvgRadius(settings.obstacleAvgRadius);
    setObstacleShape(settings.obstacleShape);
    setNumDestinations(settings.numDestinations);

    // Call reset API
    const result = await handleApiCall('/api/simulation/reset', 'POST', {
      num_persons: settings.numPersons,
      num_obstacles: settings.numObstacles,
      obstacle_avg_radius: settings.obstacleAvgRadius,
      obstacle_shape: settings.obstacleShape,
      num_destinations: settings.numDestinations
    });

    // Check API call result
    if (result !== null) {
      console.log("Settings applied via API.", result);
      // Optional: Verify backend response
      if (result.num_persons !== settings.numPersons) {
        console.warn(`Backend num_persons mismatch: ${result.num_persons}`);
        // Optionally re-sync local state: setNumPersons(result.num_persons);
      }
      if (result.num_destinations !== settings.numDestinations) {
         console.warn(`Backend num_destinations mismatch: ${result.num_destinations}`);
         // Optionally re-sync local state: setNumDestinations(result.num_destinations);
      }
      // Backend should emit new state via WebSocket
    } else {
      console.error("Failed to apply settings via API.");
      setError("Failed to apply settings. Check backend. UI might be out of sync.");
      // Optionally revert local state changes
    }
  }, []);

  return (
    <div className="App min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="text-center py-4 px-4 sm:px-6 lg:px-8 flex-shrink-0 border-b border-gray-700 bg-gray-800 shadow-md">
        <h1 className="text-3xl font-bold mb-1 text-indigo-400">yamob</h1>
        <p className="text-sm text-gray-500 mb-3">"Yet Another Mobility". It is library for mobility simulator.</p>
        <div className="text-center text-sm mt-1">
          {isConnected ? <span className="text-green-400">● 接続済み</span> : <span className="text-red-400">● 未接続</span>}
        </div>
        {error && (
          <div className="bg-red-800 text-red-100 p-3 mt-2 rounded border border-red-600 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
      </header>

      <main className="flex-grow flex flex-col md:flex-row overflow-hidden">
        <div className="flex-grow w-full h-[60vh] md:h-auto md:w-3/4 bg-gray-700 overflow-hidden">
          <SimulationCanvas
             persons={simulationState?.persons ?? []}
             environment={simulationState?.environment ?? { walls: [], obstacles: [] }}
             destinations={simulationState?.destinations}
           />
        </div>

        <div className="w-full md:w-1/4 bg-gray-800 p-4 overflow-y-auto shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-indigo-300">コントロールパネル</h2>
          <ControlPanel
            activeNumPersons={numPersons}
            activeNumObstacles={numObstacles}
            activeObstacleAvgRadius={obstacleAvgRadius}
            activeObstacleShape={obstacleShape}
            activeNumDestinations={numDestinations}
            onApplySettings={handleApplySettings}
          />
          <div className="mt-6 space-y-3">
            <button
              onClick={handleStart}
              disabled={!isConnected || simulationState?.is_running}
              className="w-full px-4 py-2 rounded font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              開始
            </button>
            <button
              onClick={handleStop}
              disabled={!isConnected || !simulationState?.is_running}
              className="w-full px-4 py-2 rounded font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              停止
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
