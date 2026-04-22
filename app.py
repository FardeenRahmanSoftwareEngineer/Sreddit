import os
import sys
import requests
import urllib.request
import json
import time
from flask import Flask, render_template, request, jsonify
from openai import OpenAI

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BRAVE_API_KEY = os.environ.get("BRAVE_API_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

if not BRAVE_API_KEY:
    print("ERROR: BRAVE_API_KEY environment variable is not set.", file=sys.stderr)
    print("Create a .env file or set the variable in your shell.", file=sys.stderr)
    sys.exit(1)
if not OPENAI_API_KEY:
    print("ERROR: OPENAI_API_KEY environment variable is not set.", file=sys.stderr)
    print("Create a .env file or set the variable in your shell.", file=sys.stderr)
    sys.exit(1)

app = Flask(__name__)

def generate_facts(query: str) -> str:
    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY
    }
    params = {
        "q": "Facts about " + query + " " + "site:reddit.com"
    }
    response = requests.get(url, headers=headers, params=params)
    results = response.json()
    redditResponses = []
    if results.get("web", {}).get("results"):
        for i in range(0, min(len(results), 3)):
            newUrl = results["web"]["results"][i]['url'] + ".json"
            if ("www.reddit.com/r/" in newUrl):
                with urllib.request.urlopen(newUrl) as url:
                    data = json.loads(url.read().decode())
                    for j in range(1, min(len(data[1]["data"]["children"]), 4)):
                        time.sleep(3)

                        try:
                            redditResponse = data[1]["data"]["children"][j]["data"]["body"]
                            if (redditResponse != "[removed]"):
                                redditResponses.append(redditResponse)
                        except:
                            continue
    client = OpenAI(api_key=OPENAI_API_KEY)
    openAIResponse = client.responses.create(
        model="gpt-5.4",
        input="Please compile this information into multiple short, informative, engaging, exciting bullet points that would intrigue a reader (DO NOT Include any **s or -- (double dashes)) After compiling the list of bullet points, ENTIRELY DELETE any bullet points that require context from other bullet points to be understood. Also, ENTIRELY DELETE any bullets points that do not involve " + query + " ensure each of the remaining bullet points are short, informative, engaging, exciting: " + " ".join(redditResponses)
    )
    return openAIResponse.output_text

def parse_bullets(raw_text: str):
    if not raw_text:
        return []
    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
    cleaned = []
    for line in lines:
        stripped = line.lstrip("•-*·◦●○▪▸►").strip()
        if stripped and stripped[0].isdigit():
            for i, ch in enumerate(stripped):
                if ch in ".)":
                    stripped = stripped[i + 1:].strip()
                    break
        if stripped:
            cleaned.append(stripped)
    return cleaned

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/ads.txt")
def ads_txt():
    return "google.com, pub-6034913554471877, DIRECT, f08c47fec0942fa0\n", 200, {"Content-Type": "text/plain"}

@app.route("/api/facts", methods=["POST"])
def api_facts():
    payload = request.get_json(silent=True) or {}
    query = (payload.get("query") or "").strip()
    if not query:
        return jsonify({"error": "Please provide a topic."}), 400
    try:
        raw = generate_facts(query)
        bullets = parse_bullets(raw)
        if not bullets:
            return jsonify({
                "error": "We couldn't find good facts for that topic. Try another one!",
                "code": "no_results"
            }), 404
        return jsonify({"query": query, "bullets": bullets, "raw": raw})
    except json.JSONDecodeError:
        return jsonify({
            "error": "We couldn't find good facts for that topic. Try another one!",
            "code": "no_results"
        }), 404
    except Exception as e:
        msg = str(e)
        if "Expecting value" in msg or "JSON" in msg or "decode" in msg.lower():
            return jsonify({
                "error": "We couldn't find good facts for that topic. Try another one!",
                "code": "no_results"
            }), 404
        return jsonify({"error": f"Something went wrong: {e}"}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
