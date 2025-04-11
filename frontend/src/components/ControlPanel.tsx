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
    <div style={{ width: '30%', border: '1px solid lightgray', padding: '10px' }}>
      <h2>操作パネル</h2>
      {/* 人数が0以下、または実行中は開始ボタンを無効化 */}
      <button onClick={onStart} disabled={isRunning || numPersons <= 0}>開始</button>
      <button onClick={onStop} disabled={!isRunning}>停止</button>
      {/* 人数が0以下の場合はリセットボタンを無効化 */}
      <button onClick={handleResetClick} disabled={numPersons <= 0}>リセット</button>
      <hr />
      {/* パラメータ設定 UI */}
      <div>
        <label htmlFor="numPersonsInput" style={{ marginRight: '5px' }}>人数:</label>
        <input
          id="numPersonsInput"
          type="number"
          value={numPersons === 0 ? '' : numPersons} // 0 なら空文字表示
          onChange={handleNumPersonsChange}
          min="1" // HTML5 の最小値バリデーション
          style={{ width: "60px" }}
          disabled={isRunning} // 実行中は無効化
        />
      </div>
      {/* TODO: パラメータ設定 UI を追加 */}
      {/* <p>設定項目など</p> */}
    </div>
  );
};

export default ControlPanel; 