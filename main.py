from random import randint
from tkinter import *
from scipy.spatial import distance

x1 = y1 = 0
walk_speed = 10
dy = dx = 1
width = 600
height = 400
repulsion = 5

goal_x1 = 150
goal_y1 = 300
goal_x2 = goal_x1 + 10
goal_y2 = goal_y1 + 10

walls = [[10, 10], [20, 10], [30, 10]]

# 変数・定数の定義
COLS, ROWS = [30, 20]  # ステージのサイズを定義
CW = 20  # セルの描画サイズ
data = []  # ステージデータ

# 画面を構築
win = Tk()  # ウィンドウを作成
cv = Canvas(win, width=width, height=height)  # キャンバスを作成
cv.pack()


def draw_stage(x1, y1):
    cv.delete('all')  # 既存の描画内容を破棄

    cv.create_oval(x1, y1, x1 + 10, y1 + 10,
                   fill="green", width=0)

    cv.create_rectangle(goal_x1, goal_y1, goal_x2, goal_y2, fill="red",
                        tag="block")

    # 壁情報は配列で渡してfor文で作成していく。
    for i in range(len(walls)):
        wall_x, wall_y = walls[i][0], walls[i][1]
        cv.create_rectangle(wall_x, wall_y, wall_x + 10, wall_y + 10, fill="orange",
                            tag="block")


# 300ミリ秒ごとに世代を進める --- (*6)
# def game_loop():
#     global x1,y1,x2,y2
#     # next_turn()  # 世代を進める
#     x1 += 10
#     y1 += 10
#     x2 += 10
#     y2 += 10
#     draw_stage(x1,y1,x2,y2)  # ステージを描画
#     win.after(300, game_loop)  # 指定時間後に再度描画

def game_loop():
    global x1, y1, dx, dy

    directions = [[x1, y1 + 10],  # 上
                  [x1 + 10, y1 - 10],  # 右上
                  [x1 + 10, y1],  # 右
                  [x1 + 10, y1 + 10],  # 右下
                  [x1, y1 + 10],  # 下
                  [x1 - 10, y1 + 10],  # 左下
                  [x1 - 10, y1],  # 左
                  [x1 - 10, y1 - 10]  # 左上
                  ]

    if x1 <= width and y1 <= height:
        d = decide_direction(x1, y1, goal_x1, goal_y1)

        print('Best Direction is {0}'.format(d))

        x1 = directions[d][0]
        y1 = directions[d][1]

        print('x1 is {0}'.format(x1))
        print('y1 is {0}'.format(y1))

        # x1 += dx * walk_speed
        # y1 += dy * walk_speed

    if y1 >= height:
        dy = -dy

    if x1 >= width and y1 <= height:
        dx = -dx

    if y1 == 0:
        dy = 1

    if x1 == 0:
        dx = 1

    # if x1 == wall_x and wall_y <= y1 <= wall_y + 10:
    #     dx = -dx
    #
    # if y1 == wall_y and wall_x <= x1 <= wall_x + 10:
    #     dy = -dy
    #
    # if x1 == wall_x and wall_y <= y1 <= wall_y + 10:
    #     dx = -dx
    #
    # if y1 == wall_y and wall_x <= x1 <= wall_x + 10:
    #     dy = -dy

    draw_stage(x1, y1)  # ステージを描画
    win.after(50, game_loop)  # 指定時間後に再度描画

def check_wall_repulsion():
    # walls = [[10, 10], [20, 10], [30, 10]]
    if



def check_distance(x1, y1, goal_x1, goal_y1):
    seeker = (x1, y1)
    goal = (goal_x1, goal_y1)
    answer = distance.euclidean(seeker, goal)

    return answer


def decide_direction(x1, y1, goal_x1, goal_y1):

    directions = [[x1, y1 + 1],  # 上
                  [x1 + 1, y1 - 1],  # 右上
                  [x1 + 1, y1],  # 右
                  [x1 + 1, y1 + 1],  # 右下
                  [x1, y1 + 1],  # 下
                  [x1 - 1, y1 + 1],  # 左下
                  [x1 - 1, y1],  # 左
                  [x1 - 1, y1 - 1]  # 左上
                  ]

    direction = 0
    min_answer = 9999
    # 8方向でのゴールまでの距離を算出する。
    for i in range(0, 8):

        x1 = directions[i][0]
        y1 = directions[i][1]

        answer = check_distance(x1, y1, goal_x1, goal_y1)

        # 示されたゴールまでの距離に基づき、進む方向を決定するが、
        # 壁等のオブジェクトがある場合は、それを迂回することを考えなければならない。

        if min_answer > answer:
            min_answer = answer
            direction = i

    return direction


game_loop()  # ゲームループを実行
win.mainloop()  # イベントループ
