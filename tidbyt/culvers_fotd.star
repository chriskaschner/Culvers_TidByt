"""
Culver's Flavor of the Day - Tidbyt App
Displays the current flavor with color-coded ice cream icons
"""

load("render.star", "render")
load("http.star", "http")
load("cache.star", "cache")
load("schema.star", "schema")
load("encoding/json.star", "json")
load("time.star", "time")

# Default location
DEFAULT_LOCATION = "https://www.culvers.com/restaurants/mt-horeb"
DEFAULT_LOCATION_NAME = "Mt. Horeb"

# Color mappings for different flavor types
FLAVOR_COLORS = {
    "mint": "#2ECC71",  # Green
    "chocolate": "#6F4E37",  # Brown
    "vanilla": "#F5DEB3",  # Wheat/cream
    "strawberry": "#FF6B9D",  # Pink
    "caramel": "#C68E17",  # Gold/caramel
    "peanut": "#D4A574",  # Tan
    "butter": "#FFFACD",  # Light yellow
    "peach": "#FFE5B4",  # Peach
    "raspberry": "#E30B5C",  # Red-pink
    "cookie": "#8B7355",  # Medium brown
    "oreo": "#3B3B3B",  # Dark gray
    "coffee": "#6F4E37",  # Coffee brown
    "lemon": "#FFFF00",  # Yellow
    "default": "#FFE4B5",  # Moccasin (vanilla-ish)
}

def get_flavor_color(flavor_name):
    """Determine color based on flavor keywords."""
    flavor_lower = flavor_name.lower()

    # Check for color keywords in order of specificity
    if "mint" in flavor_lower:
        return FLAVOR_COLORS["mint"]
    elif "chocolate" in flavor_lower or "cocoa" in flavor_lower:
        return FLAVOR_COLORS["chocolate"]
    elif "oreo" in flavor_lower:
        return FLAVOR_COLORS["oreo"]
    elif "strawberry" in flavor_lower:
        return FLAVOR_COLORS["strawberry"]
    elif "raspberry" in flavor_lower:
        return FLAVOR_COLORS["raspberry"]
    elif "lemon" in flavor_lower or "citrus" in flavor_lower:
        return FLAVOR_COLORS["lemon"]
    elif "caramel" in flavor_lower:
        return FLAVOR_COLORS["caramel"]
    elif "peanut" in flavor_lower or "pb" in flavor_lower:
        return FLAVOR_COLORS["peanut"]
    elif "butter pecan" in flavor_lower or "butter" in flavor_lower:
        return FLAVOR_COLORS["butter"]
    elif "peach" in flavor_lower:
        return FLAVOR_COLORS["peach"]
    elif "cookie" in flavor_lower:
        return FLAVOR_COLORS["cookie"]
    elif "coffee" in flavor_lower:
        return FLAVOR_COLORS["coffee"]
    elif "vanilla" in flavor_lower:
        return FLAVOR_COLORS["vanilla"]
    else:
        return FLAVOR_COLORS["default"]

def fetch_flavor_calendar(location_url):
    """Fetch upcoming flavors from Culver's website."""

    # Check cache first (cache for 1 hour)
    cache_key = "culvers_calendar_{}".format(location_url)
    cached = cache.get(cache_key)
    if cached:
        return json.decode(cached)

    # Fetch from website
    response = http.get(location_url, ttl_seconds = 3600)
    if response.status_code != 200:
        return {"flavors": [], "error": True}

    # Parse the HTML to extract __NEXT_DATA__
    html = response.body()

    # Find the __NEXT_DATA__ script tag
    script_marker_start = '<script id="__NEXT_DATA__" type="application/json">'
    script_marker_end = "</script>"

    script_start = html.find(script_marker_start)
    if script_start == -1:
        return {"flavors": [], "error": True}

    # Move past the opening tag
    json_start = script_start + len(script_marker_start)

    # Find the closing script tag
    json_end = html.find(script_marker_end, json_start)
    if json_end == -1:
        return {"flavors": [], "error": True}

    # Extract the JSON string
    json_str = html[json_start:json_end]

    # Parse the full JSON structure
    data = json.decode(json_str)

    # Navigate through the JSON structure like the Python version
    # props.pageProps.page.customData.restaurantCalendar.flavors
    props = data.get("props", {})
    page_props = props.get("pageProps", {})
    page = page_props.get("page", {})
    custom_data = page.get("customData", {})
    calendar_data = custom_data.get("restaurantCalendar", {})
    flavors = calendar_data.get("flavors", [])

    if not flavors or len(flavors) == 0:
        return {"flavors": [], "error": True}

    # Get current date as a string for comparison (YYYY-MM-DD format)
    now = time.now()
    today_str = now.format("2006-01-02")

    # Filter for today and future flavors, then get the next 3 days
    result_flavors = []
    for flavor in flavors:
        if len(result_flavors) >= 3:
            break

        flavor_name = flavor.get("title", "Unknown")
        flavor_name = flavor_name.replace("®", "").replace("™", "").replace("©", "")

        # Extract date from onDate field (format: "2026-02-08T00:00:00")
        date_str = flavor.get("onDate", "")

        if date_str:
            # Extract just the date part (YYYY-MM-DD) for comparison
            flavor_date = date_str[:10]

            # Only include today and future dates (string comparison works for ISO dates)
            if flavor_date >= today_str:
                result_flavors.append({
                    "name": flavor_name,
                    "date": date_str,
                })

    result = {
        "flavors": result_flavors,
        "error": False,
    }

    # Cache the result
    cache.set(cache_key, json.encode(result), ttl_seconds = 3600)

    return result

