# terraform/backend-ecs.tf

# --- ECS Task Execution Role ---
# タスクが ECR からイメージをプルしたり、CloudWatch にログを送信したりするために必要なロール

data "aws_iam_policy_document" "ecs_task_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_execution_role" {
  name               = "yamob-backend-ecs-task-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role.json

  tags = {
    Project   = "Yamob"
    ManagedBy = "Terraform"
    Service   = "Backend"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" # AWS管理ポリシー
}

# --- CloudWatch Log Group ---
# コンテナからのログを収集する場所

resource "aws_cloudwatch_log_group" "yamob_backend_log_group" {
  name              = "/ecs/yamob-backend" # ロググループ名
  retention_in_days = 7                  # ログの保持期間 (例: 7日)

  tags = {
    Project   = "Yamob"
    ManagedBy = "Terraform"
    Service   = "Backend"
  }
}

# --- ECS Task Definition ---
# コンテナイメージ、CPU/メモリ、ポートマッピングなどを定義

resource "aws_ecs_task_definition" "yamob_backend_task" {
  family                   = "yamob-backend-task" # タスク定義ファミリー名
  network_mode             = "awsvpc"             # Fargate では必須
  requires_compatibilities = ["FARGATE"]          # Fargate を指定
  cpu                      = "256"                # vCPU ユニット (例: 0.25 vCPU)
  memory                   = "512"                # メモリ (MiB) (例: 0.5 GB)
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  # コンテナ定義 (JSON形式のヒアドキュメント)
  container_definitions = jsonencode([
    {
      name      = "yamob-backend" # コンテナ名
      image     = "${aws_ecr_repository.yamob_backend_repo.repository_url}:v1.1-debug" # タグを変更
      essential = true           # このコンテナが停止したらタスク全体も停止
      portMappings = [
        {
          containerPort = 5001 # コンテナがリッスンするポート (DockerfileのEXPOSEと合わせる)
          hostPort      = 5001 # awsvpc モードでは通常 containerPort と同じ
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.yamob_backend_log_group.name
          "awslogs-region"        = data.aws_region.current.name # 現在のリージョンを使用
          "awslogs-stream-prefix" = "ecs" # ログストリーム名のプレフィックス
        }
      }
      # 環境変数 (必要に応じて追加)
      # environment = [
      #   { name = "EXAMPLE_VAR", value = "example_value" }
      # ]
      # シークレット (Secrets Manager や Parameter Store から取得する場合)
      # secrets = [
      #   { name = "DATABASE_PASSWORD", valueFrom = "arn:aws:secretsmanager:..." }
      # ]
    }
  ])

  tags = {
    Project   = "Yamob"
    ManagedBy = "Terraform"
    Service   = "Backend"
  }

  # タスク定義リソースが変更されたときに新しいリビジョンを作成する
  lifecycle {
    create_before_destroy = true
  }
}

# 現在のリージョン情報を取得するためのデータソース
data "aws_region" "current" {}

# --- VPC and Subnet Data Sources (Using Default VPC) ---

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# --- ECS Cluster ---

resource "aws_ecs_cluster" "yamob_backend_cluster" {
  name = "yamob-backend-cluster"

  # 追加: Container Insights を有効化
  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Project   = "Yamob"
    ManagedBy = "Terraform"
    Service   = "Backend"
  }
}

# --- Security Groups ---

# 1. Security Group for Application Load Balancer (ALB)
resource "aws_security_group" "alb_sg" {
  name        = "yamob-backend-alb-sg"
  description = "Allow HTTP inbound traffic for Yamob backend ALB"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Allow traffic from any IPv4 address
    ipv6_cidr_blocks = ["::/0"]   # Allow traffic from any IPv6 address
  }

  # 追加: HTTPS 用の ingress ルール
  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1" # All protocols
    cidr_blocks = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = {
    Project   = "Yamob"
    ManagedBy = "Terraform"
    Service   = "Backend"
  }
}

