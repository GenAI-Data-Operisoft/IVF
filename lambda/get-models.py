import json

def lambda_handler(event, context):
    """
    Return available Bedrock models for OCR
    """
    models = [
        {
            "provider": "Anthropic Claude (Recommended)",
            "models": [
                {"id": "anthropic.claude-sonnet-4-5-20250929-v1:0", "name": "Claude Sonnet 4.5 ⭐", "badge": "Best"},
                {"id": "anthropic.claude-opus-4-5-20251101-v1:0", "name": "Claude Opus 4.5", "badge": "Premium"},
                {"id": "anthropic.claude-haiku-4-5-20251001-v1:0", "name": "Claude Haiku 4.5", "badge": "Fast"},
                {"id": "anthropic.claude-3-7-sonnet-20250219-v1:0", "name": "Claude 3.7 Sonnet"},
                {"id": "anthropic.claude-sonnet-4-20250514-v1:0", "name": "Claude Sonnet 4"},
                {"id": "anthropic.claude-3-5-sonnet-20241022-v2:0", "name": "Claude 3.5 Sonnet v2"}
            ]
        },
        {
            "provider": "Amazon Nova",
            "models": [
                {"id": "amazon.nova-pro-v1:0", "name": "Nova Pro ⭐", "badge": "Balanced"},
                {"id": "amazon.nova-2-lite-v1:0", "name": "Nova 2 Lite", "badge": "Latest"},
                {"id": "amazon.nova-lite-v1:0", "name": "Nova Lite", "badge": "Economical"}
            ]
        },
        {
            "provider": "Qwen (Best OCR)",
            "models": [
                {"id": "qwen.qwen3-vl-235b-a22b", "name": "Qwen3 VL 235B ⭐", "badge": "Best OCR"}
            ]
        },
        {
            "provider": "Mistral AI",
            "models": [
                {"id": "mistral.mistral-large-3-675b-instruct", "name": "Mistral Large 3"},
                {"id": "mistral.magistral-small-2509", "name": "Magistral Small 2509"},
                {"id": "mistral.ministral-3-14b-instruct", "name": "Ministral 14B", "badge": "Good Value"},
                {"id": "mistral.ministral-3-8b-instruct", "name": "Ministral 8B"},
                {"id": "mistral.ministral-3-3b-instruct", "name": "Ministral 3B", "badge": "Fastest"}
            ]
        },
        {
            "provider": "Google Gemma",
            "models": [
                {"id": "google.gemma-3-27b-it", "name": "Gemma 3 27B"},
                {"id": "google.gemma-3-12b-it", "name": "Gemma 3 12B"},
                {"id": "google.gemma-3-4b-it", "name": "Gemma 3 4B", "badge": "Economical"}
            ]
        }
    ]
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(models)
    }
