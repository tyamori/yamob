# terraform/backend-ecr.tf

resource "aws_ecr_repository" "yamob_backend_repo" {
  name                 = "yamob-backend" # ECR リポジトリの名前
  image_tag_mutability = "MUTABLE"       # タグの上書きを許可 (開発中は便利)

  image_scanning_configuration {
    scan_on_push = true # イメージプッシュ時に脆弱性スキャンを実行
  }

  tags = {
    Project   = "Yamob"
    ManagedBy = "Terraform"
    Service   = "Backend"
  }
}

# ECRリポジトリのURIを出力 (後で GitHub Actions などで使う)
output "ecr_repository_url" {
  description = "The URL of the ECR repository for the backend."
  value       = aws_ecr_repository.yamob_backend_repo.repository_url
} 