import React, { useState } from 'react';

// props の型を定義
interface ControlPanelProps {
  initialNumPersons: number;
  onNumPersonsChange: (numPersons: number) => void; // Renamed from onReset to be more specific
}

const ControlPanel: React.FC<ControlPanelProps> = ({ initialNumPersons, onNumPersonsChange }) => {
  // 人数を管理する state
  const [numPersons, setNumPersons] = useState<number>(initialNumPersons);

  // input の変更ハンドラ
  const handleNumChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    setNumPersons(isNaN(value) ? 0 : value);
  };

  // Renamed handleReset to handleApplyNumPersons and call onNumPersonsChange
  const handleApplyNumPersons = () => {
    onNumPersonsChange(numPersons);
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
            onChange={handleNumChange}
            className="block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-700 text-gray-100"
            min="1"
          />
        </div>
      </div>
    </div>
  );
};

export default ControlPanel; 