def fetch_current_flavor(location_url):
    """Fetch current flavor from Culver's website."""
    calendar = fetch_flavor_calendar(location_url)

    if calendar.get("error") or len(calendar.get("flavors", [])) == 0:
        return {"name": "No Flavors", "error": True}

    # Return just the first flavor for backward compatibility
    return {
        "name": calendar["flavors"][0]["name"],
        "error": False,
    }

def create_ice_cream_icon(color):
    """Create an ice cream cone icon with toppings and a cone shape."""

    # Determine topping/mix-in color based on main color
    topping_color = "#FFFFFF"  # Default white spots
    if color == FLAVOR_COLORS["chocolate"]:
        topping_color = "#FFE4B5"  # Caramel swirl
    elif color == FLAVOR_COLORS["mint"]:
        topping_color = "#3B3B3B"  # Dark chocolate chips
    elif color == FLAVOR_COLORS["strawberry"]:
        topping_color = "#FF1493"  # Strawberry chunks
    elif color == FLAVOR_COLORS["vanilla"]:
        topping_color = "#6F4E37"  # Chocolate chips
    elif color == FLAVOR_COLORS["raspberry"]:
        topping_color = "#000000"  # Black dots/fudge
    elif color == FLAVOR_COLORS["coffee"]:
        topping_color = "#3B3B3B"  # Dark brown/black dots
    elif color == FLAVOR_COLORS["lemon"]:
        topping_color = "#FF1493"  # Pink/raspberry colored dots

    return render.Stack(
        children = [
            # Cone (triangular shape using stacked boxes)
            render.Column(
                children = [
                    # Ice cream scoop with toppings
                    render.Stack(
                        children = [
                            # Main scoop
                            render.Padding(
                                pad = (2, 0, 2, 0),
                                child = render.Box(
                                    width = 12,
                                    height = 9,
                                    color = color,
                                ),
                            ),
                            # Topping spots
                            render.Padding(
                                pad = (3, 1, 0, 0),
                                child = render.Box(width = 2, height = 2, color = topping_color),
                            ),
                            render.Padding(
                                pad = (8, 2, 0, 0),
                                child = render.Box(width = 2, height = 2, color = topping_color),
                            ),
                            render.Padding(
                                pad = (5, 5, 0, 0),
                                child = render.Box(width = 2, height = 2, color = topping_color),
                            ),
                        ],
                    ),
                    # Cone layers (triangular)
                    render.Padding(
                        pad = (3, 0, 0, 0),
                        child = render.Box(width = 10, height = 2, color = "#D2691E"),
                    ),
                    render.Padding(
                        pad = (4, 0, 0, 0),
                        child = render.Box(width = 8, height = 2, color = "#C68E17"),
                    ),
                    render.Padding(
                        pad = (5, 0, 0, 0),
                        child = render.Box(width = 6, height = 2, color = "#D2691E"),
                    ),
                    render.Padding(
                        pad = (6, 0, 0, 0),
                        child = render.Box(width = 4, height = 2, color = "#C68E17"),
                    ),
                ],
            ),
        ],
    )

def format_date(date_str):
    """Format date string to 'Day M/D' format."""
    if not date_str:
        return "???"

    # Parse ISO format date (2026-02-08T00:00:00)
    t = time.parse_time(date_str, format = "2006-01-02T15:04:05")

    # Format as "Sat 2/8"
    day_name = t.format("Mon")
    month_day = t.format("1/2")

    return "{} {}".format(day_name, month_day)

