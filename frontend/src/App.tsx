import React, { useState, useEffect } from 'react';
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

const API_BASE_URL = 'http://localhost:5001/api';

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
  const [fetchIntervalId, setFetchIntervalId] = useState<NodeJS.Timeout | null>(null);

  const fetchSimulationState = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/simulation/state`);
      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}`);
        return;
      }
      // バックエンドからの生のデータを取得
      const rawData = await response.json();

      // 生データをフロントエンド用の構造化データに変換
      const formattedData: SimulationState = {
          time: rawData.time,
          persons: rawData.persons, // persons はそのまま使える想定
          is_running: rawData.is_running,
          environment: {
              // walls: [[[x,y],[x,y]], ...] -> [{start:{position:[x,y]}, end:{...}}, ...]
              walls: rawData.environment.walls.map((w: RawWallData) => ({ start: { position: w[0] }, end: { position: w[1] } })),
              // obstacles: [[x,y,r], ...] -> [{center:{position:[x,y]}, radius:r}, ...]
              obstacles: rawData.environment.obstacles.map((o: RawObstacleData) => ({ center: { position: [o[0], o[1]] }, radius: o[2] }))
          }
      };
      setSimulationState(formattedData);
    } catch (error) {
      console.error("Failed to fetch simulation state:", error);
    }
  };

  useEffect(() => {
    fetchSimulationState(); // 初回取得
    const intervalId = setInterval(fetchSimulationState, 100); // ポーリング開始
    setFetchIntervalId(intervalId);
    return () => {
      if (intervalId) clearInterval(intervalId); // クリーンアップ
    };
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
