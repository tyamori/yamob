from flask import Flask, jsonify, request
from flask_cors import CORS # CORS対応のため追加
from models import DataLoader, Simulator

# --- Flask アプリケーション設定 ---
app = Flask(__name__)
CORS(app) # すべてのオリジンからのリクエストを許可 (開発用)

# --- シミュレーターインスタンスの準備 ---
# グローバル変数としてシミュレーターを保持 (シンプルな例)
# TODO: アプリケーションコンテキストなど、より良い状態管理方法を検討
loader = DataLoader()
environment = loader.load_environment() # 初期環境 (ダミー)
persons = loader.load_persons(num_persons=10) # 初期人数 (ダミー)
simulator = Simulator(environment, persons)
# TODO: シミュレーションを別スレッドで実行する仕組みが必要
# (stepを定期的に呼び出す or start時にループ開始)
# 今は /api/simulation/state が呼ばれるたびに1ステップ進む仮実装にする

# --- API エンドポイント ---

@app.route('/api/config', methods=['GET'])
def get_config():
    """現在の設定情報を返す (今はダミー)"""
    # TODO: DataLoaderから実際のファイルパスなどを取得・返すようにする
    config = {
        "num_persons": len(simulator.persons),
        "environment_info": "Dummy Environment" # 仮
    }
    return jsonify(config)

@app.route('/api/config', methods=['POST'])
def update_config():
    """設定を更新してシミュレーターをリセット"""
    global simulator, environment, persons, loader
    data = request.get_json()
    num_persons = data.get('num_persons', len(simulator.persons))
    # TODO: ファイルパス等を受け取って load_environment, load_persons を呼び出す
    print(f"Received new config: {data}")

    environment = loader.load_environment() # 再読み込み (ダミー)
    persons = loader.load_persons(num_persons=num_persons) # 再読み込み (ダミー)
    simulator = Simulator(environment, persons)
    print("Simulator re-initialized with new config.")
    return jsonify({"message": "Configuration updated and simulator reset.", "num_persons": num_persons})

@app.route('/api/simulation/start', methods=['POST'])
def start_simulation():
    """シミュレーションを開始"""
    simulator.start()
    # TODO: 別スレッドでシミュレーションループを開始する処理
    return jsonify({"message": "Simulation started."})

@app.route('/api/simulation/stop', methods=['POST'])
def stop_simulation():
    """シミュレーションを停止"""
    simulator.stop()
    # TODO: シミュレーションループを停止する処理
    return jsonify({"message": "Simulation stopped."})

@app.route('/api/simulation/reset', methods=['POST'])
def reset_simulation():
    """シミュレーションを初期状態にリセット"""
    global simulator, environment, persons, loader
    # 現在の設定に基づいてリセット (update_config と似ているが、設定変更は伴わない想定)
    # TODO: より明確なリセットロジック (例: configから人数を取得)
    num_persons = len(simulator.persons) # 現在の人数でリセット
    environment = loader.load_environment()
    persons = loader.load_persons(num_persons=num_persons)
    simulator = Simulator(environment, persons)
    print("Simulator reset to initial state.")
    return jsonify({"message": "Simulator reset."})

@app.route('/api/simulation/state', methods=['GET'])
def get_simulation_state():
    """現在のシミュレーション状態を返す"""
    # --- 重要: 仮実装 ---
    # 本来は別スレッドでシミュレーションが進行している想定。
    # このAPIが呼ばれるたびに1ステップ進めるのは一時的な措置。
    if simulator.is_running:
        simulator.step(dt=0.1) # dtは固定値 (仮)
    # --- 仮実装ここまで ---

    state = simulator.get_state()
    return jsonify(state)

# --- アプリケーション実行 ---
if __name__ == '__main__':
    # debug=True は開発用。本番環境では False にし、適切なWebサーバー(Gunicornなど)を使用する
    app.run(debug=True, host='0.0.0.0', port=5001) # ポートを 5001 に変更 (React開発サーバーと区別) 