def truncate_flavor(name, max_chars = 18):
    """Truncate flavor name to fit display."""
    if len(name) <= max_chars:
        return name

    # Try to truncate at a word boundary
    truncated = name[:max_chars - 1]
    last_space = truncated.rfind(" ")

    if last_space > max_chars // 2:
        return truncated[:last_space] + "."
    else:
        return truncated + "."

def create_mini_cone(color):
    """Create a mini ice cream cone (16x12 pixels) for 3-day view."""
    # Determine topping color
    topping_color = "#FFFFFF"
    if color == FLAVOR_COLORS["chocolate"]:
        topping_color = "#FFE4B5"  # Caramel swirl
    elif color == FLAVOR_COLORS["mint"]:
        topping_color = "#3B3B3B"  # Dark chocolate chips
    elif color == FLAVOR_COLORS["strawberry"]:
        topping_color = "#FF1493"  # Strawberry chunks
    elif color == FLAVOR_COLORS["vanilla"]:
        topping_color = "#6F4E37"  # Chocolate chips
    elif color == FLAVOR_COLORS["raspberry"]:
        topping_color = "#000000"  # Black dots/fudge
    elif color == FLAVOR_COLORS["coffee"]:
        topping_color = "#3B3B3B"  # Dark brown/black dots
    elif color == FLAVOR_COLORS["lemon"]:
        topping_color = "#FF1493"  # Pink/raspberry colored dots

    return render.Stack(
        children = [
            render.Column(
                children = [
                    # Ice cream scoop (6px tall)
                    render.Stack(
                        children = [
                            render.Box(width = 10, height = 6, color = color),
                            # Single topping dot
                            render.Padding(
                                pad = (2, 1, 0, 0),
                                child = render.Box(width = 2, height = 2, color = topping_color),
                            ),
                            render.Padding(
                                pad = (6, 2, 0, 0),
                                child = render.Box(width = 2, height = 2, color = topping_color),
                            ),
                        ],
                    ),
                    # Cone (6px tall, triangular)
                    render.Padding(
                        pad = (1, 0, 0, 0),
                        child = render.Box(width = 8, height = 2, color = "#D2691E"),
                    ),
                    render.Padding(
                        pad = (2, 0, 0, 0),
                        child = render.Box(width = 6, height = 2, color = "#C68E17"),
                    ),
                    render.Padding(
                        pad = (3, 0, 0, 0),
                        child = render.Box(width = 4, height = 2, color = "#D2691E"),
                    ),
                ],
            ),
        ],
    )

def format_flavor_for_display(name):
    """Format flavor name into 2 lines for mini cone display."""
    # Apply abbreviations based on user preferences
    name = name.replace("Chocolate", "Choc")
    name = name.replace("Peanut Butter", "PB")
    name = name.replace("Raspberry", "Rasp")
    name = name.replace("Salted", "Salt")
    name = name.replace("Crazy for", "Crazy4")
    name = name.replace("Midnight ", "")  # Drop "Midnight" entirely

    words = name.split()

    # Short enough for 1 line
    if len(name) <= 10:
        return [name]

    # Aim for balanced 2-line split
    line1 = ""
    line2 = ""

    # Build line1 up to ~10 chars
    for word in words:
        test = (line1 + " " + word).strip()
        if len(test) <= 10:
            line1 = test
        else:
            # Start line2 with remaining words
            break

    # Put remaining words on line2
    line1_words = line1.split()
    remaining_words = words[len(line1_words):]

    for word in remaining_words:
        test = (line2 + " " + word).strip()
        if len(test) <= 10:
            line2 = test
        else:
            # Truncate if still too long
            line2 = test[:10]
            break

    if line1 and line2:
        return [line1, line2]
    elif line1:
        return [line1]
    else:
        return [name[:10]]