# 2. Security Group for ECS Tasks
resource "aws_security_group" "ecs_tasks_sg" {
  name        = "yamob-backend-ecs-tasks-sg"
  description = "Allow inbound traffic from ALB for Yamob backend tasks"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "Allow traffic from ALB on port 5001"
    from_port       = 5001 # Application port
    to_port         = 5001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id] # Only allow traffic from the ALB SG
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = {
    Project   = "Yamob"
    ManagedBy = "Terraform"
    Service   = "Backend"
  }
}

# --- Application Load Balancer (ALB) ---

resource "aws_lb" "yamob_backend_alb" {
  name               = "yamob-backend-alb"
  internal           = false # インターネット向け
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id] # 作成した ALB 用 SG をアタッチ
  subnets            = data.aws_subnets.default.ids   # デフォルト VPC のサブネットを使用

  enable_deletion_protection = false # 開発中は false が便利 (誤削除防止なら true)

  tags = {
    Project   = "Yamob"
    ManagedBy = "Terraform"
    Service   = "Backend"
  }
}

# --- ALB Target Group ---
# ALB がトラフィックを転送する先 (ECS タスク) を定義

resource "aws_lb_target_group" "yamob_backend_tg" {
  name        = "yamob-backend-tg"
  port        = 5001 # コンテナがリッスンするポート
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip" # Fargate (awsvpc) では 'ip' を指定

  health_check {
    enabled             = true
    interval            = 30 # 秒
    path                = "/" # ヘルスチェックパス (適切なパスに変更が必要な場合あり)
    protocol            = "HTTP"
    timeout             = 5  # 秒
    healthy_threshold   = 3
    unhealthy_threshold = 3
    matcher             = "200-399" # 正常と判断するHTTPステータスコード
  }

  # スティッキーセッション (必要に応じて有効化)
  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400 # 秒 (1日)
    enabled         = true
  }

  tags = {
    Project   = "Yamob"
    ManagedBy = "Terraform"
    Service   = "Backend"
  }

  lifecycle {
    # ALB がターゲットグループを参照している間は削除できないようにする
    create_before_destroy = true
  }
}

# --- ALB Listener ---
# ALB がどのポートでリクエストを受け付け、どう処理するかを定義

resource "aws_lb_listener" "http_listener" {
  load_balancer_arn = aws_lb.yamob_backend_alb.arn # 作成した ALB を指定
  port              = 80                          # HTTP ポート
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.yamob_backend_tg.arn # 作成した TG に転送
  }
}

# ALB の DNS 名を出力
output "alb_dns_name" {
  description = "The DNS name of the Application Load Balancer."
  value       = aws_lb.yamob_backend_alb.dns_name
}

# --- ECS Service ---
# タスク定義を実行し、コンテナを起動・維持する

resource "aws_ecs_service" "yamob_backend_service" {
  name            = "yamob-backend-service"       # サービス名
  cluster         = aws_ecs_cluster.yamob_backend_cluster.id # 属するクラスター
  task_definition = aws_ecs_task_definition.yamob_backend_task.arn # 使用するタスク定義
  desired_count   = 1                             # 起動・維持するタスク数 (例: 1)
  launch_type     = "FARGATE"                     # Fargate を使用

  # ネットワーク設定 (Fargate/awsvpc モードで必要)
  network_configuration {
    subnets         = data.aws_subnets.default.ids # 実行するサブネット
    security_groups = [aws_security_group.ecs_tasks_sg.id] # 適用するセキュリティグループ
    assign_public_ip = true                         # Fargate タスクにパブリック IP を割り当てるか (ECR からのプルなどに必要)
  }

  # ALB との連携設定
  load_balancer {
    target_group_arn = aws_lb_target_group.yamob_backend_tg.arn # 関連付けるターゲットグループ
    container_name   = "yamob-backend"                 # ターゲットグループがトラフィックを送るコンテナ名
    container_port   = 5001                           # コンテナのポート
  }

  # 新しいタスク定義がデプロイされたときに古いタスクを停止する前に、
  # 新しいタスクがヘルスチェックに合格するのを待つ
  health_check_grace_period_seconds = 60 # 秒 (適切な値に調整)

  # デプロイメント設定 (ローリングアップデートなど)
  deployment_controller {
    type = "ECS" # 標準の ECS デプロイメントコントローラーを使用
  }

  # ALB がサービスを参照している間は削除を防ぐ依存関係
  depends_on = [aws_lb_listener.http_listener]

  tags = {
    Project   = "Yamob"
    ManagedBy = "Terraform"
    Service   = "Backend"
  }

  # サービス設定の変更時にもスムーズに更新を行うための設定
  lifecycle {
    ignore_changes = [task_definition] # タスク定義の変更はデプロイプロセスで管理されるため
  }
}

