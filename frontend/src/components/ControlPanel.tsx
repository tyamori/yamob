import React, { useState, useEffect } from 'react';

// props の型を定義
interface ControlPanelProps {
  onStart: () => void; // 開始ボタンクリック時のハンドラ
  onStop: () => void;  // 停止ボタンクリック時のハンドラ
  onReset: (numPersons: number) => void; // 人数を受け取るように変更
  isRunning: boolean; // シミュレーション実行中かどうかの状態
  initialNumPersons: number; // 親から初期人数を受け取る
}

const ControlPanel: React.FC<ControlPanelProps> = ({ onStart, onStop, onReset, isRunning, initialNumPersons }) => {
  // 人数を管理する state
  const [numPersons, setNumPersons] = useState<number>(initialNumPersons);

  // initialNumPersons prop が変更されたらローカル state を更新
  useEffect(() => {
    setNumPersons(initialNumPersons);
  }, [initialNumPersons]);

  // input の変更ハンドラ
  const handleNumPersonsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    // 正の整数のみ、または空文字の場合は 0 として扱う
    if (!isNaN(value) && value >= 0) {
      setNumPersons(value);
    } else if (event.target.value === '') {
      setNumPersons(0); 
    }
  };

  // リセットボタンクリック時の処理
  const handleResetClick = () => {
    if (numPersons > 0) {
      onReset(numPersons); // 入力された人数を渡す
    } else {
      console.warn("人数には1以上の数値を入力してください。");
      // TODO: ユーザーへのフィードバック表示 (例: アラートやメッセージ)
    }
  };

  return (
    // 基本的なパディングと境界線のみ
    <div className="p-4 border border-gray-400">
      <h2 className="text-lg font-bold mb-3">操作パネル</h2>
      <div className="space-y-2">
        {/* ボタン: 基本的なスタイルと無効状態のみ */}
        <button
          onClick={onStart}
          disabled={isRunning || numPersons <= 0}
          className={`w-full px-3 py-1 rounded ${isRunning || numPersons <= 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
        >
          開始
        </button>
        <button
          onClick={onStop}
          disabled={!isRunning}
          className={`w-full px-3 py-1 rounded ${!isRunning ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-500 text-white hover:bg-gray-600'}`}
        >
          停止
        </button>
        <button
          onClick={handleResetClick}
          disabled={numPersons <= 0}
          className={`w-full px-3 py-1 rounded ${numPersons <= 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'}`}
        >
          リセット
        </button>
      </div>
      <hr className="my-3" />
      <div>
        <label htmlFor="numPersonsInput" className="block text-sm mb-1">
          人数:
        </label>
        <input
          id="numPersonsInput"
          type="number"
          value={numPersons === 0 ? '' : numPersons}
          onChange={handleNumPersonsChange}
          min="1"
          // 基本的な入力欄スタイル
          className={`w-20 px-2 py-1 border border-gray-300 rounded ${isRunning ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          disabled={isRunning}
          placeholder="1以上"
        />
      </div>
    </div>
  );
};

export default ControlPanel; 