def create_three_day_view(flavors, location_name):
    """Create 3-day forecast with mini cones and flavor names."""
    # Create 3 columns for 3 days
    columns = []

    for i, flavor in enumerate(flavors):
        flavor_name = flavor.get("name", "Unknown")
        flavor_color = get_flavor_color(flavor_name)

        # Format into 1-2 lines
        name_lines = format_flavor_for_display(flavor_name)

        # Build column with cone + text
        text_elements = []
        for line in name_lines:
            text_elements.append(
                render.Text(
                    content = line,
                    font = "tom-thumb",
                    color = "#FFFFFF",
                )
            )

        # Each column: mini cone + flavor name (1-2 lines)
        column = render.Column(
            main_align = "start",
            cross_align = "center",
            children = [
                create_mini_cone(flavor_color),
                render.Box(height = 1),  # Small spacer
            ] + text_elements,
        )

        columns.append(column)

    # Pad with empty columns if less than 3 flavors
    if len(columns) < 3:
        for i in range(3 - len(columns)):
            columns.append(render.Box(width = 1))

    return render.Column(
        main_align = "start",
        cross_align = "center",
        children = [
            # Top: Title with location (5px)
            render.Box(
                width = 64,
                height = 6,
                color = "#003366",
                child = render.Padding(
                    pad = (1, 0, 0, 0),
                    child = render.Text(
                        content = location_name,
                        font = "tom-thumb",
                        color = "#FFFFFF",
                    ),
                ),
            ),
            render.Box(height = 1),  # Small spacer
            # 3 cones in a row
            render.Row(
                main_align = "space_evenly",
                cross_align = "start",
                children = columns,
            ),
        ],
    )

def main(config):
    """Main entry point for the app."""

    # Map location dropdown value to URL and name
    location_key = config.get("location", "mt-horeb")
    location_map = {
        "mt-horeb": {
            "url": "https://www.culvers.com/restaurants/mt-horeb",
            "name": "Mt. Horeb",
        },
        "madison-todd-dr": {
            "url": "https://www.culvers.com/restaurants/madison-wi-todd-drive",
            "name": "Madison",
        },
    }

    location_info = location_map.get(location_key, location_map["mt-horeb"])
    location_url = location_info["url"]
    location_name = location_info["name"]
    view_mode = config.get("view_mode", "single")  # "single" or "three_day"

    # Fetch flavor calendar
    calendar_data = fetch_flavor_calendar(location_url)

    if calendar_data.get("error") or len(calendar_data.get("flavors", [])) == 0:
        # Error state
        return render.Root(
            child = render.Box(
                child = render.Text("No flavors found", font = "tom-thumb"),
            ),
        )

    flavors = calendar_data["flavors"]

    # Choose view based on config
    if view_mode == "three_day":
        return render.Root(child = create_three_day_view(flavors, location_name))
    else:
        # Single day view (original)
        flavor_name = flavors[0]["name"]
        flavor_color = get_flavor_color(flavor_name)
        icon = create_ice_cream_icon(flavor_color)

        return render.Root(
            child = render.Column(
                main_align = "space_between",
                cross_align = "center",
                children = [
                    # Top: Title with location (scrolling)
                    render.Box(
                        width = 64,
                        height = 10,
                        color = "#003366",  # Dark blue background
                        child = render.Marquee(
                            width = 64,
                            child = render.Text(
                                content = "Culver's FOTD - " + location_name,
                                font = "tom-thumb",
                                color = "#FFFFFF",
                            ),
                        ),
                    ),
                    # Middle: Icon
                    render.Box(
                        width = 64,
                        height = 16,
                        child = render.Row(
                            main_align = "center",
                            cross_align = "center",
                            children = [icon],
                        ),
                    ),
                    # Bottom: Flavor name (scrolling if needed)
                    render.Box(
                        width = 64,
                        height = 6,
                        child = render.Marquee(
                            width = 64,
                            child = render.Text(
                                content = flavor_name,
                                font = "tom-thumb",
                                color = "#FFFFFF",
                            ),
                        ),
                    ),
                ],
            ),
        )

def get_schema():
    """Configuration schema for the app."""
    return schema.Schema(
        version = "1",
        fields = [
            schema.Dropdown(
                id = "view_mode",
                name = "View Mode",
                desc = "Display style",
                icon = "eye",
                default = "single",
                options = [
                    schema.Option(
                        display = "Single Day (with icon)",
                        value = "single",
                    ),
                    schema.Option(
                        display = "3-Day Forecast",
                        value = "three_day",
                    ),
                ],
            ),
            schema.Dropdown(
                id = "location",
                name = "Location",
                desc = "Select your Culver's location",
                icon = "locationDot",
                default = "mt-horeb",
                options = [
                    schema.Option(
                        display = "Mt. Horeb, WI",
                        value = "mt-horeb",
                    ),
                    schema.Option(
                        display = "Madison Todd Dr, WI",
                        value = "madison-todd-dr",
                    ),
                ],
            ),
        ],
    )
