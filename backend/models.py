import numpy as np
import rvo2 # RVO2 ライブラリをインポート
import random # Import random for obstacle generation
from pydantic import BaseModel, Field
from typing import List

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
        # obstacles: [{'type': 'circle', 'center': [x, y], 'radius': r}, {'type': 'rectangle', 'center': [x,y], 'width': w, 'height': h}, ...]
        self.walls = walls
        self.obstacles = obstacles # Now a list of dictionaries
        self.slopes = slopes
        self.np_walls = [(np.array(w[0]), np.array(w[1])) for w in walls]
        # np_obstacles generation needs update based on new structure
        self.np_obstacles_circles = []
        self.np_obstacles_rectangles = []
        for obs in obstacles:
            if obs['type'] == 'circle':
                self.np_obstacles_circles.append((np.array(obs['center']), obs['radius']))
            elif obs['type'] == 'rectangle':
                # Store center, width, height for now. Vertices calculated later if needed.
                self.np_obstacles_rectangles.append((np.array(obs['center']), obs['width'], obs['height']))

    def is_accessible(self, position, person_radius=0.0):
        """指定された位置が通行可能か判定する (壁と障害物を考慮)"""
        pos_np = np.array(position)

        # 1. 壁との衝突判定
        for wall_start, wall_end in self.np_walls:
            distance = point_segment_distance(pos_np, wall_start, wall_end)
            if distance < person_radius:
                # print(f"Collision detected with wall: {wall_start} -> {wall_end} at {position}")
                return False

        # 2. 円形障害物との衝突判定
        for obs_center, obs_radius in self.np_obstacles_circles:
            distance_to_center = np.linalg.norm(pos_np - obs_center)
            if distance_to_center < obs_radius + person_radius:
                # print(f"Collision detected with obstacle: center={obs_center}, radius={obs_radius} at {position}")
                return False

        # 3. 矩形障害物との衝突判定 (AABB check for simplicity)
        for obs_center, width, height in self.np_obstacles_rectangles:
            half_width = width / 2.0
            half_height = height / 2.0
            min_x = obs_center[0] - half_width - person_radius
            max_x = obs_center[0] + half_width + person_radius
            min_y = obs_center[1] - half_height - person_radius
            max_y = obs_center[1] + half_height + person_radius
            if min_x <= pos_np[0] <= max_x and min_y <= pos_np[1] <= max_y:
                return False # Collision with rectangle bounding box

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
    def __init__(self, environment, persons, destinations, dt=0.1):
        self.environment = environment
        self.persons = {} # person.id -> Person object
        self.destinations = destinations # 目的地リストを保存
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
        """Environmentオブジェクトから壁と障害物をRVOシミュレータに追加する (矩形対応)"""
        obstacle_vertices_list = []

        # 1. 壁をポリゴンとして追加 (変更なし)
        wall_thickness = 0.1
        for start, end in self.environment.np_walls:
            direction = end - start
            length = np.linalg.norm(direction)
            if length < 1e-6: continue
            unit_direction = direction / length
            normal = np.array([-unit_direction[1], unit_direction[0]]) * (wall_thickness / 2.0)
            v1 = start + normal
            v2 = end + normal
            v3 = end - normal
            v4 = start - normal
            obstacle_vertices_list.append([tuple(v) for v in [v1, v2, v3, v4]])

        # 2. 円形障害物をポリゴンとして追加 (変更なし)
        num_circle_vertices = 16
        # Use the stored circle data
        for center, radius in self.environment.np_obstacles_circles:
            vertices = []
            for i in range(num_circle_vertices):
                angle = 2.0 * np.pi * i / num_circle_vertices
                x = center[0] + radius * np.cos(angle)
                y = center[1] + radius * np.sin(angle)
                vertices.append((x, y))
            obstacle_vertices_list.append(vertices)

        # 3. 矩形障害物をポリゴンとして追加
        # Use the stored rectangle data
        for center, width, height in self.environment.np_obstacles_rectangles:
            half_width = width / 2.0
            half_height = height / 2.0
            # Calculate 4 vertices (counter-clockwise)
            v1 = (center[0] - half_width, center[1] - half_height) # Bottom-left
            v2 = (center[0] + half_width, center[1] - half_height) # Bottom-right
            v3 = (center[0] + half_width, center[1] + half_height) # Top-right
            v4 = (center[0] - half_width, center[1] + half_height) # Top-left
            obstacle_vertices_list.append([v1, v2, v3, v4])

        # RVOに障害物を追加 (変更なし)
        print(f"Adding {len(obstacle_vertices_list)} obstacles (walls+circles+rects) to RVO Simulator.")
        for vertices in obstacle_vertices_list:
             try:
                 self.rvo_simulator.addObstacle(vertices)
             except Exception as e:
                 print(f"Error adding obstacle to RVO: {vertices}, Error: {e}")

        # 障害物情報を処理 (変更なし)
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
        """現在のシミュレーション状態を返す (API用, フロントエンド型に合わせた形式)"""
        persons_state = []
        if self.persons:
            persons_state = [
                {
                    "id": p.id,
                    "position": p.position.tolist(), # [x, y]
                    "velocity": p.velocity.tolist(),
                    "destination": p.destination.tolist(),
                    "size": p.size,
                    "speed": p.speed
                }
                for p in self.persons.values()
            ]

        # Format obstacles to match frontend ObstacleData union type structure
        formatted_obstacles = []
        for obs in self.environment.obstacles:
            formatted_obs = {
                'type': obs['type'],
                # Format center to match frontend Vector2D: { position: [x, y] }
                'center': {'position': obs['center']}
            }
            if obs['type'] == 'circle':
                formatted_obs['radius'] = obs['radius']
            elif obs['type'] == 'rectangle':
                formatted_obs['width'] = obs['width']
                formatted_obs['height'] = obs['height']
            formatted_obstacles.append(formatted_obs)

        return {
            "time": self.time,
            "persons": persons_state,
            "is_running": self.is_running,
            "environment": {
                # Format walls similarly to match frontend WallData: { start: { position: [...] }, end: { position: [...] } }
                "walls": [
                    {'start': {'position': w[0]}, 'end': {'position': w[1]}}
                    for w in self.environment.walls
                ],
                "obstacles": formatted_obstacles # Use the formatted list
            },
            "destinations": self.destinations # 目的地リストを追加
        }

