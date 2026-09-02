from flask import Flask, render_template, request, jsonify

import config
from services import db, province_mapping, sentiment_model, groq_assistant

app = Flask(__name__)


# =============================================================================
# PAGE ROUTES (server-rendered templates)
# =============================================================================

@app.route("/")
def landing():
    city_summary = db.load_static("city_summary")
    aspect_summary = db.load_static("aspect_summary")
    total_reviews = sum(c["review_count"] for c in city_summary)
    return render_template(
        "landing.html",
        total_reviews=total_reviews,
        total_cities=len(city_summary),
        aspect_summary=aspect_summary,
        disclaimer=config.APP_DISCLAIMER,
    )


@app.route("/user")
def user_mode():
    provinces = province_mapping.all_provinces()
    return render_template("user.html", provinces=provinces)


@app.route("/user/restaurant/<storeid>")
def restaurant_detail(storeid):
    return render_template("restaurant_detail.html", storeid=storeid)


@app.route("/owner")
def owner_search():
    return render_template("owner_search.html")


@app.route("/owner/<storeid>")
def owner_dashboard(storeid):
    return render_template("owner_dashboard.html", storeid=storeid)


@app.route("/methodology")
def methodology():
    return render_template("methodology.html", disclaimer=config.APP_DISCLAIMER)


@app.route("/tester")
def tester():
    return render_template("tester.html")


# =============================================================================
# JSON API — geography
# =============================================================================

@app.route("/api/provinces")
def api_provinces():
    city_summary = db.load_static("city_summary")
    by_province = {}
    for row in city_summary:
        prov = province_mapping.get_province(row["city"])
        by_province.setdefault(prov, {
            "province": prov, "city_count": 0, "review_count": 0,
            "banner_slug": province_mapping.PROVINCE_FLAGSHIP_BANNER.get(prov, "karachi"),
        })
        by_province[prov]["city_count"] += 1
        by_province[prov]["review_count"] += row["review_count"]
    return jsonify(sorted(by_province.values(), key=lambda x: -x["review_count"]))


@app.route("/api/cities")
def api_cities():
    province = request.args.get("province")
    city_summary = db.load_static("city_summary")
    city_reliability = {r["city"]: r for r in db.load_static("city_reliability")}

    results = []
    for row in city_summary:
        row_province = province_mapping.get_province(row["city"])
        if province and row_province != province:
            continue
        merged = {**row, "province": row_province, "banner_slug": province_mapping.get_banner_slug(row["city"])}
        rel = city_reliability.get(row["city"])
        if rel:
            merged["agreement_rate"] = rel.get("agreement_rate")
            merged["avg_confidence"] = rel.get("avg_confidence")
        results.append(merged)
    results.sort(key=lambda x: -x["review_count"])
    return jsonify(results)


@app.route("/api/cities/<city>")
def api_city_detail(city):
    city_summary = next((r for r in db.load_static("city_summary") if r["city"] == city), None)
    if not city_summary:
        return jsonify({"error": f"City '{city}' not found"}), 404

    aspect_city = [r for r in db.load_static("aspect_city_summary") if r["city"] == city]
    aspect_city.sort(key=lambda r: -r["pct_negative"] if r.get("reliable_sample") else 0)

    top_restaurants = db.query_records(
        """SELECT storeid, completestorename, review_count, pct_positive, pct_negative
           FROM restaurant_summary WHERE city = ?
           ORDER BY review_count DESC LIMIT 10""",
        [city],
    )

    return jsonify({
        "city": city,
        "province": province_mapping.get_province(city),
        "banner_slug": province_mapping.get_banner_slug(city),
        "summary": city_summary,
        "aspects": aspect_city,
        "top_restaurants": top_restaurants,
    })


# =============================================================================
# JSON API — restaurants
# =============================================================================

@app.route("/api/restaurants")
def api_restaurants_search():
    search = request.args.get("search", "").strip()
    city = request.args.get("city", "").strip()
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(50, int(request.args.get("per_page", 20)))
    offset = (page - 1) * per_page

    where_clauses = []
    params = []
    if search:
        where_clauses.append("completestorename ILIKE ?")
        params.append(f"%{search}%")
    if city:
        where_clauses.append("city = ?")
        params.append(city)
    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    total = db.query_df(f"SELECT COUNT(*) AS n FROM restaurant_summary {where_sql}", params)["n"][0]
    rows = db.query_records(
        f"""SELECT storeid, completestorename, city, review_count, pct_positive, pct_negative
            FROM restaurant_summary {where_sql}
            ORDER BY review_count DESC LIMIT ? OFFSET ?""",
        params + [per_page, offset],
    )
    return jsonify({"results": rows, "total": int(total), "page": page, "per_page": per_page})


@app.route("/api/restaurants/<storeid>")
def api_restaurant_detail(storeid):
    resto_rows = db.query_records("SELECT * FROM restaurant_summary WHERE storeid = ?", [storeid])
    if not resto_rows:
        return jsonify({"error": f"Restaurant '{storeid}' not found"}), 404
    resto = resto_rows[0]

    # corrected ranking — see scripts/build_database.py docstring for why this beats the raw
    # top_complaint_aspect/top_praise_aspect columns from the CSV
    aspects = db.query_records(
        """SELECT aspect, mentions, ROUND(pct_negative, 1) AS pct_negative,
                  ROUND(pct_positive, 1) AS pct_positive, reliable_sample
           FROM restaurant_aspect_summary
           WHERE storeid = ? ORDER BY pct_negative DESC""",
        [storeid],
    )

    sample_reviews = db.query_records(
        """SELECT text, sentiment_final, ensemble_confidence, aspects, overall
           FROM processed_reviews WHERE storeid = ?
           ORDER BY RANDOM() LIMIT 12""",
        [storeid],
    )

    return jsonify({
        "restaurant": resto,
        "aspects": aspects,
        "sample_reviews": sample_reviews,
    })


# =============================================================================
# JSON API — live sentiment tester
# =============================================================================

@app.route("/api/sentiment/analyze", methods=["POST"])
def api_sentiment_analyze():
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")
    if not text.strip():
        return jsonify({"error": "No text provided"}), 400
    try:
        result = sentiment_model.analyze(text)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify(result)


# =============================================================================
# JSON API — owner AI assistant
# =============================================================================

@app.route("/api/owner/assistant", methods=["POST"])
def api_owner_assistant():
    data = request.get_json(silent=True) or {}
    storeid = data.get("storeid", "")
    message = data.get("message", "")
    history = data.get("history", [])
    if not storeid or not message.strip():
        return jsonify({"error": "storeid and message are required"}), 400
    try:
        result = groq_assistant.chat(storeid, message, history)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify(result)


# =============================================================================
# JSON API — methodology page data
# =============================================================================

@app.route("/api/methodology")
def api_methodology():
    return jsonify({
        "benchmark_results": db.load_static("benchmark_results"),
        "bertopic_topics": sorted(
            [t for t in db.load_static("bertopic_topics") if t["Topic"] != -1],
            key=lambda t: -t["Count"],
        )[:20],
        "zero_shot_discovery": db.load_static("zero_shot_discovery"),
        "temporal_trends": db.load_static("temporal_trends"),
        "city_reliability": db.load_static("city_reliability"),
        "aspect_summary": db.load_static("aspect_summary"),
    })


if __name__ == "__main__":
    app.run(debug=False, port=5000, use_reloader=False)
