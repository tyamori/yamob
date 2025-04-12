import time
from models import DataLoader, Simulator

# 1. データ読み込み (ダミー)
loader = DataLoader()
environment = loader.load_environment()
persons = loader.load_persons(num_persons=3) # 3人でテスト

# 2. シミュレーター初期化
simulator = Simulator(environment, persons)

# 3. シミュレーション実行
simulator.start()
dt = 0.1 # タイムステップ (秒)
simulation_steps = 50 # 50ステップ実行 (約5秒)

print("\n--- Starting Simulation Test ---")
print(f"Initial State: {simulator.get_state()}")

for i in range(simulation_steps):
    print(f"\n--- Step {i+1} ---")
    simulator.step(dt)
    # 実際のアプリケーションでは requestAnimationFrame などを使うが、テストなので単純な sleep
    # time.sleep(dt) # 必要ならコメント解除してゆっくり実行

print("\n--- Simulation Test Finished ---")
print(f"Final State: {simulator.get_state()}") 