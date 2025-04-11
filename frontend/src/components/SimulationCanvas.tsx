import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line } from '@react-three/drei'; // Line をインポート

// --- 型定義 (App.tsx と合わせる) ---
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

// 障害物 (円柱) を描画するコンポーネント
const ObstacleCircle: React.FC<{ obstacleData: ObstacleData }> = ({ obstacleData }) => {
  return (
    // 位置を設定 (Y座標は円柱の高さの半分にするなど調整可)
    <mesh position={[obstacleData.center.position[0], 0.25, obstacleData.center.position[1]]}>
      <cylinderGeometry args={[obstacleData.radius, obstacleData.radius, 0.5, 32]} /> {/* 半径、高さ、分割数 */}
      <meshStandardMaterial color={'gray'} />
    </mesh>
  );
};

// SimulationCanvas コンポーネントの Props の型定義
interface SimulationCanvasProps {
  persons: PersonData[];
  environment: EnvironmentData; // environment を Props に追加
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ persons, environment }) => {
  return (
    <div style={{ width: '70%', height: '600px', border: '1px solid black', marginRight: '10px' }}>
      {/* カメラ位置調整 (全体が見えるように) */}
      <Canvas camera={{ position: [5, 20, 15], fov: 60 }}>
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
          <ObstacleCircle key={`obstacle-${index}`} obstacleData={obstacle} />
        ))}

        {/* persons 配列をマップして PersonAgent を描画 */}
        {persons.map((person) => (
          <PersonAgent key={person.id} personData={person} />
        ))}

        {/* <SpinningBox /> */} {/* 動作確認用キューブは削除 */}

      </Canvas>
    </div>
  );
};

export default SimulationCanvas; 