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
      // console.log('Received state update:', formattedState.time);
    });

    // エラーハンドリング
    socket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected from Socket.IO server:', reason);
        // 再接続ロジックは socket.io-client が自動で行うが、必要ならここで追加処理
    });

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
        <ControlPanel />
      </div>
    </div>
  );
}

export default App;
