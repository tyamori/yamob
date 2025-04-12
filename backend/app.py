import eventlet
# 他のどのimportよりも先にモンキーパッチを実行
eventlet.monkey_patch()

import time
import threading
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from models import DataLoader, Simulator
import copy

# eventlet によるモンキーパッチ (標準ライブラリのブロッキング操作をノンブロッキングに)
# eventlet.monkey_patch() # ← ここから移動

# --- Flask アプリケーション設定 ---
app = Flask(__name__)
# SocketIO の設定を追加 (CORS を許可)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
CORS(app) # コメント解除して Flask アプリ全体で CORS を有効化

# --- シミュレーターとスレッド管理 ---
loader = DataLoader()
environment = loader.load_environment()
# persons = loader.load_persons(num_persons=10) # 修正前

# デフォルトの目的地数（必要に応じて変更）
initial_num_destinations = 1
persons_data, destinations_data = loader.load_persons(
    num_persons=10,
    num_destinations=initial_num_destinations
)

# SIMULATION_DT を Simulator 初期化の前に定義する
SIMULATION_DT = 0.05 # シミュレーションの時間刻み (秒)

simulator_lock = threading.Lock()
# Simulator の初期化時に dt と destinations_data を渡す
simulator = Simulator(environment, persons_data, destinations_data, dt=SIMULATION_DT)
simulation_thread = None

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
            simulator.step()
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
    num_destinations_config = data.get('num_destinations', 1) # 目的地数を取得 (デフォルト1)
    print(f"Received new config: {data}")

    # 既存のスレッドを停止
    stop_running_simulation()

    with simulator_lock:
        environment = loader.load_environment() # 再読み込み (ダミー)
        # 目的地数を load_persons に渡す
        persons_data, destinations_data = loader.load_persons(
            num_persons=num_persons,
            num_destinations=num_destinations_config
        )
        # Simulator の初期化時に destinations_data を渡す
        simulator = Simulator(environment, persons_data, destinations_data, dt=SIMULATION_DT)
        print("Simulator re-initialized with new config.")

    # 再初期化後の状態を取得
    current_state = simulator.get_state()
    # 再初期化後の状態をemit
    socketio.emit('simulation_state_update', current_state)
    print("Emitted state after config update.")
    return jsonify({
        "message": "Configuration updated and simulator reset.",
        "num_persons": num_persons,
        "num_destinations": num_destinations_config # レスポンスにも含める
    })

@app.route('/api/simulation/start', methods=['POST'])
def start_simulation():
    global simulation_thread, simulator, environment, persons, loader
    print("Attempting to start simulation...")
    state_changed = False
    current_state = None

    with simulator_lock:
        if not simulator.is_running:
            if simulator.is_simulation_complete():
                print("Simulation completed previously. Resetting before starting...")
                num_persons_reset = len(simulator.persons) if simulator.persons else 10
                num_destinations_reset = len(simulator.destinations) if simulator.destinations else 1
                print(f"Resetting with {num_persons_reset} persons, {num_destinations_reset} destinations.")
                persons_data, destinations_data = loader.load_persons(
                    num_persons=num_persons_reset,
                    num_destinations=num_destinations_reset
                )
                simulator = Simulator(environment, persons_data, destinations_data, dt=SIMULATION_DT)
                print("Simulator re-initialized with new agents and destinations.")

            simulator.is_running = True
            simulation_thread = threading.Thread(target=simulation_loop, daemon=True)
            simulation_thread.start()
            print("Simulation thread initiated.")
            state_changed = True
            current_state = simulator.get_state()
        else:
            print("Simulation is already running.")
            current_state = simulator.get_state()

    if current_state:
        socketio.emit('simulation_state_update', current_state)
        print(f"Emitted state after start request. is_running: {current_state['is_running']}")

    if state_changed:
        return jsonify({"message": "Simulation started (or reset and started)."})
    else:
        return jsonify({"message": "Simulation is already running."}), 400

@app.route('/api/simulation/stop', methods=['POST'])
def stop_simulation():
    print("Attempting to stop simulation...")
    stop_running_simulation()
    return jsonify({"message": "Simulation stop requested."})

