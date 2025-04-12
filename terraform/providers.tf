terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  required_version = ">= 1.0"
}

provider "aws" {
  region = "ap-northeast-1"
  profile = "yamob-deployer"

  # --- 認証情報の設定 (以下のいずれかを選択または環境変数/プロファイルを使用) ---
  # profile = "your-aws-profile-name" # AWS CLI のプロファイル名を使う場合 (推奨)
  # access_key = var.aws_access_key    # 変数経由で渡す場合 (非推奨)
} 