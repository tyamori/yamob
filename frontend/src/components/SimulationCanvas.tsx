import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Personデータの型定義 (App.tsx と合わせる)
interface PersonData {
  id: number;
  position: [number, number]; // [x, y]
}

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

// SimulationCanvas コンポーネントの Props の型定義
interface SimulationCanvasProps {
  persons: PersonData[];
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ persons }) => {
  return (
    <div style={{ width: '70%', height: '600px', border: '1px solid black', marginRight: '10px' }}>
      {/* カメラ位置・角度を調整 */}
      <Canvas camera={{ position: [0, 15, 15], fov: 60, rotation: [-Math.PI / 4, 0, 0] }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        {/* 地面: 少し下げて、サイズも調整 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color={'#cccccc'} side={THREE.DoubleSide}/>
        </mesh>

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