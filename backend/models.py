import numpy as np
import rvo2 # RVO2 ライブラリをインポート

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
    速度と位置の更新は Simulator (RVO2) が担当する。
    """
    def __init__(self, id, initial_position, speed, size, destination):
        self.id = id
        self.position = np.array(initial_position, dtype=float)
        self.speed = speed # 目標速度 (スカラー)
        self.size = size # 半径
        self.destination = np.array(destination, dtype=float)
        self.velocity = np.zeros(len(initial_position), dtype=float) # 現在の速度ベクトル (RVOが更新)
        # self.path = [] # 必要であれば

class Simulator:
    """
    シミュレーション全体を管理するクラス。
    RVO2ライブラリを使用して衝突回避を行う。
    """
    def __init__(self, environment, persons, dt=0.1):
        self.environment = environment
        self.persons = {} # person.id -> Person object
        self.time = 0.0
        self.dt = dt
        self.is_running = False
        self.person_id_to_rvo_agent_id = {}
        self.rvo_agent_id_to_person_id = {}

        # RVOシミュレータの初期化
        # パラメータ: timeStep, neighborDist, maxNeighbors, timeHorizon, timeHorizonObst, radius, maxSpeed
        # これらの値は状況に応じて調整が必要
        self.rvo_simulator = rvo2.PyRVOSimulator(
            self.dt, 1.5, 5, 1.5, 2.0, 0.2, 1.5 # デフォルト値、必要なら調整
        )
        print(f"RVO Simulator created with timestep: {self.dt}")

        # 環境の障害物をRVOに追加
        self._add_environment_to_rvo()

        # 初期人物エージェントをRVOに追加
        for person in persons:
            self.add_person(person)

    def add_person(self, person):
        """新しい人物をシミュレーションとRVOに追加する"""
        if person.id in self.persons:
            print(f"Warning: Person with ID {person.id} already exists.")
            return

        self.persons[person.id] = person

        # RVOシミュレータにエージェントを追加
        # addAgent(pos, neighborDist, maxNeighbors, timeHorizon, timeHorizonObst, radius, maxSpeed, velocity=(0,0))
        try:
            rvo_agent_id = self.rvo_simulator.addAgent(
                tuple(person.position),
                neighborDist=5.0, # 個々のエージェントで設定可能だが、Simulatorのデフォルトを使うことも多い
                maxNeighbors=10,
                timeHorizon=1.5,
                timeHorizonObst=2.0,
                radius=person.size,
                maxSpeed=person.speed,
                velocity=(0.0, 0.0) # 初期速度はゼロ
            )
            self.person_id_to_rvo_agent_id[person.id] = rvo_agent_id
            self.rvo_agent_id_to_person_id[rvo_agent_id] = person.id
            print(f"Added Person {person.id} to RVO Simulator with agent ID {rvo_agent_id}")
        except Exception as e:
            print(f"Error adding agent {person.id} to RVO: {e}")


    def _add_environment_to_rvo(self):
        """Environmentオブジェクトから壁と障害物をRVOシミュレータに追加する"""
        obstacle_vertices_list = []

        # 1. 壁をポリゴンとして追加 (細い長方形で表現)
        wall_thickness = 0.1 # 壁の厚み (RVOは体積を持つ障害物を想定)
        for start, end in self.environment.np_walls:
            direction = end - start
            length = np.linalg.norm(direction)
            if length < 1e-6: continue
            unit_direction = direction / length
            # 壁に垂直なベクトル
            normal = np.array([-unit_direction[1], unit_direction[0]]) * (wall_thickness / 2.0)

            # 壁の4頂点を計算 (反時計回り)
            v1 = start + normal
            v2 = end + normal
            v3 = end - normal
            v4 = start - normal
            # RVOライブラリはタプルのリストを受け入れる
            obstacle_vertices_list.append([tuple(v) for v in [v1, v2, v3, v4]])

        # 2. 円形障害物をポリゴンとして追加 (正多角形で近似)
        num_circle_vertices = 16 # 円を近似する頂点数
        for center, radius in self.environment.np_obstacles:
            vertices = []
            for i in range(num_circle_vertices):
                angle = 2.0 * np.pi * i / num_circle_vertices
                # RVOは障害物の「内側」を定義するため、半径をそのまま使うか、少し大きめに取るか検討
                # ここでは半径をそのまま使用し、エージェント半径との組み合わせで回避することを期待
                # 必要であれば radius + wall_thickness / 2.0 のように少し広げる
                x = center[0] + radius * np.cos(angle)
                y = center[1] + radius * np.sin(angle)
                vertices.append((x, y))
            # 頂点リストを反時計回りに並べる (sin/cosの定義から自然に反時計回りになる)
            obstacle_vertices_list.append(vertices)

        # RVOに障害物を追加
        print(f"Adding {len(obstacle_vertices_list)} obstacles to RVO Simulator.")
        for vertices in obstacle_vertices_list:
             try:
                 # addObstacleは頂点のリスト(タプルのリスト)を受け取る
                 self.rvo_simulator.addObstacle(vertices)
             except Exception as e:
                 print(f"Error adding obstacle to RVO: {vertices}, Error: {e}")


        # 障害物情報を処理して、内部データ構造(k-D木など)を構築
        try:
            self.rvo_simulator.processObstacles()
            print("RVO obstacles processed.")
        except Exception as e:
            print(f"Error processing RVO obstacles: {e}")


    def step(self):
        """シミュレーションを1ステップ進める (RVOを使用)"""
        if not self.is_running:
            return

        # 0. RVOのタイムステップを設定 (通常は init で設定した値で固定)
        self.rvo_simulator.setTimeStep(self.dt) # 毎ステップ呼ぶ必要はないかもしれないが、念のため

        # 1. 各エージェントの目標速度 (Preferred Velocity) を設定
        for person_id, person in self.persons.items():
            if person_id not in self.person_id_to_rvo_agent_id:
                continue # RVOに追加されていないエージェントはスキップ

            rvo_agent_id = self.person_id_to_rvo_agent_id[person_id]

            # RVOから現在位置を取得 (Personオブジェクトの位置と同期させるため)
            # または、Personオブジェクトの位置を信頼する (stepの最後で更新されるため)
            # ここではPersonオブジェクトの位置を使う
            current_pos = person.position
            direction_to_destination = person.destination - current_pos
            distance = np.linalg.norm(direction_to_destination)

            pref_vel = (0.0, 0.0) # デフォルトは停止
            # 目的地に十分近づいたら停止させる
            arrival_threshold = person.size * 1.5 # 半径の1.5倍程度を到着閾値とする
            if distance > arrival_threshold:
                # 目的地への方向ベクトルを正規化し、目標速度を掛ける
                pref_vel_np = (direction_to_destination / distance) * person.speed
                pref_vel = tuple(pref_vel_np)
            # else: # 閾値以下なら目標速度ゼロ (停止)
            #    pass # pref_vel は (0.0, 0.0) のまま


            try:
                # PyRVOSimulator インスタンスのメソッドを呼び出す
                self.rvo_simulator.setAgentPrefVelocity(rvo_agent_id, pref_vel)
            except Exception as e:
                 print(f"Error setting preferred velocity for agent {rvo_agent_id} (Person {person_id}): {e}")


        # 2. RVOシミュレーションステップを実行 (衝突回避計算)
        try:
            self.rvo_simulator.doStep()
        except Exception as e:
            print(f"Error during RVO doStep: {e}")
            # 必要に応じてエラー処理を追加
            return

        # 3. RVOが計算した新しい速度と位置を取得してPersonオブジェクトを更新
        all_reached = True if self.persons else True # 人がいなければ到達済みとする
        for rvo_agent_id, person_id in self.rvo_agent_id_to_person_id.items():
            if person_id not in self.persons:
                continue

            person = self.persons[person_id]
            try:
                # RVOライブラリが内部で位置も更新しているため、それを取得する
                new_position_tuple = self.rvo_simulator.getAgentPosition(rvo_agent_id)
                new_velocity_tuple = self.rvo_simulator.getAgentVelocity(rvo_agent_id)

                person.position = np.array(new_position_tuple)
                person.velocity = np.array(new_velocity_tuple)

                # 目的地到達判定 (より厳密に)
                distance_to_dest = np.linalg.norm(person.destination - person.position)
                if distance_to_dest > arrival_threshold: # まだ到着していない人がいるか
                     all_reached = False

            except Exception as e:
                 print(f"Error getting state for agent {rvo_agent_id} (Person {person_id}): {e}")

        # RVOシミュレータの内部時間を取得して同期
        self.time = self.rvo_simulator.getGlobalTime()
        # print(f"--- Simulation time: {self.time:.2f} ---")

        # オプション: 全員が目的地に到達したら停止
        if all_reached and len(self.persons) > 0:
            print("All persons seem to have reached their destinations.")
            self.stop() # 自動停止させる場合

    def start(self):
        """シミュレーションを開始"""
        if not self.is_running:
             # RVOシミュレータの状態もリセットする必要があるか確認
             # 必要であれば、ここでエージェントや障害物を再設定する
             # print("Resetting RVO simulator state if necessary...")
             self.is_running = True
             print("Simulation started.")
        else:
             print("Simulation is already running.")


    def stop(self):
        """シミュレーションを停止"""
        if self.is_running:
            self.is_running = False
            print("Simulation stopped.")
        else:
            print("Simulation is not running.")

    def get_state(self):
        """現在のシミュレーション状態を返す (API用)"""
        # persons リスト内包表記の前に self.persons が空でないかチェックするとより安全
        persons_state = []
        if self.persons:
            persons_state = [
                {
                    "id": p.id,
                    "position": p.position.tolist(),
                    "velocity": p.velocity.tolist(), # RVOによって更新された速度
                    "destination": p.destination.tolist(),
                    "size": p.size,
                    "speed": p.speed
                }
                for p in self.persons.values()
            ]

        return {
            "time": self.time,
            "persons": persons_state,
            "is_running": self.is_running,
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