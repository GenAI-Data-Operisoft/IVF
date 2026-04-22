import json, boto3, os
from datetime import datetime
dynamodb = boto3.resource("dynamodb")
cases_table = dynamodb.Table(os.environ.get("CASES_TABLE", "IVF-Cases"))
CORS = {"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}
def lambda_handler(event, context):
    method = event.get("httpMethod","GET")
    params = event.get("pathParameters",{})
    session_id = params.get("sessionId")
    stage_key = params.get("stageKey","cleavage")
    if not session_id: return {"statusCode":400,"headers":CORS,"body":json.dumps({"error":"Missing sessionId"})}
    if method == "OPTIONS": return {"statusCode":200,"headers":CORS,"body":""}
    attr = f"embryo_stage_{stage_key}"
    try:
        if method == "GET":
            resp = cases_table.get_item(Key={"sessionId":session_id})
            d = resp.get("Item",{}).get(attr,{})
            return {"statusCode":200,"headers":CORS,"body":json.dumps({"remark":d.get("remark",""),"cryo_records":d.get("cryo_records",[])})}
        elif method == "POST":
            body = json.loads(event.get("body") or "{}")
            resp = cases_table.get_item(Key={"sessionId":session_id})
            existing = resp.get("Item",{}).get(attr,{})
            merged = {**existing, **body, "updated_at":datetime.utcnow().isoformat()}
            cases_table.update_item(Key={"sessionId":session_id},UpdateExpression=f"SET {attr} = :d",ExpressionAttributeValues={":d":merged})
            return {"statusCode":200,"headers":CORS,"body":json.dumps({"message":"Saved"})}
        return {"statusCode":405,"headers":CORS,"body":json.dumps({"error":"Method not allowed"})}
    except Exception as e:
        return {"statusCode":500,"headers":CORS,"body":json.dumps({"error":str(e)})}
