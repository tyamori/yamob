import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line, OrbitControls } from '@react-three/drei'; // Line と OrbitControls をインポート

// --- 型定義 (App.tsx と合わせる) ---
interface Vector2D {
  position: [number, number];
}
interface WallData {
  start: Vector2D;
  end: Vector2D;
}
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
  obstacles: ObstacleData[];
}
interface PersonData {
  id: number;
  position: [number, number];
}
// --- 型定義ここまで ---

// Person を描画するコンポーネント
const PersonAgent: React.FC<{ personData: PersonData }> = ({ personData }) => {
  const meshRef = useRef<THREE.Mesh>(null!); // null非許容アサーション

  // APIから取得した位置情報に合わせてメッシュの位置を更新
  // XZ平面上に配置 (Y座標は0とする)
  useFrame(() => {
    if (meshRef.current) {
      // バックエンドはXY平面、Three.jsはXZ平面が地面なので座標変換
      meshRef.current.position.set(personData.position[0], 0, personData.position[1]);
    }
  });

  return (
    <mesh ref={meshRef} key={personData.id}>
      <sphereGeometry args={[0.2, 16, 16]} /> {/* 半径0.2の球体 */}
      <meshStandardMaterial color={'red'} />
    </mesh>
  );
};

// 壁 (線分) を描画するコンポーネント
const WallLine: React.FC<{ wallData: WallData }> = ({ wallData }) => {
  // Vector3 に変換 (Y座標は0)
  const startVec = new THREE.Vector3(wallData.start.position[0], 0, wallData.start.position[1]);
  const endVec = new THREE.Vector3(wallData.end.position[0], 0, wallData.end.position[1]);
  return (
    <Line
      points={[startVec, endVec]}
      color="black"
      lineWidth={3} // 線幅
    />
  );
};

// Unified Obstacle component to render different shapes
const Obstacle: React.FC<{ obstacleData: ObstacleData }> = ({ obstacleData }) => {
  if (obstacleData.type === 'circle') {
    // Render cylinder for circle
    return (
      <mesh position={[obstacleData.center.position[0], 0.25, obstacleData.center.position[1]]}>
        {/* Use radius from CircleObstacleData */}
        <cylinderGeometry args={[obstacleData.radius, obstacleData.radius, 0.5, 32]} />
        <meshStandardMaterial color={'gray'} />
      </mesh>
    );
  } else if (obstacleData.type === 'rectangle') {
    // Render box for rectangle
    return (
      <mesh position={[obstacleData.center.position[0], 0.25, obstacleData.center.position[1]]}>
        {/* Use width/height from RectangleObstacleData. Depth is arbitrary (e.g., 0.5) */}
        <boxGeometry args={[obstacleData.width, 0.5, obstacleData.height]} />
        <meshStandardMaterial color={'dimgray'} /> {/* Different color for distinction */}
      </mesh>
    );
  }
  return null; // Should not happen with correct types
};

// SimulationCanvas コンポーネントの Props の型定義
interface SimulationCanvasProps {
  persons: PersonData[];
  environment: EnvironmentData; // environment を Props に追加
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ persons, environment }) => {
  return (
    <div className="w-full h-full">
      {/* Lowered camera Y, moved Z back, set OrbitControls target */}
      <Canvas camera={{ position: [5, 10, 18], fov: 55 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        {/* 地面: サイズを環境に合わせる (余裕を持たせる) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, -0.5, 5]}> {/* 中心を (5,5) あたりに */}
            <planeGeometry args={[25, 25]} /> {/* サイズ調整 */}
            <meshStandardMaterial color={'#dddddd'} side={THREE.DoubleSide}/>
        </mesh>

        {/* 環境データの描画 */}
        {environment.walls.map((wall, index) => (
          <WallLine key={`wall-${index}`} wallData={wall} />
        ))}
        {environment.obstacles.map((obstacle, index) => (
          <Obstacle key={`obstacle-${index}`} obstacleData={obstacle} />
        ))}

        {/* persons 配列をマップして PersonAgent を描画 */}
        {persons.map((person) => (
          <PersonAgent key={person.id} personData={person} />
        ))}

        {/* Set OrbitControls target to the center of the ground plane */}
        <OrbitControls target={[5, 0, 5]} />
      </Canvas>
    </div>
  );
};

export default SimulationCanvas; 