# --- ACM Certificate ---
resource "aws_acm_certificate" "api_cert" {
  domain_name       = "api.yamob.net" # 取得したドメイン名に変更
  validation_method = "DNS"

  tags = {
    Project   = "Yamob"
    ManagedBy = "Terraform"
    Service   = "Backend"
  }

  lifecycle {
    create_before_destroy = true # 証明書の更新時にダウンタイムを避ける
  }
}

# --- Route 53 Zone Data Source ---
# 追加: yamob.net のホストゾーン情報を取得
data "aws_route53_zone" "yamob_zone" {
  name         = "yamob.net." # 末尾のドットに注意
  private_zone = false
}

# --- Route 53 Record for ACM Validation ---
# 追加: ACM DNS 検証用の CNAME レコードを作成
resource "aws_route53_record" "cert_validation" {
  # ACM証明書リソースの domain_validation_options はリストだが、
  # サブドメインなし(yamob.net)や SAN がなければ通常最初の要素[0]でOK
  # 複数のドメイン/SANがある場合は for_each を使う必要がある
  for_each = {
    for dvo in aws_acm_certificate.api_cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true # Terraform 外でレコードが存在した場合に上書きを許可
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60 # 検証用レコードのTTLは短くても良い
  type            = each.value.type
  zone_id         = data.aws_route53_zone.yamob_zone.zone_id # データソースからゾーンIDを取得
}

# --- ACM Certificate Validation ---
# 修正: validation_record_fqdns を追加
resource "aws_acm_certificate_validation" "api_cert" {
  certificate_arn         = aws_acm_certificate.api_cert.arn
  # 作成した Route 53 レコードの FQDN を参照
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# --- ALB Listener (HTTPS) ---
resource "aws_lb_listener" "https_listener" {
  load_balancer_arn = aws_lb.yamob_backend_alb.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08" # 推奨されるセキュリティポリシー
  # 修正: 検証リソースの証明書ARNを参照する
  certificate_arn   = aws_acm_certificate_validation.api_cert.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.yamob_backend_tg.arn
  }

  tags = {
    Project   = "Yamob"
    ManagedBy = "Terraform"
    Service   = "Backend"
  }
}

# --- ALB Listener Rule (HTTP to HTTPS Redirect) ---
# 既存の aws_lb_listener.http_listener リソースにルールを追加
resource "aws_lb_listener_rule" "http_to_https_redirect" {
  listener_arn = aws_lb_listener.http_listener.arn # 既存のHTTPリスナーを参照
  priority     = 100 # ルールの優先度 (他のルールがなければこれでOK)

  action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301" # 永続的なリダイレクト
    }
  }

  condition {
    path_pattern {
      values = ["/*"] # すべてのパスに適用
    }
  }
}

# --- Route 53 A Record for ALB ---
# 追加: api.yamob.net が ALB を指すように A レコード (エイリアス) を作成
resource "aws_route53_record" "api_alb_alias" {
  zone_id = data.aws_route53_zone.yamob_zone.zone_id
  name    = "api.yamob.net"
  type    = "A"

  alias {
    name                   = aws_lb.yamob_backend_alb.dns_name # ALB の DNS 名
    zone_id                = aws_lb.yamob_backend_alb.zone_id  # ALB のホストゾーン ID
    evaluate_target_health = true                             # ALB のヘルス状態を評価
  }
} 