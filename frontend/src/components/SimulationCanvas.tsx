import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line, OrbitControls } from '@react-three/drei'; // Line と OrbitControls をインポート

// Linter Error 修正: ../types の代わりにインラインで型を定義
interface Vector2D {
  position: [number, number];
}
interface WallData {
  start: Vector2D;
  end: Vector2D;
}
interface ObstacleData {
  type: 'circle' | 'rectangle';
  center: Vector2D;
  radius?: number; // Optional for circle
  width?: number; // Optional for rectangle
  height?: number; // Optional for rectangle
}
interface EnvironmentData {
  walls: WallData[];
  obstacles: ObstacleData[];
}
interface PersonData {
  id: number;
  position: [number, number];
  velocity: [number, number];
  destination: [number, number];
  size?: number; // Linter Error 修正: size をオプショナルで追加
  speed?: number;
}
// 型定義ここまで

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

interface SimulationCanvasProps {
  persons: PersonData[];
  environment: EnvironmentData;
  destinations?: [number, number][]; // 目的地のリストを追加 (オプショナル)
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ persons, environment, destinations }) => {
  console.log("Canvas received destinations:", destinations); // ★ デバッグログ追加
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Drawing Logic ---
  const drawSimulation = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, scale: number) => {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Background
    ctx.fillStyle = '#374151'; // gray-700
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 1. Draw Environment Walls
    ctx.strokeStyle = '#9CA3AF'; // gray-400
    ctx.lineWidth = 2;
    environment.walls.forEach((wall: WallData) => {
      ctx.beginPath();
      ctx.moveTo(wall.start.position[0] * scale, wall.start.position[1] * scale);
      ctx.lineTo(wall.end.position[0] * scale, wall.end.position[1] * scale);
      ctx.stroke();
    });

    // 2. Draw Environment Obstacles
    environment.obstacles.forEach((obstacle: ObstacleData) => {
      if (obstacle.type === 'circle' && obstacle.radius !== undefined) {
        ctx.fillStyle = '#6B7280'; // gray-500
        ctx.beginPath();
        ctx.arc(obstacle.center.position[0] * scale, obstacle.center.position[1] * scale, obstacle.radius * scale, 0, Math.PI * 2);
        ctx.fill();
      } else if (obstacle.type === 'rectangle' && obstacle.width !== undefined && obstacle.height !== undefined) {
        ctx.fillStyle = '#6B7280'; // gray-500
        const halfWidth = (obstacle.width / 2) * scale;
        const halfHeight = (obstacle.height / 2) * scale;
        ctx.fillRect(
          (obstacle.center.position[0] * scale) - halfWidth,
          (obstacle.center.position[1] * scale) - halfHeight,
          obstacle.width * scale,
          obstacle.height * scale
        );
      }
    });

    // 3. Draw Destinations
    if (destinations) {
      ctx.fillStyle = '#EF4444'; // red-500
      ctx.strokeStyle = '#FCA5A5'; // red-300
      ctx.lineWidth = 1;
      const destRadius = 0.15 * scale; // 目的地の描画サイズ
      destinations.forEach(dest => {
        ctx.beginPath();
        ctx.arc(dest[0] * scale, dest[1] * scale, destRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke(); // Optional: add an outline
      });
    }

    // 4. Draw Persons
    ctx.fillStyle = '#34D399'; // emerald-400
    ctx.strokeStyle = '#A7F3D0'; // emerald-200
    ctx.lineWidth = 1;
    persons.forEach((person: PersonData) => {
      ctx.beginPath();
      // Use person.size if available, otherwise default
      const radius = (person.size ?? 0.2) * scale; // Linter Error 修正済み: size は PersonData に追加
      ctx.arc(person.position[0] * scale, person.position[1] * scale, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Optional: Draw velocity vector
      // Optional: Draw ID
    });
  };

  // --- Resize and Render Effect ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resizeCanvas = () => {
      // Get container dimensions
      const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
      canvas.width = containerWidth;
      canvas.height = containerHeight;

      // Determine scale (fit environment within canvas)
      // TODO: Get actual environment bounds if dynamic
      const envWidthUnits = 10; // Example environment width
      const envHeightUnits = 10; // Example environment height
      const scaleX = canvas.width / envWidthUnits;
      const scaleY = canvas.height / envHeightUnits;
      const scale = Math.min(scaleX, scaleY) * 0.95; // Use 95% to add some padding

      // Render loop
      const render = () => {
        drawSimulation(ctx, canvas.width, canvas.height, scale);
        animationFrameId = requestAnimationFrame(render);
      };
      render();
    };

    // Initial resize and render
    resizeCanvas();

    // Resize listener
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      resizeObserver.unobserve(container);
      cancelAnimationFrame(animationFrameId);
    };
    // Re-run effect if persons or environment data changes
  }, [persons, environment, destinations]); // destinations を依存配列に追加

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default SimulationCanvas; 