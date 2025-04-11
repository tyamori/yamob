import numpy as np

# --- Geometry Helper Functions ---
def point_segment_distance(p, a, b):
    """点 p と線分 ab の最短距離を計算"""
    ap = p - a
    ab = b - a
    ab_squared = np.dot(ab, ab)
    if ab_squared == 0.0:
        return np.linalg.norm(ap) # a と b が同じ点の場合
    # 線分 ab 上への p の射影点を計算
    t = np.dot(ap, ab) / ab_squared
    t = np.clip(t, 0, 1) # 射影点が線分外なら端点に丸める
    closest_point = a + t * ab
    return np.linalg.norm(p - closest_point)

# --- Environment Class ---
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
        self.np_walls = [(np.array(w[0]), np.array(w[1])) for w in walls]
        self.np_obstacles = [(np.array(o[:2]), o[2]) for o in obstacles] # (center_np_array, radius)

    def is_accessible(self, position, person_radius=0.0):
        """指定された位置が通行可能か判定する (壁と障害物を考慮)"""
        pos_np = np.array(position)

        # 1. 壁との衝突判定
        for wall_start, wall_end in self.np_walls:
            distance = point_segment_distance(pos_np, wall_start, wall_end)
            if distance < person_radius:
                # print(f"Collision detected with wall: {wall_start} -> {wall_end} at {position}")
                return False

        # 2. 障害物との衝突判定
        for obs_center, obs_radius in self.np_obstacles:
            distance_to_center = np.linalg.norm(pos_np - obs_center)
            if distance_to_center < obs_radius + person_radius:
                # print(f"Collision detected with obstacle: center={obs_center}, radius={obs_radius} at {position}")
                return False

        # TODO: 他の判定 (境界外チェックなど) も追加可能

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

        if distance < 0.1 * self.speed: # 目的地付近で減速・停止 (速度に応じた閾値)
            self.velocity = direction_to_destination / dt # ピタッと止まるように
            if np.linalg.norm(self.velocity) < 0.1:
                 self.velocity = np.zeros_like(self.velocity)
            # print(f"Person {self.id} reached destination.")
            return

        desired_velocity = (direction_to_destination / distance) * self.speed
        steering = desired_velocity - self.velocity

        # --- TODO: 他者からの反発力を追加 --- ここから
        # repulsive_force = np.zeros_like(self.velocity)
        # for other in other_persons:
        #     # 他者との距離計算など
        #     pass
        # steering += repulsive_force
        # --- TODO ここまで ----

        # --- 速度・力の制限 (オプション) ---
        # steering = np.clip(steering, -max_force, max_force) # 力の制限
        # self.velocity += steering * dt # 質量1として加速度を適用
        # # 速度制限
        # speed_mag = np.linalg.norm(self.velocity)
        # if speed_mag > self.speed:
        #     self.velocity = (self.velocity / speed_mag) * self.speed

        # 単純化: 直接 desired_velocity に近づける (急な方向転換を許容)
        self.velocity = desired_velocity

        print(f"Person {self.id} velocity updated to: {self.velocity}") # 仮実装

    def move(self, dt, environment):
        """速度ベクトルに基づいて位置を更新し、衝突判定を行う"""
        if np.linalg.norm(self.velocity) < 1e-6: # ほぼ停止しているなら何もしない
             return

        potential_position = self.position + self.velocity * dt

        # 移動先の位置が通行可能かチェック (自身のサイズを考慮)
        if environment.is_accessible(potential_position, self.size):
             self.position = potential_position
        else:
             # 衝突した場合、速度をゼロにする (シンプルな応答)
             # print(f"Person {self.id} stopped due to collision near {potential_position}")
             self.velocity = np.zeros_like(self.velocity)

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