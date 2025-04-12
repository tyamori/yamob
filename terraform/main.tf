# terraform/main.tf

resource "aws_amplify_app" "yamob_app" {
  name         = "yamob-frontend"
  repository   = "https://github.com/tyamori/yamob"
  access_token = var.github_token

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