def stop_running_simulation():
    """実行中のシミュレーションスレッドを停止し、状態をemitするヘルパー関数"""
    global simulation_thread, simulator
    thread_to_join = None
    state_changed = False
    with simulator_lock:
        if simulator.is_running: # 実行中なら停止処理
            print("Setting is_running to False.")
            simulator.is_running = False
            state_changed = True
            if simulation_thread is not None:
                thread_to_join = simulation_thread
        else:
            print("Simulation already stopped or no thread running.")

    if thread_to_join is not None:
        print(f"Waiting for simulation thread ({thread_to_join.ident}) to join...")
        thread_to_join.join(timeout=2.0)
        if thread_to_join.is_alive():
            print(f"Warning: Simulation thread ({thread_to_join.ident}) did not stop within timeout.")
        else:
            print(f"Simulation thread ({thread_to_join.ident}) joined successfully.")
        if simulation_thread is thread_to_join:
             simulation_thread = None

    # 状態が変更されたか、現在の状態を返すために emit
    with simulator_lock:
        current_state = simulator.get_state() # 最新の状態を取得
    socketio.emit('simulation_state_update', current_state)
    print(f"Emitted state after stop attempt. is_running: {current_state['is_running']}")
    # この関数は他のエンドポイントから呼ばれるのでここでは return しない

@app.route('/api/simulation/reset', methods=['POST'])
def reset_simulation():
    global simulator, environment, persons, loader, simulation_thread
    print("Attempting to reset simulation...")

    # リクエストボディからパラメータを取得
    data = request.get_json(silent=True) or {}
    num_persons_from_request = data.get('num_persons')
    num_obstacles_from_request = data.get('num_obstacles', 5)
    obstacle_avg_radius_from_request = data.get('obstacle_avg_radius', 0.5)
    obstacle_shape_from_request = data.get('obstacle_shape', 'random')
    num_destinations_from_request = data.get('num_destinations', 1) # 目的地数を取得 (デフォルト1)

    # 既存のスレッドを停止
    stop_running_simulation()

    with simulator_lock:
        # 人数の決定ロジック (変更なし)
        if num_persons_from_request is not None and isinstance(num_persons_from_request, int) and num_persons_from_request > 0:
            num_persons = num_persons_from_request
            print(f"Resetting with num_persons from request: {num_persons}")
        else:
            num_persons = len(simulator.persons) if simulator and len(simulator.persons) > 0 else 10
            print(f"Resetting with previous or default num_persons: {num_persons}")
            if num_persons_from_request is not None:
                 print(f"(Invalid num_persons in request: {num_persons_from_request})")

        # Pass all parameters including shape to load_environment
        print(f"Loading environment with {num_obstacles_from_request} obstacles (Shape: {obstacle_shape_from_request}), avg radius {obstacle_avg_radius_from_request}")
        environment = loader.load_environment(
            num_obstacles=num_obstacles_from_request,
            avg_radius=obstacle_avg_radius_from_request,
            obstacle_shape=obstacle_shape_from_request # Pass the shape
        )
        # 目的地数を load_persons に渡す
        persons_data, destinations_data = loader.load_persons(
            num_persons=num_persons,
            num_destinations=num_destinations_from_request
        )
        # Simulator の初期化時に destinations_data を渡す
        simulator = Simulator(environment, persons_data, destinations_data, dt=SIMULATION_DT)
        print("Simulator reset to initial state.")
        current_state = simulator.get_state()

    # リセット後の状態を emit
    socketio.emit('simulation_state_update', current_state)
    print("Emitted state after reset.")

    # Return values including obstacle params and destinations for confirmation
    return jsonify({
        "message": "Simulator reset.",
        "num_persons": num_persons,
        "num_obstacles": num_obstacles_from_request,
        "obstacle_avg_radius": obstacle_avg_radius_from_request,
        "obstacle_shape": obstacle_shape_from_request,
        "num_destinations": num_destinations_from_request # レスポンスにも含める
    })

@app.route('/api/simulation/state', methods=['GET'])
def get_simulation_state():
    """現在のシミュレーション状態を返す (スレッドセーフ)"""
    with simulator_lock:
        state = simulator.get_state()
    return jsonify(state)

# --- SocketIO イベントハンドラ (接続/切断など、必要に応じて追加) ---
@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')
    # 接続時に現在の状態を送る
    with simulator_lock:
        state = simulator.get_state()
    emit('simulation_state_update', state, to=request.sid)

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