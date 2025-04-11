import time
import threading
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from models import DataLoader, Simulator
import copy
import eventlet

# eventlet によるモンキーパッチ (標準ライブラリのブロッキング操作をノンブロッキングに)
eventlet.monkey_patch()

# --- Flask アプリケーション設定 ---
app = Flask(__name__)
# SocketIO の設定を追加 (CORS を許可)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
# CORS(app) # Flask-CORS は SocketIO が処理するので不要になることが多い

# --- シミュレーターとスレッド管理 ---
loader = DataLoader()
environment = loader.load_environment()
persons = loader.load_persons(num_persons=10)

simulator_lock = threading.Lock()
simulator = Simulator(environment, persons)
simulation_thread = None
SIMULATION_DT = 0.05

def simulation_loop():
    """バックグラウンドでシミュレーションを実行し、状態を WebSocket で emit するループ"""
    global simulator, socketio
    print("Simulation thread started.")
    last_emit_time = time.time()
    EMIT_INTERVAL = 0.1 # 状態を emit する間隔 (秒) - 約10 FPS

    while True:
        loop_start_time = time.time()
        state_to_emit = None # emit する状態を格納する変数

        with simulator_lock:
            if not simulator.is_running:
                print("Simulator is not running, exiting loop.")
                break
            simulator.step(SIMULATION_DT)
            # emit 間隔に基づいて状態を取得
            current_time = time.time()
            if current_time - last_emit_time >= EMIT_INTERVAL:
                 state_to_emit = simulator.get_state() # emit する状態を取得
                 last_emit_time = current_time

        # ロックの外で emit を行う (emit はブロッキングする可能性があるため)
        if state_to_emit:
            # 'simulation_state_update' というイベント名で状態を送信
            socketio.emit('simulation_state_update', state_to_emit)
            # print(f"Emitted state at time {state_to_emit['time']:.2f}")

        # ループの実行時間を考慮してスリープ時間を計算
        loop_end_time = time.time()
        elapsed_time = loop_end_time - loop_start_time
        sleep_time = max(0, SIMULATION_DT - elapsed_time)
        # time.sleep(sleep_time) # eventlet を使う場合は socketio.sleep が推奨される
        socketio.sleep(sleep_time)

    print("Simulation thread finished.")

# --- API エンドポイント (変更なし、ただし state から step 削除) ---
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

# --- SocketIO イベントハンドラ (接続/切断など、必要に応じて追加) ---
@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')
    # 接続時に現在の状態を送ることも可能
    # with simulator_lock:
    #     state = simulator.get_state()
    # emit('simulation_state_update', state, to=request.sid)

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')

# --- アプリケーション実行 (socketio.run に変更) ---
if __name__ == '__main__':
    print("Starting Flask-SocketIO app with eventlet...")
    # host='0.0.0.0' を指定して外部からの接続を受け付ける
    # port は 5001 のまま
    socketio.run(app, host='0.0.0.0', port=5001, debug=False)
    # 注意: Flask-SocketIO + eventlet/gevent では Flask の debug=True は推奨されない
    # リローダーは use_reloader=False 相当になるはず 