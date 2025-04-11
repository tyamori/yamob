import React from 'react';

const API_BASE_URL = 'http://localhost:5001/api'; // APIのベースURL

const ControlPanel: React.FC = () => {
  // TODO: API通信と状態管理を実装
  const handleStart = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/simulation/start`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Start simulation response:', data);
      // TODO: アプリケーションの状態を更新 (例: isRunning フラグ)
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
      // TODO: アプリケーションの状態を更新
    } catch (error) {
      console.error("Failed to stop simulation:", error);
    }
  };

  const handleReset = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/simulation/reset`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Reset simulation response:', data);
      // TODO: アプリケーションの状態を更新し、表示をリセット
    } catch (error) {
      console.error("Failed to reset simulation:", error);
    }
  };

  return (
    <div style={{ width: '30%', border: '1px solid lightgray', padding: '10px' }}>
      <h2>操作パネル</h2>
      <button onClick={handleStart}>開始</button>
      <button onClick={handleStop}>停止</button>
      <button onClick={handleReset}>リセット</button>
      <hr />
      {/* TODO: パラメータ設定 UI を追加 */}
      <p>設定項目など</p>
    </div>
  );
};

export default ControlPanel; 