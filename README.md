# yamob

"Yet Another Mobility". It is library for mobility simulator.

これは、Webベースのリアルタイム人流シミュレーションアプリケーションです。Python (Flask, RVO2) で構築されたバックエンドと、TypeScript, React, HTML Canvas で構築されたフロントエンドで構成されています。

## 機能概要

*   指定されたパラメータに基づき、環境内にエージェント（人）と障害物を配置します。
*   エージェントは指定された目的地（壁際のランダムな地点）に向かって移動します。
*   RVO2ライブラリを使用してリアルタイムな衝突回避を行います。
*   コントロールパネルからシミュレーションのパラメータ（人数、障害物、目的地数など）を設定できます。
*   シミュレーションの開始、停止、リセットが可能です。
*   WebSocket を使用して、シミュレーションの状態をリアルタイムにフロントエンドに反映します。

## 技術スタック

*   **バックエンド:**
    *   Python 3.11+
    *   Flask
    *   Flask-SocketIO
    *   python-socketio
    *   eventlet
    *   NumPy
    *   Pydantic
    *   RVO2 (via `git+https://github.com/sybrenstuvel/Python-RVO2.git`)
*   **フロントエンド:**
    *   Node.js (v18+ 推奨)
    *   TypeScript
    *   React
    *   Vite
    *   HTML Canvas API (描画用)
    *   Tailwind CSS
    *   Socket.IO Client

## 開発環境構築

### 必要条件

*   Python (3.11以上推奨) と pip
*   Node.js (v18以上推奨) と npm または yarn
*   Git

### 手順

1.  **リポジトリをクローン:**
    ```bash
    git clone https://github.com/tyamori/yamob.git # リポジトリのURLを更新
    cd yamob
    ```

2.  **バックエンドの設定:**
    *   **(オプション)** Python 仮想環境の作成と有効化:
        ```bash
        python -m venv venv
        source venv/bin/activate  # Linux/macOS
        # venv\\Scripts\\activate    # Windows
        ```
    *   必要な Python パッケージをインストール:
        ```bash
        pip install -r requirements.txt
        ```

3.  **フロントエンドの設定:**
    *   フロントエンドディレクトリに移動:
        ```bash
        cd frontend
        ```
    *   必要な Node.js パッケージをインストール:
        ```bash
        npm install
        # または yarn install
        ```
    *   **(オプション)** 環境変数の設定:
        ルートディレクトリの `frontend` フォルダ内に `.env` ファイルを作成し、必要に応じてバックエンドサーバーの URL を設定します（デフォルトは `http://localhost:5001`）。
        ```.env
        VITE_SOCKET_URL=http://localhost:5001
        ```
    *   ルートディレクトリに戻る:
        ```bash
        cd ..
        ```

## 実行方法

1.  **バックエンドサーバーの起動:**
    *   リポジトリのルートディレクトリで以下のコマンドを実行します。
    *   (仮想環境を使用している場合は有効化してください)
    ```bash
    python backend/app.py
    ```
    *   デフォルトでは `http://localhost:5001` でバックエンドサーバーが起動します。

2.  **フロントエンド開発サーバーの起動:**
    *   別のターミナルを開き、`frontend` ディレクトリに移動します。
    ```bash
    cd frontend
    npm run dev
    # または yarn dev
    ```
    *   デフォルトでは `http://localhost:5173` (または別のポート) で開発サーバーが起動します。

3.  **ブラウザでアクセス:**
    *   Web ブラウザでフロントエンド開発サーバーの URL (例: `http://localhost:5173`) を開きます。
    *   コントロールパネルで設定を調整し、「開始」ボタンでシミュレーションを開始できます。

## コントリビューション

コントリビューションを歓迎します！

1.  改善したい点やバグについて Issue を作成してください。
2.  このリポジトリをフォークしてください。
3.  新しい機能や修正のためのブランチを作成してください (`git checkout -b feature/AmazingFeature`)。
4.  変更をコミットしてください (`git commit -m 'Add some AmazingFeature'`)。
5.  ブランチにプッシュしてください (`git push origin feature/AmazingFeature`)。
6.  Pull Request を作成してください。

## ライセンス

このプロジェクトは **MIT ライセンス** の下で公開されています。詳細については `LICENSE` ファイル（まだ作成されていません）を参照してください。

**依存ライブラリのライセンスについて:**
このプロジェクトは、MIT, BSD, Apache License 2.0 など、様々なオープンソースライセンスの下で配布されているライブラリに依存しています。特に、コアとなる衝突回避機能は RVO2 ライブラリ (Apache License 2.0) を利用しています。依存関係のライセンス詳細は各ライブラリのドキュメント等をご確認ください。