class DataLoader:
    """
    シミュレーション環境や人物データをロードするクラス。
    （現状はダミーデータやランダム生成）
    """
    # Modified to generate random shapes (circle or rectangle)
    def load_environment(self, filepath=None, num_obstacles=5, avg_radius=0.5, env_width=10.0, env_height=10.0, obstacle_shape='random'): # Added obstacle_shape
        """
        環境データをロードまたは生成する。
        現在は固定の壁とランダムな障害物を生成。
        """
        print(f"Generating environment: {env_width}x{env_height}, {num_obstacles} obstacles (Shape: {obstacle_shape}), avg_radius={avg_radius}")
        # 固定の壁 (境界)
        walls = [
            [(0.1, 0.1), (env_width - 0.1, 0.1)],
            [(env_width - 0.1, 0.1), (env_width - 0.1, env_height - 0.1)],
            [(env_width - 0.1, env_height - 0.1), (0.1, env_height - 0.1)],
            [(0.1, env_height - 0.1), (0.1, 0.1)]
        ]

        # ランダムな障害物
        obstacles = [] # Now a list of dicts
        min_radius = max(0.1, avg_radius * 0.5)
        max_radius = avg_radius * 1.5
        min_dim = min_radius # Min width/height for rectangles
        max_dim = max_radius * 2 # Max width/height for rectangles

        max_attempts = num_obstacles * 20 # Increased attempts slightly
        attempts = 0

        while len(obstacles) < num_obstacles and attempts < max_attempts:
            attempts += 1
            # Determine shape
            current_shape = obstacle_shape
            if current_shape == 'random':
                current_shape = random.choice(['circle', 'rectangle'])

            # Generate parameters based on shape
            if current_shape == 'circle':
                radius = random.uniform(min_radius, max_radius)
                buffer = radius + 0.2
                center_x = random.uniform(buffer, env_width - buffer)
                center_y = random.uniform(buffer, env_height - buffer)
                new_obstacle = {'type': 'circle', 'center': [center_x, center_y], 'radius': radius}
            elif current_shape == 'rectangle':
                width = random.uniform(min_dim, max_dim)
                height = random.uniform(min_dim, max_dim)
                buffer_x = width / 2.0 + 0.2
                buffer_y = height / 2.0 + 0.2
                center_x = random.uniform(buffer_x, env_width - buffer_x)
                center_y = random.uniform(buffer_y, env_height - buffer_y)
                new_obstacle = {'type': 'rectangle', 'center': [center_x, center_y], 'width': width, 'height': height}
            else: # Default to circle if shape unknown
                radius = random.uniform(min_radius, max_radius)
                buffer = radius + 0.2
                center_x = random.uniform(buffer, env_width - buffer)
                center_y = random.uniform(buffer, env_height - buffer)
                new_obstacle = {'type': 'circle', 'center': [center_x, center_y], 'radius': radius}

            # Overlap check (simplified AABB check for both)
            is_overlapping = False
            for existing_obs in obstacles:
                # Basic Bounding Box check (could be more precise)
                if existing_obs['type'] == 'circle':
                    obs_min_x, obs_max_x = existing_obs['center'][0] - existing_obs['radius'], existing_obs['center'][0] + existing_obs['radius']
                    obs_min_y, obs_max_y = existing_obs['center'][1] - existing_obs['radius'], existing_obs['center'][1] + existing_obs['radius']
                else: # rectangle
                    obs_min_x = existing_obs['center'][0] - existing_obs['width']/2
                    obs_max_x = existing_obs['center'][0] + existing_obs['width']/2
                    obs_min_y = existing_obs['center'][1] - existing_obs['height']/2
                    obs_max_y = existing_obs['center'][1] + existing_obs['height']/2

                if new_obstacle['type'] == 'circle':
                    new_min_x, new_max_x = new_obstacle['center'][0] - new_obstacle['radius'], new_obstacle['center'][0] + new_obstacle['radius']
                    new_min_y, new_max_y = new_obstacle['center'][1] - new_obstacle['radius'], new_obstacle['center'][1] + new_obstacle['radius']
                else: # rectangle
                    new_min_x = new_obstacle['center'][0] - new_obstacle['width']/2
                    new_max_x = new_obstacle['center'][0] + new_obstacle['width']/2
                    new_min_y = new_obstacle['center'][1] - new_obstacle['height']/2
                    new_max_y = new_obstacle['center'][1] + new_obstacle['height']/2

                # Check for AABB overlap
                if not (new_max_x < obs_min_x or new_min_x > obs_max_x or new_max_y < obs_min_y or new_min_y > obs_max_y):
                    is_overlapping = True
                    break # Overlap detected

            if not is_overlapping:
                obstacles.append(new_obstacle)

        if len(obstacles) < num_obstacles:
            print(f"Warning: Could only place {len(obstacles)} out of {num_obstacles} requested obstacles.")

        return Environment(walls=walls, obstacles=obstacles)

    # Modified to generate random destinations along the walls
    def load_persons(self, filepath=None, num_persons=5, num_destinations=1, env_width=10.0, env_height=10.0):
        """
        人物データをロードまたは生成する。
        指定された数の目的地を壁際にランダムに生成し、各人物にランダムに割り当てる。
        Args:
            filepath: 人物データのファイルパス (現在は未使用)
            num_persons: 生成する人物の数
            num_destinations: 生成する目的地の数 (壁際に生成)
            env_width: 環境の幅 (目的地生成に使用)
            env_height: 環境の高さ (目的地生成に使用)
        Returns:
            tuple[list[Person], list[list[float]]]: 生成された Person オブジェクトのリストと、目的地座標のリスト
        """
        print(f"Generating {num_persons} persons with {num_destinations} wall destinations...")
        persons = []
        max_attempts = num_persons * 10
        attempts = 0
        person_radius = 0.2 # Match default RVO agent radius
        buffer = person_radius + 0.2 # Buffer for initial position and destination generation

        # --- Generate Destinations on Walls ---
        generated_destinations = [] # 変数名を変更 generated_destinations
        wall_buffer = 0.1 # Small buffer from the absolute edge
        max_dest_attempts = num_destinations * 20
        dest_attempts = 0
        while len(generated_destinations) < num_destinations and dest_attempts < max_dest_attempts:
            dest_attempts += 1
            wall = random.choice(['top', 'bottom', 'left', 'right'])
            dest_x, dest_y = 0.0, 0.0
            if wall == 'top':
                dest_y = wall_buffer
                dest_x = random.uniform(wall_buffer, env_width - wall_buffer)
            elif wall == 'bottom':
                dest_y = env_height - wall_buffer
                dest_x = random.uniform(wall_buffer, env_width - wall_buffer)
            elif wall == 'left':
                dest_x = wall_buffer
                dest_y = random.uniform(wall_buffer, env_height - wall_buffer)
            else: # right
                dest_x = env_width - wall_buffer
                dest_y = random.uniform(wall_buffer, env_height - wall_buffer)

            new_dest = [dest_x, dest_y]

            # Avoid placing destinations too close to each other (optional)
            is_too_close = False
            min_dest_dist_sq = (person_radius * 4)**2 # Example: Avoid destinations closer than 4 radii
            for existing_dest in generated_destinations:
                dist_sq = (new_dest[0] - existing_dest[0])**2 + (new_dest[1] - existing_dest[1])**2
                if dist_sq < min_dest_dist_sq:
                    is_too_close = True
                    break
            if not is_too_close:
                generated_destinations.append(new_dest)

        if len(generated_destinations) < num_destinations:
             print(f"Warning: Could only place {len(generated_destinations)} out of {num_destinations} requested destinations.")
        if not generated_destinations: # Ensure at least one destination if possible
            print("Error: Could not generate any destinations. Placing one default destination.")
            # Fallback to a corner or center if wall generation fails completely
            generated_destinations.append([wall_buffer, wall_buffer]) # Default fallback

        print(f"Generated destinations: {generated_destinations}")

        # --- Generate Persons ---
        while len(persons) < num_persons and attempts < max_attempts:
            attempts += 1
            # Initial position (ensure not inside walls initially)
            pos_x = random.uniform(buffer, env_width - buffer)
            pos_y = random.uniform(buffer, env_height - buffer)
            initial_pos = [pos_x, pos_y]

            # --- Assign a random destination from the generated list ---
            assigned_destination = random.choice(generated_destinations)

            # Basic overlap check for initial positions
            is_overlapping = False
            for p in persons:
                dist_sq = (initial_pos[0] - p.position[0])**2 + (initial_pos[1] - p.position[1])**2
                # Check against slightly more than double radius to prevent initial stuck states
                if dist_sq < (person_radius * 2.1)**2:
                    is_overlapping = True
                    break
            # TODO: Also check overlap with obstacles if needed at start

            if not is_overlapping:
                persons.append(Person(
                    id=len(persons), # Simple incremental ID
                    initial_position=initial_pos,
                    speed=random.uniform(0.8, 1.2), # Random speed
                    size=person_radius,
                    destination=assigned_destination # Assign one of the wall destinations
                ))
            # else: print("Person placement attempt failed due to overlap.")

        if len(persons) < num_persons:
            print(f"Warning: Could only place {len(persons)} out of {num_persons} requested persons.")

        # 戻り値をタプルに変更
        return persons, generated_destinations

class Position(BaseModel):
    x: int
    y: int

class AgentState(BaseModel):
    id: int
    position: Position
    destination: Position
    path: List[Position] = []
    is_active: bool = True

class SimulationConfig(BaseModel):
    grid_width: int = Field(50, ge=10, le=200)
    grid_height: int = Field(50, ge=10, le=200)
    num_agents: int = Field(10, ge=1, le=500)
    max_steps: int = Field(200, ge=10, le=1000)
    noise_level: float = Field(0.1, ge=0.0, le=1.0)
    num_destinations: int = Field(1, ge=1, le=10) # 目的地数を追加

class SimulationStep(BaseModel):
    step: int
    agents: List[AgentState]

class SimulationResult(BaseModel):
    config: SimulationConfig
    history: List[SimulationStep]

class ObstacleConfig(BaseModel):
    positions: List[Position] 