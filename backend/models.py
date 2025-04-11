import numpy as np

class Environment:
    """
    地形データを管理するクラス。
    壁、障害物、地面の傾斜などの情報を持つ。
    """
    def __init__(self, walls=[], obstacles=[], slopes=[]):
        # データ形式:
        # walls: [[[x1_start, y1_start], [x1_end, y1_end]], ...]
        # obstacles: [[center_x, center_y, radius], ...]
        self.walls = walls
        self.obstacles = obstacles
        self.slopes = slopes
        # TODO: 地形データの具体的な表現方法を定義 (例: ポリゴン、グリッドなど)
        # TODO: is_accessible で壁や障害物を考慮するようにする

    def is_accessible(self, position):
        """指定された位置が通行可能か判定する (壁と障害物を考慮)"""
        # 仮実装: 今は常に True だが、将来的にはここで判定
        # 例: 点と線分の距離、点と円の距離を計算して衝突判定
        # print(f"Checking accessibility for position: {position}")
        return True

class Person:
    """
    人物エージェントを表すクラス。
    位置、速度、目的地、歩行速度、大きさなどの属性を持つ。
    """
    def __init__(self, id, initial_position, speed, size, destination):
        self.id = id
        self.position = np.array(initial_position, dtype=float)
        self.speed = speed # 目標速度 (スカラー)
        self.size = size # 半径など
        self.destination = np.array(destination, dtype=float)
        self.velocity = np.zeros(len(initial_position), dtype=float) # 現在の速度ベクトル
        self.path = [] # 計算された経路 (オプション)
        # TODO: 状態 (例: 'moving', 'waiting', 'reached') などを追加検討

    def update_velocity(self, dt, environment, other_persons):
        """目的地や周囲の状況に応じて速度ベクトルを更新する"""
        # TODO: 移動ロジック (例: Social Force Model, RVO) を実装
        # とりあえず目的地に向かうベクトルを計算 (仮)
        direction_to_destination = self.destination - self.position
        distance = np.linalg.norm(direction_to_destination)

        if distance < 0.1: # 目的地に到着
            self.velocity = np.zeros_like(self.velocity)
            return

        # 正規化して目標速度をかける
        desired_velocity = (direction_to_destination / distance) * self.speed

        # 現在の速度から目標速度へ向かう (単純なステアリング)
        steering = desired_velocity - self.velocity
        # steering = steering / self.mass # 質量を考慮する場合
        # 力を制限する場合: steering = np.clip(steering, -max_force, max_force)

        self.velocity += steering * dt # 加速度として適用 (dtは時間ステップ)
        # 速度を制限する場合: speed_mag = np.linalg.norm(self.velocity)
        # if speed_mag > self.speed:
        #     self.velocity = (self.velocity / speed_mag) * self.speed

        print(f"Person {self.id} velocity updated to: {self.velocity}") # 仮実装

    def move(self, dt, environment):
        """速度ベクトルに基づいて位置を更新する"""
        potential_position = self.position + self.velocity * dt

        # TODO: 衝突検知と応答 (Environment.is_accessible などを使用)
        if environment.is_accessible(potential_position):
             self.position = potential_position
        else:
             # 衝突した場合の処理 (例: 速度をゼロにする、反射するなど)
             self.velocity = np.zeros_like(self.velocity)
             print(f"Person {self.id} movement blocked at {potential_position}")

        print(f"Person {self.id} moved to: {self.position}") # 仮実装

class Simulator:
    """
    シミュレーション全体を管理するクラス。
    シミュレーションループ、時間管理、各コンポーネントの連携を行う。
    """
    def __init__(self, environment, persons):
        self.environment = environment
        self.persons = {person.id: person for person in persons} # IDでアクセス可能に
        self.time = 0.0
        self.is_running = False

    def step(self, dt):
        """シミュレーションを1ステップ進める"""
        if not self.is_running:
            return

        # 1. 各Personの速度を更新
        all_persons = list(self.persons.values())
        for person in all_persons:
            # 自分以外のPersonリストを作成 (衝突回避用)
            other_persons = [p for p in all_persons if p.id != person.id]
            person.update_velocity(dt, self.environment, other_persons)

        # 2. 各Personの位置を更新
        for person in all_persons:
            person.move(dt, self.environment)

        self.time += dt
        print(f"--- Simulation time: {self.time:.2f} ---")

    def start(self):
        """シミュレーションを開始"""
        self.is_running = True
        print("Simulation started.")

    def stop(self):
        """シミュレーションを停止"""
        self.is_running = False
        print("Simulation stopped.")

    def get_state(self):
        """現在のシミュレーション状態を返す (API用)"""
        return {
            "time": self.time,
            "persons": [
                {
                    "id": p.id,
                    "position": p.position.tolist(),
                    "velocity": p.velocity.tolist(),
                    "destination": p.destination.tolist()
                    # 必要に応じて他の情報も追加
                }
                for p in self.persons.values()
            ],
            "is_running": self.is_running,
            # 環境情報も追加
            "environment": {
                "walls": self.environment.walls,
                "obstacles": self.environment.obstacles
            }
        }

class DataLoader:
    """
    ファイルから地形データと人物の初期設定を読み込むクラス。
    今はダミーデータを返す。
    """
    def load_environment(self, filepath=None):
        """地形データをファイルから読み込む (今はダミー)"""
        print(f"Loading environment data (dummy)... path: {filepath}")
        # TODO: ファイル読み込みロジック実装 (JSON, CSVなど)

        # ダミーデータ: 10x10 の四角い部屋と中央に円形の障害物
        walls = [
            [[0, 0], [10, 0]], # 下壁
            [[10, 0], [10, 10]], # 右壁
            [[10, 10], [0, 10]], # 上壁
            [[0, 10], [0, 0]]  # 左壁
        ]
        obstacles = [
            [5, 5, 1.5] # 中心(5,5), 半径1.5の円
        ]
        return Environment(walls=walls, obstacles=obstacles)

    def load_persons(self, filepath=None, num_persons=5):
        """人物データをファイルから読み込む (今はダミー)"""
        print(f"Loading persons data (dummy)... path: {filepath}, num: {num_persons}")
        # TODO: ファイル読み込みロジック実装
        persons = []
        for i in range(num_persons):
            # ダミーデータ (2次元空間を想定)
            initial_pos = np.random.rand(2) * 10 # 0-10の範囲でランダム配置
            destination = np.random.rand(2) * 10
            speed = 1.0 + np.random.rand() * 0.5 # 1.0-1.5の範囲
            size = 0.2 # 半径
            persons.append(Person(id=i, initial_position=initial_pos, speed=speed, size=size, destination=destination))
        return persons 