import time
import threading
from flask import Flask, jsonify, request
from flask_cors import CORS # CORS対応のため追加
from models import DataLoader, Simulator
import copy # For deep copying state if needed

# --- Flask アプリケーション設定 ---
app = Flask(__name__)
CORS(app) # すべてのオリジンからのリクエストを許可 (開発用)

# --- シミュレーターとスレッド管理 ---
loader = DataLoader()
environment = loader.load_environment() # 初期環境 (ダミー)
persons = loader.load_persons(num_persons=10) # 初期人数 (ダミー)

simulator_lock = threading.Lock() # Simulatorインスタンスへのアクセスを保護
# simulatorインスタンスは可変なので、ロック内でアクセスする
simulator = Simulator(environment, persons)
simulation_thread = None
SIMULATION_DT = 0.05 # シミュレーションの時間ステップ (秒) - 20 FPS相当

def simulation_loop():
    """バックグラウンドでシミュレーションを実行するループ"""
    global simulator # グローバル変数 simulator を参照
    print("Simulation thread started.")
    while True:
        with simulator_lock:
            if not simulator.is_running:
                print("Simulator is not running, exiting loop.")
                break # is_runningがFalseになったらループを抜ける
            current_time = simulator.time # スリープ前に時間を取得
            simulator.step(SIMULATION_DT)

        # ループの周期を維持するためのスリープ
        # stepの実行時間を考慮するとより正確になるが、まずは単純なsleep
        sleep_time = SIMULATION_DT
        # print(f"Loop step done, sleeping for {sleep_time:.3f}s")
        time.sleep(sleep_time)
    print("Simulation thread finished.")

# --- API エンドポイント ---

@app.route('/api/config', methods=['GET'])
def get_config():
    with simulator_lock:
        # TODO: DataLoaderから実際のファイルパスなどを取得・返すようにする
        config = {
            "num_persons": len(simulator.persons),
            "environment_info": "Dummy Environment" # 仮
        }
    return jsonify(config)

@app.route('/api/config', methods=['POST'])
def update_config():
    global simulator, environment, persons, loader, simulation_thread
    data = request.get_json()
    num_persons = data.get('num_persons', 10) # デフォルト値を設定
    print(f"Received new config: {data}")

    # 既存のスレッドを停止
    stop_running_simulation()

    with simulator_lock:
        environment = loader.load_environment() # 再読み込み (ダミー)
        persons = loader.load_persons(num_persons=num_persons) # 再読み込み (ダミー)
        simulator = Simulator(environment, persons)
        print("Simulator re-initialized with new config.")

    return jsonify({"message": "Configuration updated and simulator reset.", "num_persons": num_persons})

@app.route('/api/simulation/start', methods=['POST'])
def start_simulation():
    global simulation_thread, simulator
    print("Attempting to start simulation...")
    with simulator_lock:
        if simulator.is_running:
            print("Simulation is already running.")
            return jsonify({"message": "Simulation is already running."}), 400 # Bad Request

        # 既にスレッドが存在しないか確認 (念のため)
        if simulation_thread is not None and simulation_thread.is_alive():
             print("Existing thread found, attempting to stop it first...")
             simulator.is_running = False # ループ停止フラグを立てる
             # ここで join するべきか？ start リクエストがブロックされる可能性
             # join しないと古いスレッドが残り続ける？ -> stop 側で join する設計にする
             # simulation_thread.join(timeout=1.0)
             # if simulation_thread.is_alive():
             #     print("Warning: Old simulation thread did not exit gracefully.")
             # simulation_thread = None
             # このアプローチは複雑なので、一旦 is_running フラグのみで制御

        simulator.is_running = True
        simulation_thread = threading.Thread(target=simulation_loop, daemon=True) # デーモンスレッドにする
        simulation_thread.start()
        print("Simulation thread initiated.")

    return jsonify({"message": "Simulation started."})

@app.route('/api/simulation/stop', methods=['POST'])
def stop_simulation():
    print("Attempting to stop simulation...")
    stop_running_simulation()
    return jsonify({"message": "Simulation stopped."})

def stop_running_simulation():
    """実行中のシミュレーションスレッドを停止するヘルパー関数"""
    global simulation_thread, simulator
    thread_to_join = None
    with simulator_lock:
        if not simulator.is_running and (simulation_thread is None or not simulation_thread.is_alive()):
            print("Simulation already stopped or no thread running.")
            return # 既に止まっているかスレッドがない

        print("Setting is_running to False.")
        simulator.is_running = False
        if simulation_thread is not None:
            thread_to_join = simulation_thread # join はロックの外で行う

    if thread_to_join is not None:
        print(f"Waiting for simulation thread ({thread_to_join.ident}) to join...")
        thread_to_join.join(timeout=2.0) # タイムアウト付きで待機
        if thread_to_join.is_alive():
            print(f"Warning: Simulation thread ({thread_to_join.ident}) did not stop within timeout.")
        else:
            print(f"Simulation thread ({thread_to_join.ident}) joined successfully.")
        # スレッド参照をクリア (新しいスレッドを安全に開始できるように)
        if simulation_thread is thread_to_join:
             simulation_thread = None
    else:
        print("No active simulation thread to join.")

@app.route('/api/simulation/reset', methods=['POST'])
def reset_simulation():
    global simulator, environment, persons, loader, simulation_thread
    print("Attempting to reset simulation...")

    # 既存のスレッドを停止
    stop_running_simulation()

    with simulator_lock:
        num_persons = len(simulator.persons) # リセット前の人数を引き継ぐ
        environment = loader.load_environment()
        persons = loader.load_persons(num_persons=num_persons)
        simulator = Simulator(environment, persons)
        print("Simulator reset to initial state.")

    return jsonify({"message": "Simulator reset."})

@app.route('/api/simulation/state', methods=['GET'])
def get_simulation_state():
    """現在のシミュレーション状態を返す (スレッドセーフ)"""
    with simulator_lock:
        # 状態オブジェクトをコピーして返すか、get_state内で安全に構築する
        # ここでは get_state が辞書を返すので、それをそのまま返す
        state = simulator.get_state()
    return jsonify(state)

# --- アプリケーション実行 ---
if __name__ == '__main__':
    print("Starting Flask app...")
    # use_reloader=False: デバッグモードでリローダーが複数スレッドを生成するのを防ぐ
    app.run(debug=True, host='0.0.0.0', port=5001, use_reloader=False) 