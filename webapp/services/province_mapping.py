"""
City -> province mapping for Pakistan.

This is NOT derived from the dataset (the raw data only has `city`, never `province`) —
it's a manually verified lookup built against the exact 27 cities that appear in the
merged 2025+2026 restaurant metadata (confirmed by cross-checking against city_summary.csv's
27 rows). If you re-run the pipeline on updated data and a new city shows up that isn't in
this table, `get_province()` returns "Unknown" rather than guessing — check the warning log
at backend startup and add it here explicitly.
"""

CITY_TO_PROVINCE = {
    # Punjab
    "Bahawalpur": "Punjab",
    "Dera Ghazi Khan": "Punjab",
    "Faisalabad": "Punjab",
    "Gujranwala": "Punjab",
    "Gujrat": "Punjab",
    "Jhelum": "Punjab",
    "Lahore": "Punjab",
    "Multan": "Punjab",
    "Murree": "Punjab",          # Rawalpindi District
    "Okara": "Punjab",
    "Rahim Yar Khan": "Punjab",
    "Rawalpindi": "Punjab",
    "Sadiqabad": "Punjab",       # Rahim Yar Khan District
    "Sahiwal": "Punjab",
    "Sargodha": "Punjab",
    "Sheikhupura": "Punjab",
    "Sialkot": "Punjab",
    "Wah Cantt": "Punjab",       # Attock District / Rawalpindi area

    # Sindh
    "Hyderabad": "Sindh",
    "Karachi": "Sindh",
    "Larkana": "Sindh",
    "Sukkur": "Sindh",

    # Khyber Pakhtunkhwa
    "Abbottabad": "Khyber Pakhtunkhwa",
    "Mardan": "Khyber Pakhtunkhwa",
    "Peshawar": "Khyber Pakhtunkhwa",

    # Balochistan
    "Quetta": "Balochistan",

    # Islamabad Capital Territory
    "Islamabad": "Islamabad Capital Territory",
}


def get_province(city: str) -> str:
    """Look up a city's province. Returns 'Unknown' for anything not in the verified table
    above — this happens on purpose rather than falling back to a guess, so a gap is visible
    (check backend startup logs) instead of silently mislabeling a city's region."""
    return CITY_TO_PROVINCE.get(city.strip().title(), "Unknown")


def all_provinces() -> list[str]:
    return sorted(set(CITY_TO_PROVINCE.values()))


# Each province's flagship city gets its own hand-illustrated banner (static/img/banners/*.svg).
# Every other city in that province falls back to its province's flagship banner rather than a
# generic placeholder — still looks cohesive and intentional, not a dead end. To add a dedicated
# banner for another city later: drop the SVG in static/img/banners/<city_slug>.svg and add an
# entry here; no other code needs to change.
PROVINCE_FLAGSHIP_BANNER = {
    "Punjab": "lahore",
    "Sindh": "karachi",
    "Khyber Pakhtunkhwa": "peshawar",
    "Balochistan": "quetta",
    "Islamabad Capital Territory": "islamabad",
}

CITY_BANNER_OVERRIDE = {
    # cities with their own dedicated banner beyond the province flagship — none yet, but this
    # is where they go as more get added (see note above)
}


def city_slug(city: str) -> str:
    return city.strip().lower().replace(" ", "-")


def get_banner_slug(city: str) -> str:
    """Returns the filename (without extension) of the SVG to show for this city — its own
    dedicated banner if one exists, otherwise its province's flagship city banner."""
    if city in CITY_BANNER_OVERRIDE:
        return CITY_BANNER_OVERRIDE[city]
    province = get_province(city)
    return PROVINCE_FLAGSHIP_BANNER.get(province, "karachi")  # ultimate fallback, never 404s
