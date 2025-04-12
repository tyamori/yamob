import React, { useState, useEffect } from 'react';

// props の型を定義
interface ControlPanelProps {
  initialNumPersons: number;
  onNumPersonsChange: (numPersons: number) => void; // Renamed from onReset to be more specific
  initialNumObstacles: number;
  onNumObstaclesChange: (numObstacles: number) => void;
  initialObstacleAvgRadius: number;
  onObstacleRadiusChange: (avgRadius: number) => void;
  obstacleShape: 'random' | 'circle' | 'rectangle';
  onObstacleShapeChange: (shape: 'random' | 'circle' | 'rectangle') => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  initialNumPersons,
  onNumPersonsChange,
  initialNumObstacles,
  onNumObstaclesChange,
  initialObstacleAvgRadius,
  onObstacleRadiusChange,
  obstacleShape,
  onObstacleShapeChange
}) => {
  // 人数を管理する state
  const [numPersons, setNumPersons] = useState<number>(initialNumPersons);
  const [numObstacles, setNumObstacles] = useState<number>(initialNumObstacles);
  const [obstacleAvgRadius, setObstacleAvgRadius] = useState<number>(initialObstacleAvgRadius);
  const [currentObstacleShape, setCurrentObstacleShape] = useState(obstacleShape);

  useEffect(() => { setNumPersons(initialNumPersons); }, [initialNumPersons]);
  useEffect(() => { setNumObstacles(initialNumObstacles); }, [initialNumObstacles]);
  useEffect(() => { setObstacleAvgRadius(initialObstacleAvgRadius); }, [initialObstacleAvgRadius]);
  useEffect(() => { setCurrentObstacleShape(obstacleShape); }, [obstacleShape]);

  // input の変更ハンドラ
  const handleNumPersonsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    const validValue = isNaN(value) || value < 1 ? 1 : value; // Ensure positive integer, default to 1
    setNumPersons(validValue);
    onNumPersonsChange(validValue); // Notify parent immediately (or use an apply button)
  };

  const handleNumObstaclesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    const validValue = isNaN(value) || value < 0 ? 0 : value; // Allow 0 obstacles
    setNumObstacles(validValue);
    onNumObstaclesChange(validValue); // Notify parent
  };

  const handleObstacleRadiusChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    const validValue = isNaN(value) || value <= 0 ? 0.1 : value; // Ensure positive float, default to 0.1
    setObstacleAvgRadius(validValue);
    onObstacleRadiusChange(validValue); // Notify parent
  };

  const handleShapeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newShape = event.target.value as 'random' | 'circle' | 'rectangle';
    setCurrentObstacleShape(newShape);
    onObstacleShapeChange(newShape); // Notify parent
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <label htmlFor="numPersons" className="block text-sm font-medium text-gray-300 mb-1">
          人数:
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            id="numPersons"
            value={numPersons}
            onChange={handleNumPersonsChange}
            className="block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-700 text-gray-100"
            min="1"
          />
        </div>
      </div>

      <div>
        <label htmlFor="numObstacles" className="block text-sm font-medium text-gray-300 mb-1">
          障害物の数:
        </label>
        <input
          type="number"
          id="numObstacles"
          value={numObstacles}
          onChange={handleNumObstaclesChange}
          className="block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-700 text-gray-100"
          min="0"
        />
      </div>

      <div>
        <label htmlFor="obstacleAvgRadius" className="block text-sm font-medium text-gray-300 mb-1">
          障害物 平均半径:
        </label>
        <input
          type="number"
          id="obstacleAvgRadius"
          value={obstacleAvgRadius}
          onChange={handleObstacleRadiusChange}
          className="block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-700 text-gray-100"
          min="0.1" // Minimum radius
          step="0.1" // Step for number input
        />
      </div>

      <div>
        <label htmlFor="obstacleShape" className="block text-sm font-medium text-gray-300 mb-1">
          障害物の形状:
        </label>
        <select
          id="obstacleShape"
          value={currentObstacleShape}
          onChange={handleShapeChange}
          className="block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-700 text-gray-100"
        >
          <option value="random">ランダム</option>
          <option value="circle">円</option>
          <option value="rectangle">矩形</option>
        </select>
      </div>
    </div>
  );
};

export default ControlPanel; 