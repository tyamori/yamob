import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import './App.css';
import SimulationCanvas from './components/SimulationCanvas';
import ControlPanel from './components/ControlPanel';

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

// Socket.IO サーバーの URL (バックエンドと同じポート)
const SOCKET_SERVER_URL = 'http://localhost:5001';

// --- API & Socket URLs ---
const API_BASE_URL = 'http://localhost:5001/api'; // API ベース URL を追加

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
      const response = await fetch(`${API_BASE_URL}/simulation/start`, { method: 'POST' });
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
      const response = await fetch(`${API_BASE_URL}/simulation/stop`, { method: 'POST' });
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

  const handleReset = async (numPersons: number) => { // 引数で人数を受け取る
    console.log(`Resetting simulation with ${numPersons} persons...`);
    try {
      const response = await fetch(`${API_BASE_URL}/simulation/reset`, {
         method: 'POST',
         headers: {
             'Content-Type': 'application/json',
         },
         // リクエストボディに人数を含める
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

  useEffect(() => {
    // Socket.IO サーバーに接続
    // 既に接続済み、または接続試行中なら何もしない (再レンダリング対策)
    if (socketRef.current) return;

    socketRef.current = io(SOCKET_SERVER_URL, {
        reconnectionAttempts: 5, // 再接続試行回数
        reconnectionDelay: 1000, // 再接続遅延 (ms)
    });
    console.log('Connecting to Socket.IO server...');

    const socket = socketRef.current; // 以降 socket 変数でアクセス

    // 接続成功時の処理
    socket.on('connect', () => {
      console.log('Connected to Socket.IO server with id:', socket.id);
    });

    // 'simulation_state_update' イベントをリッスン
    socket.on('simulation_state_update', (newState: RawSimulationState) => {
      // バックエンドからのデータ形式に合わせて変換
      const formattedState: SimulationState = {
          ...newState,
          environment: {
              walls: newState.environment.walls.map((w) => ({ start: { position: w[0] }, end: { position: w[1] } })),
              obstacles: newState.environment.obstacles.map((o) => ({ center: { position: [o[0], o[1]] }, radius: o[2] }))
          }
      };
      setSimulationState(formattedState);
      // WebSocket で状態更新があった場合も ControlPanel の人数を同期する
      setInitialNumPersons(formattedState.persons.length);
    });

    // エラーハンドリング
    socket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected from Socket.IO server:', reason);
        // 再接続ロジックは socket.io-client が自動で行うが、必要ならここで追加処理
    });

    // WebSocket 接続時の初期状態取得（APIを叩く）
    // バックエンドの /api/simulation/state エンドポイントから初期状態を取得
    const fetchInitialState = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/simulation/state`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const initialState: RawSimulationState = await response.json();
        // 状態をフォーマットしてセット
        const formattedState: SimulationState = {
          ...initialState,
          environment: {
              walls: initialState.environment.walls.map((w) => ({ start: { position: w[0] }, end: { position: w[1] } })),
              obstacles: initialState.environment.obstacles.map((o) => ({ center: { position: [o[0], o[1]] }, radius: o[2] }))
          }
        };
        setSimulationState(formattedState);
        // ControlPanel の初期人数も設定
        setInitialNumPersons(formattedState.persons.length);
        console.log('Fetched initial state:', formattedState);
      } catch (error) {
        console.error("Failed to fetch initial state:", error);
        // エラー時もデフォルト値で初期化される
        setInitialNumPersons(10); // エラー時はデフォルト値に戻す
      }
    };

    fetchInitialState(); // 初回マウント時に実行

    // コンポーネントのアンマウント時に切断
    return () => {
      console.log('Disconnecting from Socket.IO server...');
      socket.disconnect();
      socketRef.current = null; // ref をクリア
    };
  }, []); // マウント時に一度だけ実行

  return (
    <div className="App">
      <h1>人流シミュレーター</h1>
      <p>Simulation Time: {simulationState.time.toFixed(2)}</p>
      <p>Status: {simulationState.is_running ? 'Running' : 'Stopped'}</p>
      <div style={{ display: 'flex' }}>
        {/* environment データも渡す */}
        <SimulationCanvas
          persons={simulationState.persons}
          environment={simulationState.environment}
        />
        {/* ControlPanel にハンドラ関数と is_running 状態を渡す */}
        <ControlPanel
          onStart={handleStart}
          onStop={handleStop}
          onReset={handleReset}
          isRunning={simulationState.is_running}
          initialNumPersons={initialNumPersons}
        />
      </div>
    </div>
  );
}

export default App;
