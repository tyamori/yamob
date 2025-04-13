# terraform/main.tf

resource "aws_amplify_app" "yamob_app" {
  name         = "yamob-frontend"
  repository   = "https://github.com/tyamori/yamob"
  access_token = var.github_token

  # 削除: 環境変数はプロキシを使うため不要
  # environment_variables = {
  #   VITE_SOCKET_URL = "http://${aws_lb.yamob_backend_alb.dns_name}"
  # }

  # 追加: カスタムルール (プロキシとSPAフォールバック)
  # ルールは順序が重要。具体的なパスが先、汎用的なフォールバックが後。
  custom_rule {
    source = "/api/<*>"
    target = "https://api.yamob.net/api/<*>" # 取得したドメイン名に変更
    status = "200" # 200番リライト (プロキシ)
  }

  custom_rule {
    source = "/socket.io/<*>"
    target = "https://api.yamob.net/socket.io/<*>" # 取得したドメイン名に変更
    status = "200" # 200番リライト (プロキシ)
  }

  # SPA フォールバックルール (これが最後)
  custom_rule {
    source = "/<*>" # 上記ルールに一致しない他のすべてのパス
    target = "/index.html" # index.htmlを返す
    status = "404-200"     # 404 を 200 に書き換えて index.html を返す
  }

  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - cd frontend
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: frontend/dist
        files:
          - '**/*'
      cache:
        paths:
          - frontend/node_modules/**/*
  EOT

  tags = {
    Project = "Yamob"
    ManagedBy = "Terraform"
  }
}

resource "aws_amplify_branch" "main_branch" {
  app_id      = aws_amplify_app.yamob_app.id
  branch_name = "main"

  stage = "PRODUCTION"

  tags = {
    Project = "Yamob"
    ManagedBy = "Terraform"
  }
}
