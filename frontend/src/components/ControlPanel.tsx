import React, { useState, useEffect } from 'react';

// Renamed initial props to reflect they are the last *active* settings
interface ControlPanelProps {
  activeNumPersons: number;
  activeNumObstacles: number;
  activeObstacleAvgRadius: number;
  activeObstacleShape: 'random' | 'circle' | 'rectangle';
  // Removed individual change handlers
  // Added a handler to apply all settings at once
  onApplySettings: (settings: {
    numPersons: number;
    numObstacles: number;
    obstacleAvgRadius: number;
    obstacleShape: 'random' | 'circle' | 'rectangle';
  }) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  activeNumPersons,
  activeNumObstacles,
  activeObstacleAvgRadius,
  activeObstacleShape,
  onApplySettings
}) => {
  // Local state for inputs, initialized by props
  const [numPersons, setNumPersons] = useState<number>(activeNumPersons);
  const [numObstacles, setNumObstacles] = useState<number>(activeNumObstacles);
  const [obstacleAvgRadius, setObstacleAvgRadius] = useState<number>(activeObstacleAvgRadius);
  const [obstacleShape, setObstacleShape] = useState(activeObstacleShape);

  // Sync local state if props change (e.g., after external reset or apply)
  useEffect(() => { setNumPersons(activeNumPersons); }, [activeNumPersons]);
  useEffect(() => { setNumObstacles(activeNumObstacles); }, [activeNumObstacles]);
  useEffect(() => { setObstacleAvgRadius(activeObstacleAvgRadius); }, [activeObstacleAvgRadius]);
  useEffect(() => { setObstacleShape(activeObstacleShape); }, [activeObstacleShape]);

  // Input change handlers now only update local state
  const handleNumPersonsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    setNumPersons(isNaN(value) || value < 1 ? 1 : value);
  };
  const handleNumObstaclesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    setNumObstacles(isNaN(value) || value < 0 ? 0 : value);
  };
  const handleObstacleRadiusChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setObstacleAvgRadius(isNaN(value) || value <= 0 ? 0.1 : value);
  };
  const handleShapeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setObstacleShape(event.target.value as 'random' | 'circle' | 'rectangle');
  };

  // Handler for the Apply Settings button
  const handleApplyClick = () => {
    onApplySettings({
      numPersons,
      numObstacles,
      obstacleAvgRadius,
      obstacleShape
    });
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
          value={obstacleShape}
          onChange={handleShapeChange}
          className="block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-700 text-gray-100"
        >
          <option value="random">ランダム</option>
          <option value="circle">円</option>
          <option value="rectangle">矩形</option>
        </select>
      </div>

      <button
        onClick={handleApplyClick}
        className="w-full px-4 py-2 rounded font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        設定を適用
      </button>
    </div>
  );
};

export default ControlPanel; 